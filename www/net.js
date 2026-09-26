/* Xurface Discern - the network.
 *
 * A person on a train decides that an agent may not wire the money. That
 * decision must not be lost because the tunnel ate the request. So:
 *
 *   - every decision is written to a durable queue before it is sent,
 *   - the queue survives a reload and replays in order when the link returns,
 *   - a decision the server already settled (409/404) leaves the queue quietly
 *     rather than erroring at someone who did nothing wrong,
 *   - the last good view is cached, so opening the app offline shows real
 *     content instead of an empty shell,
 *   - reconnection backs off with jitter instead of hammering a dead link.
 *
 * The UI subscribes to one status object and never has to ask "are we online".
 */
"use strict";
(function () {


const NET_KEY = "discern.queue", CACHE_KEY = "discern.cache";
const TIMEOUT_MS = 12000;
const BACKOFF = [1000, 2000, 4000, 8000, 15000, 30000];

class NetworkError extends Error {
  constructor(msg) { super(msg || "offline"); this.offline = true; }
}
class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const Net = (() => {
  const subs = new Set();
  let state = {
    link: "unknown",        // unknown | online | offline | reconnecting
    syncing: false,
    lastSync: 0,
    queue: load(NET_KEY, []),
    attempt: 0,
  };
  let timer = null, base = "", envOf = () => "test", tokenOf = () => null, onReplayed = null;

  function load(k, dflt) { try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

  function emit() { for (const fn of subs) { try { fn(state); } catch {} } }
  function set(patch) { state = Object.assign({}, state, patch); emit(); }

  /** One fetch with a deadline. A timeout or a dropped connection is a network
   * problem; anything with a status code is an answer, even an unhappy one. */
  async function raw(method, path, body, { auth = true } = {}) {
    const ctl = new AbortController();
    const kill = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      const headers = { "content-type": "application/json", "x-xurface-env": envOf() };
      const tk = auth ? tokenOf() : null;
      if (tk) headers.authorization = `Bearer ${tk}`;
      res = await fetch(base + path, { method, headers, signal: ctl.signal,
        body: body != null ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new NetworkError(e && e.name === "AbortError" ? "timed out" : "unreachable");
    } finally { clearTimeout(kill); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || `${method} ${path}`);
    return data;
  }

  /** A read. Network failure flips us to offline and starts the retry clock. */
  async function request(method, path, body, opts) {
    try {
      const out = await raw(method, path, body, opts);
      if (state.link !== "online") goOnline();
      return out;
    } catch (e) {
      if (e instanceof NetworkError) goOffline();
      throw e;
    }
  }

  /** A write that must not be lost. Tried now; queued if the link is down.
   * Returns true when it went through, false when it was queued. */
  async function durable(op) {
    if (state.link === "offline") { enqueue(op); return false; }
    try {
      await raw(op.method, op.path, op.body);
      if (state.link !== "online") goOnline();
      return true;
    } catch (e) {
      if (e instanceof NetworkError) { goOffline(); enqueue(op); return false; }
      throw e;                              // a real answer from the server
    }
  }

  function enqueue(op) {
    const q = state.queue.concat([Object.assign({ id: `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() }, op)]);
    save(NET_KEY, q);
    set({ queue: q });
  }
  function dropFromQueue(id) {
    const q = state.queue.filter((x) => x.id !== id);
    save(NET_KEY, q);
    set({ queue: q });
  }

  /** Replay in order. Stops at the first network failure so ordering holds. */
  async function flush() {
    if (!state.queue.length || state.syncing) return;
    set({ syncing: true });
    let replayed = 0;
    for (const op of state.queue.slice()) {
      try {
        await raw(op.method, op.path, op.body);
        dropFromQueue(op.id); replayed++;
      } catch (e) {
        if (e instanceof NetworkError) { goOffline(); break; }
        // 409 already decided, 404 expired, 403 no longer yours: the world moved
        // on while we were away. Drop it rather than nag about it forever.
        dropFromQueue(op.id); replayed++;
      }
    }
    set({ syncing: false, lastSync: Date.now() });
    if (replayed && onReplayed) onReplayed(replayed);
  }

  function goOnline() {
    if (timer) { clearTimeout(timer); timer = null; }
    const was = state.link;
    set({ link: "online", attempt: 0, lastSync: Date.now() });
    if (was !== "online") flush();
  }

  function goOffline() {
    if (state.link === "offline" || state.link === "reconnecting") { schedule(); return; }
    set({ link: "offline" });
    schedule();
  }

  /** Exponential backoff with jitter: a dead link should not be hammered, and
   * ten thousand apps should not all retry on the same second. */
  function schedule() {
    if (timer) return;
    const wait = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
    const jitter = wait * (0.7 + Math.random() * 0.6);
    timer = setTimeout(async () => {
      timer = null;
      set({ link: "reconnecting", attempt: state.attempt + 1 });
      if (await probe()) { goOnline(); } else { set({ link: "offline" }); schedule(); }
    }, jitter);
  }

  /** What the backend says about itself, in three separate facts.
   *
   *   reachable  a reply arrived at all, so there is a network and a server
   *   ok         that reply was a success, so requests will work
   *   audit_ok   the record behind it verifies, so answers can be trusted
   *
   * They are kept apart because they call for different things: no network is
   * something to wait out, a bad reply is something to report, and a broken
   * audit chain is something to warn about while still letting people work. */
  async function health() {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { reachable: false, ok: false, audit_ok: null, why: "offline" };
    }
    try {
      const ctl = new AbortController();
      const kill = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(`${base}/healthz`, { headers: { "x-xurface-env": envOf() }, signal: ctl.signal, cache: "no-store" });
      clearTimeout(kill);
      const d = await r.json().catch(() => ({}));
      return { reachable: true, ok: r.ok, status: r.status,
               audit_ok: typeof d.audit_ok === "boolean" ? d.audit_ok : null,
               why: r.ok ? (d.audit_ok === false ? "degraded" : "") : "unhealthy" };
    } catch { return { reachable: false, ok: false, audit_ok: null, why: "unreachable" }; }
  }

  /** The yes or no version, which is all the reconnect loop needs. */
  async function probe() { const h = await health(); return h.reachable && h.ok; }

  /** The last good view, so an offline open is not an empty screen. */
  const cache = {
    read(env) { const c = load(CACHE_KEY, {}); return c[env] || null; },
    write(env, data) { const c = load(CACHE_KEY, {}); c[env] = Object.assign({ at: Date.now() }, data); save(CACHE_KEY, c); },
    clear() { save(CACHE_KEY, {}); },
  };

  function start(opts) {
    base = opts.base; envOf = opts.env; tokenOf = opts.token; onReplayed = opts.onReplayed;
    addEventListener("online", () => { set({ attempt: 0 }); if (timer) { clearTimeout(timer); timer = null; } probe().then((ok) => ok ? goOnline() : goOffline()); });
    addEventListener("offline", () => goOffline());
    // a tab woken from the background may have missed both events
    addEventListener("visibilitychange", () => { if (!document.hidden && state.link !== "online") probe().then((ok) => { if (ok) goOnline(); }); });
    if (!navigator.onLine) goOffline();
  }

  return {
    get state() { return state; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    start, request, durable, flush, probe, health, goOnline, goOffline, cache,
    get pending() { return state.queue.length; },
    queuedFor(intentId) { return state.queue.find((q) => q.intentId === intentId); },
  };
})();

window.Net = Net;
window.NetworkError = NetworkError;
window.ApiError = ApiError;

})();
