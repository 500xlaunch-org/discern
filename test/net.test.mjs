/* The offline queue is the part of Discern that must never fail quietly: a
 * person's decision about what an agent may do has to survive a tunnel, a
 * dropped wifi and a reload. So it gets tested the way it will be used, against
 * a fetch that fails on command.
 *
 *   node --test test/
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(here, "..", "www", "net.js"), "utf8");

/** A browser just real enough for net.js: storage that persists across
 * "reloads", a fetch we control, and the two connectivity events. */
function browser({ store = {} } = {}) {
  const listeners = {};
  const calls = [];
  let mode = "up";                       // up | down | status
  let status = 200, payload = { ok: true };

  const win = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    navigator: { onLine: true },
    document: { hidden: false },
    addEventListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); },
    // the reconnect backoff schedules itself forever, which would hold node's
    // event loop open after the assertions are done; unref lets the run finish
    setTimeout: (fn, ms) => { const h = setTimeout(fn, ms); h.unref?.(); return h; },
    clearTimeout, AbortController, Date, Math, JSON, Promise, console,
    async fetch(url, opts = {}) {
      calls.push({ url, method: opts.method || "GET", body: opts.body ? JSON.parse(opts.body) : undefined });
      if (mode === "down") { const e = new Error("refused"); e.name = "TypeError"; throw e; }
      if (mode === "status") return { ok: status < 400, status, json: async () => payload, text: async () => "" };
      return { ok: true, status: 200, json: async () => payload, text: async () => "" };
    },
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(SRC, win);

  return {
    Net: win.Net, NetworkError: win.NetworkError, calls, store,
    down() { mode = "down"; }, up() { mode = "up"; },
    answer(s, p = {}) { mode = "status"; status = s; payload = p; },
    fire(ev) { for (const fn of listeners[ev] || []) fn(); },
    queue: () => JSON.parse(store["discern.queue"] || "[]"),
  };
}

const start = (b) => b.Net.start({ base: "http://h", env: () => "test", token: () => "tk", onReplayed: () => {} });

test("a decision made offline is queued, not lost", async () => {
  const b = browser(); start(b);
  b.down();
  await b.Net.probe();            // discovers the link is down
  b.Net.goOffline();

  const sent = await b.Net.durable({ method: "POST", path: "/v1/user/intents/int_1/decide",
    body: { decision: "deny" }, intentId: "int_1" });
  assert.equal(sent, false, "durable() reports that it was queued, not sent");
  assert.equal(b.Net.pending, 1);
  assert.equal(b.queue()[0].body.decision, "deny");
  assert.ok(b.Net.queuedFor("int_1"), "the card can show itself as queued");
});

test("the queue survives a reload: it lives in storage, not in memory", async () => {
  const shared = {};
  const first = browser({ store: shared }); start(first);
  first.down(); first.Net.goOffline();
  await first.Net.durable({ method: "POST", path: "/v1/user/intents/a/decide", body: { decision: "approve" }, intentId: "a" });
  assert.equal(first.Net.pending, 1);

  const reopened = browser({ store: shared });          // a fresh page, same storage
  assert.equal(reopened.Net.pending, 1, "the decision is still there after a reload");
  assert.equal(reopened.Net.queuedFor("a").body.decision, "approve");
});

test("coming back online replays the queue in order, then reports it", async () => {
  const b = browser();
  let replayed = 0;
  b.Net.start({ base: "http://h", env: () => "test", token: () => "tk", onReplayed: (n) => { replayed = n; } });
  b.down(); b.Net.goOffline();
  for (const id of ["i1", "i2", "i3"]) {
    await b.Net.durable({ method: "POST", path: `/v1/user/intents/${id}/decide`, body: { decision: "approve" }, intentId: id });
  }
  assert.equal(b.Net.pending, 3);

  b.up();
  b.calls.length = 0;
  b.Net.goOnline();
  await new Promise((r) => setTimeout(r, 30));

  assert.equal(b.Net.pending, 0, "queue drained");
  assert.equal(replayed, 3, "the app is told how many synced, so it can say so");
  const order = b.calls.filter((c) => c.method === "POST").map((c) => c.url.match(/intents\/(\w+)/)[1]);
  assert.deepEqual(order, ["i1", "i2", "i3"], "replayed in the order the person decided");
});

test("a decision the server already settled leaves the queue quietly", async () => {
  const b = browser(); start(b);
  b.down(); b.Net.goOffline();
  await b.Net.durable({ method: "POST", path: "/v1/user/intents/old/decide", body: { decision: "approve" }, intentId: "old" });

  b.answer(409, { error: "intent is expired" });        // it timed out while we were away
  b.Net.goOnline();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(b.Net.pending, 0, "dropped rather than retried forever");
});

test("reads surface network failure as NetworkError, and HTTP errors as themselves", async () => {
  const b = browser(); start(b);
  b.down();
  await assert.rejects(() => b.Net.request("GET", "/v1/user/inbox"), (e) => e.offline === true);

  b.answer(401, { error: "unauthorized" });
  await assert.rejects(() => b.Net.request("GET", "/v1/user/inbox"), (e) => e.status === 401 && !e.offline);
});

test("the cached view is per environment, so test never shows live data", () => {
  const b = browser(); start(b);
  b.Net.cache.write("test", { intents: [{ id: "t1" }] });
  b.Net.cache.write("live", { intents: [{ id: "l1" }] });
  assert.equal(b.Net.cache.read("test").intents[0].id, "t1");
  assert.equal(b.Net.cache.read("live").intents[0].id, "l1");
  b.Net.cache.clear();
  assert.equal(b.Net.cache.read("test"), null);
});

test("the browser's own offline event flips the link without waiting for a request", () => {
  const b = browser(); start(b);
  assert.notEqual(b.Net.state.link, "offline");
  b.fire("offline");
  assert.equal(b.Net.state.link, "offline");
});

test("reconnection backs off instead of hammering a dead link", async () => {
  const b = browser(); start(b);
  b.down();
  b.Net.goOffline();
  const before = b.calls.length;
  await new Promise((r) => setTimeout(r, 120));
  // the first backoff step is ~1s with jitter, so nothing should have retried yet
  assert.equal(b.calls.length, before, "no retry storm in the first 120ms");
  assert.ok(["offline", "reconnecting"].includes(b.Net.state.link));
});
