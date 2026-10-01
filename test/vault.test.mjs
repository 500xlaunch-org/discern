/* The vault, exercised for real.
 *
 * vault.js is written for a browser, so the two things a browser gives it are
 * supplied here: WebCrypto, which Node has, and IndexedDB, which it does not.
 * The shim below is the small surface the vault actually uses, kept honest by
 * behaving like the real thing in the ways that matter: requests carry their
 * result, and a transaction completes after its work rather than before.
 *
 * Everything else is the shipped file, loaded unmodified. What is asserted is
 * what the feature promises: a listing carries no secrets, what lands on disk
 * is ciphertext, a wrong PIN is refused, guessing gets slower and then fatal,
 * and a release can be read by the Solution that asked and by nobody else.
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

/* ---------- the smallest IndexedDB that tells the truth ---------- */
function fakeIndexedDB() {
  const dbs = new Map();
  const done = (fn) => setTimeout(fn, 0);
  return {
    open(name) {
      const req = {};
      done(() => {
        let store = dbs.get(name);
        const fresh = !store;
        if (fresh) dbs.set(name, (store = new Map()));
        const db = {
          objectStoreNames: { contains: (s) => store.has(s) },
          createObjectStore: (s) => store.set(s, new Map()),
          transaction(names, _mode) {
            const t = {};
            const touched = [];
            t.objectStore = (s) => {
              const m = store.get(s);
              const wrap = (fn) => { const r = {}; touched.push(r); done(() => { r.result = fn(); if (r.onsuccess) r.onsuccess(); }); return r; };
              return {
                get: (k) => wrap(() => m.get(k)),
                getAll: () => wrap(() => [...m.values()]),
                put: (v) => wrap(() => { m.set(v[keyOf(s)], v); return v; }),
                delete: (k) => wrap(() => { m.delete(k); }),
                clear: () => wrap(() => { m.clear(); }),
              };
            };
            // complete only once every request has run, like a real transaction
            done(() => done(() => done(() => t.oncomplete && t.oncomplete())));
            return t;
          },
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    },
    _wipe() { dbs.clear(); },
  };
  function keyOf(store) { return store === "meta" ? "k" : "id"; }
}

/* An open vault holds a two minute timer for its own auto lock, which is right
 * in an app and would otherwise keep this process alive for two minutes after
 * the last assertion. Every vault made here is closed when the run ends. */
const made = [];
after(() => { for (const v of made) v.lock(); });

/** Load the shipped vault.js into a context that looks enough like a browser. */
function loadVault() {
  const idb = fakeIndexedDB();
  const ctx = {
    crypto: webcrypto, btoa, atob, setTimeout, clearTimeout, console,
    indexedDB: idb,
    TextEncoder, TextDecoder,
    navigator: { credentials: undefined },       // no authenticator in this test
    PublicKeyCredential: undefined,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../www/vault.js", import.meta.url), "utf8"), ctx);
  made.push(ctx.Vault);
  return { V: ctx.Vault, ctx, idb };
}

const PIN = "481920";

test("a vault is created, opened, and reports how it is protected", async () => {
  const { V } = loadVault();
  await V.load();
  assert.equal(V.state.exists, false, "nothing is there until it is made");

  await V.create(PIN, { useDeviceLock: false });
  assert.equal(V.state.exists, true);
  assert.equal(V.state.unlocked, true, "making it opens it");
  assert.equal(V.state.protection, "pin+device-secret",
               "with no authenticator it falls back and says so");
});

test("six digits, and a vault is made once", async () => {
  const { V } = loadVault();
  await assert.rejects(() => V.create("12345", { useDeviceLock: false }), /pin-6-digits/);
  await assert.rejects(() => V.create("abcdef", { useDeviceLock: false }), /pin-6-digits/);
  await V.create(PIN, { useDeviceLock: false });
  await assert.rejects(() => V.create("111111", { useDeviceLock: false }), /vault-exists/);
});

test("a listing can be read without opening anything, and carries no secrets", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  await V.put({ kind: "wifi", value: { network: "Home Fibre", password: "sup3rsecret" } });
  await V.put({ kind: "card", value: { label: "Travel", number: "4111111111111111", expiry: "09/29" } });

  const list = await V.list();
  assert.equal(list.length, 2);
  const card = list.find((x) => x.kind === "card");
  assert.equal(card.hint, "ending 1111", "a card shows its last four, never the rest");
  const flat = JSON.stringify(list);
  assert.ok(!flat.includes("sup3rsecret"), "no password in a listing");
  assert.ok(!flat.includes("4111111111111111"), "no card number in a listing");
  assert.ok(flat.includes("Home Fibre"), "the name of the network is not a secret");
});

test("what is written to the device is ciphertext", async () => {
  const { V, ctx } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  await V.put({ kind: "login", value: { site: "mail.example.com", username: "ada", password: "hunter2" } });

  const rows = await new Promise((ok) => {
    const r = ctx.indexedDB.open("discern.vault");
    r.onsuccess = () => {
      const t = r.result.transaction("items", "readonly").objectStore("items").getAll();
      t.onsuccess = () => ok(t.result);
    };
  });
  const raw = JSON.stringify(rows);
  assert.ok(!raw.includes("hunter2"), "the password is not on disk in the clear");
  assert.ok(rows[0].ct && rows[0].iv, "a ciphertext and its nonce are");
  assert.notEqual(rows[0].iv, "", "every record carries its own nonce");
});

test("locking forgets the key, and the right PIN brings it back", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const { id } = await V.put({ kind: "wifi", value: { network: "Cafe", password: "flatwhite" } });

  assert.equal((await V.reveal(id)).password, "flatwhite");
  V.lock();
  assert.equal(V.state.unlocked, false);
  await assert.rejects(() => V.reveal(id), /locked/, "a locked vault reveals nothing");

  await assert.rejects(() => V.unlock("000000"), /wrong-pin/);
  await V.unlock(PIN);
  assert.equal((await V.reveal(id)).password, "flatwhite", "and it is still what it was");
});

test("guessing gets slower, then fatal", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  await V.put({ kind: "note", value: { label: "n", text: "t" } });
  V.lock();

  // the first few wrong tries cost nothing but the try itself
  for (let i = 0; i < 4; i++) await assert.rejects(() => V.unlock("000000"), /wrong-pin/);
  assert.ok(V.penalty() > 0, "the fifth wrong try starts the waiting");
  await assert.rejects(() => V.unlock(PIN), /too-soon/, "even the right PIN waits its turn");

  // wind the clock forward rather than sleeping through it
  for (let i = 4; i < 9; i++) {
    V._meta.failedAt = 0;
    await assert.rejects(() => V.unlock("000000"), /wrong-pin/);
  }
  V._meta.failedAt = 0;
  await assert.rejects(() => V.unlock("000000"), /wiped/, "the tenth wrong try erases it");
  await V.load();
  assert.equal(V.state.exists, false, "and there is nothing left to guess at");
});

test("erasing after ten can be turned off, and then it is not erased", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  await V.setWipe(false);
  assert.equal(V.triesLeft(), null, "nothing is counting down any more");
  V.lock();
  for (let i = 0; i < 12; i++) {
    V._meta.failedAt = 0;
    await assert.rejects(() => V.unlock("000000"), /wrong-pin/);
  }
  V._meta.failedAt = 0;
  await V.unlock(PIN);
  assert.equal(V.state.unlocked, true, "it is still there for whoever knows the PIN");
});

test("a release is sealed to the Solution that asked, and to nobody else", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const { id } = await V.put({ kind: "wifi", value: { network: "Home Fibre", password: "sup3rsecret" } });

  const b64 = (b) => Buffer.from(b).toString("base64url");
  const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64url"));
  const theirs = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const pub = b64(await webcrypto.subtle.exportKey("raw", theirs.publicKey));

  await assert.rejects(() => V.release(id, { solutionUid: "sol_x" }), /no-release-key/,
                       "a Solution that published no key is refused, not served in the clear");

  const sealed = await V.release(id, { solutionUid: "sol_x", publicKey: pub, field: "password" });
  assert.ok(!JSON.stringify(sealed).includes("sup3rsecret"), "nothing readable travels");
  assert.equal(sealed.alg, "ecdh-p256-hkdf-sha256-aes256gcm");

  // the Solution's own key opens it
  const eph = await webcrypto.subtle.importKey("raw", unb64(sealed.ephemeral), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "ECDH", public: eph }, theirs.privateKey, 256));
  const mat = await webcrypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  const key = await webcrypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: unb64(sealed.salt), info: new TextEncoder().encode("xurface.vault.release") },
    mat, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const clear = JSON.parse(new TextDecoder().decode(
    await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, key, unb64(sealed.ct))));
  assert.equal(clear.password, "sup3rsecret", "the one who asked can read it");
  assert.equal(clear.network, undefined, "and gets only the field that was asked for");

  // anyone else's key does not
  const other = await webcrypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const wrongShared = new Uint8Array(await webcrypto.subtle.deriveBits({ name: "ECDH", public: eph }, other.privateKey, 256));
  const wrongMat = await webcrypto.subtle.importKey("raw", wrongShared, "HKDF", false, ["deriveKey"]);
  const wrongKey = await webcrypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: unb64(sealed.salt), info: new TextEncoder().encode("xurface.vault.release") },
    wrongMat, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  await assert.rejects(() => webcrypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(sealed.iv) }, wrongKey, unb64(sealed.ct)),
                       "another key opens nothing");
});

test("an allowance is a permission, not a copy of the secret", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const { id } = await V.put({ kind: "otp", value: { label: "Bank", seed: "JBSWY3DPEHPK3PXP" } });

  const g = await V.grant(id, { solution: "sol_bank", agent: "payer", purpose: "Confirm a transfer" });
  const granted = await V.grantsFor("sol_bank");
  assert.equal(granted.length, 1);
  assert.ok(!JSON.stringify(granted).includes("JBSWY3DPEHPK3PXP"), "the allowance carries no seed");

  await V.revoke(id, V.grantKey(g));
  assert.equal((await V.grantsFor("sol_bank")).length, 0, "and it can be taken back");
});

test("an allowance answers only the same agent, for the same purpose", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const { id } = await V.put({ kind: "wifi", value: { network: "Office", password: "hunter2" } });
  await V.grant(id, { solution: "sol_a", agent: "joiner", purpose: "Join the office wifi" });

  const same = await V.standingFor({ solution: "sol_a", agent: "joiner", purpose: "join  the OFFICE wifi", kind: "wifi" });
  assert.equal(same && same.id, id, "the same purpose, however it is spaced or cased");
  assert.equal(await V.standingFor({ solution: "sol_a", agent: "joiner", purpose: "Share it with a guest", kind: "wifi" }), null,
    "a different reason asks again");
  assert.equal(await V.standingFor({ solution: "sol_a", agent: "someone-else", purpose: "Join the office wifi", kind: "wifi" }), null,
    "a different agent asks again");
  assert.equal(await V.standingFor({ solution: "sol_b", agent: "joiner", purpose: "Join the office wifi", kind: "wifi" }), null,
    "a different Solution asks again");
});

test("changing the value takes every allowance back; saving the same value does not", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const { id } = await V.put({ kind: "login", value: { site: "mail", username: "ada", password: "one" } });
  await V.grant(id, { solution: "sol_a", agent: "reader", purpose: "Read the inbox" });
  await V.grant(id, { solution: "sol_b", agent: "filer", purpose: "File receipts" });
  assert.equal((await V.list()).find((r) => r.id === id).grants.length, 2);

  // the same value, saved again: nothing changed, nothing is taken back
  await V.put({ id, kind: "login", value: { username: "ada", site: "mail", password: "one" } });
  let rec = (await V.list()).find((r) => r.id === id);
  assert.equal(rec.grants.length, 2);
  assert.equal(rec.version, 1);

  // a new password: every allowance stops, and the next request asks
  await V.put({ id, kind: "login", value: { site: "mail", username: "ada", password: "two" } });
  rec = (await V.list()).find((r) => r.id === id);
  assert.equal(rec.grants.length, 0, "nobody agreed to hand over the new one");
  assert.equal(rec.version, 2);
  assert.equal(await V.standingFor({ solution: "sol_a", agent: "reader", purpose: "Read the inbox", kind: "login" }), null);
  assert.equal((await V.reveal(id)).password, "two");
});

test("a ciphertext cannot be moved from one record to another", async () => {
  const { V, ctx } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  const a = await V.put({ kind: "note", value: { label: "A", text: "first" } });
  const b = await V.put({ kind: "note", value: { label: "B", text: "second" } });

  // swap one record's ciphertext onto the other, as a tampering server would
  await new Promise((ok) => {
    const r = ctx.indexedDB.open("discern.vault");
    r.onsuccess = () => {
      const s = r.result.transaction("items", "readwrite").objectStore("items");
      const g = s.getAll();
      g.onsuccess = () => {
        const rows = g.result;
        const one = rows.find((x) => x.id === a.id), two = rows.find((x) => x.id === b.id);
        s.put({ ...one, ct: two.ct, iv: two.iv });
        setTimeout(ok, 5);
      };
    };
  });
  await assert.rejects(() => V.reveal(a.id),
                       "the id is bound into the encryption, so a swapped record will not open");
});

test("destroy leaves nothing behind", async () => {
  const { V } = loadVault();
  await V.create(PIN, { useDeviceLock: false });
  await V.put({ kind: "wifi", value: { network: "n", password: "p" } });
  await V.destroy();
  await V.load();
  assert.equal(V.state.exists, false);
  assert.equal((await V.list()).length, 0);
});
