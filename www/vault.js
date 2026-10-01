/* Discern - the vault.
 *
 * What it holds: a wifi password, a mailbox login, a one time code seed, a
 * card, anything an agent might need to reach on your behalf.
 *
 * WHERE IT LIVES
 * On this device. Nowhere else. Horizon never receives a vault item, not even
 * encrypted, so there is no server copy to breach, subpoena or lose. That is
 * the direct consequence of choosing no recovery: a vault that can be restored
 * from a server is a vault the server can be made to give up, and one that
 * cannot be restored has no reason to be there. Moving to a new phone is an
 * explicit transfer the person performs, not something that happens quietly in
 * the background.
 *
 * HOW IT IS LOCKED
 * Two factors, and neither is sufficient alone.
 *
 *   1. A six digit PIN. Six digits is a million guesses, which is nothing to a
 *      machine, so the PIN is never the whole key. It is stretched through
 *      PBKDF2-SHA256 at 600,000 iterations against a random salt, which makes
 *      each guess cost something even when the other factor is known.
 *
 *   2. A secret belonging to this device. Where the platform authenticator
 *      supports the WebAuthn PRF extension, that secret only exists after a
 *      real device unlock: a face, a fingerprint, the phone's own passcode.
 *      Where it does not, a random secret is generated once and kept in the
 *      device's own storage, which is weaker but still means the PIN alone
 *      gets nobody anywhere.
 *
 * The two are concatenated and run through HKDF to a key encryption key, which
 * wraps a random 256 bit data encryption key. Items are encrypted under that
 * key with AES-256-GCM, a fresh random nonce each time, and the item's id and
 * kind bound in as additional data so a ciphertext cannot be moved from one
 * record to another.
 *
 * The data encryption key exists in memory only while the vault is open, and
 * is dropped when it locks.
 *
 * WHAT LEAVES
 * Only what a person approves, once, for one action. Releases are encrypted to
 * the requesting Solution's own public key before they go anywhere, using the
 * same ECDH and AES-GCM construction the push channel uses, so Horizon carries
 * a ciphertext it cannot read. A Solution that has not published a release key
 * is refused rather than quietly served in the clear.
 */
"use strict";
(function () {

const DB_NAME = "discern.vault", DB_VERSION = 1;
const STORE_ITEMS = "items", STORE_META = "meta";
const KDF_ITERATIONS = 600000;          // PBKDF2-SHA256; a six digit PIN needs the work
const AUTO_LOCK_MS = 120000;            // two minutes of not being used
/* Six digits is a million guesses, which a machine does in minutes. Stretching
 * the PIN makes each guess cost something; these two make the guessing stop.
 * Both are what a phone does with its own passcode, for the same reason. */
const WIPE_AFTER = 10;                  // wrong tries before the vault is gone
const BACKOFF_MS = [0, 0, 0, 0, 5000, 15000, 60000, 300000, 900000, 3600000];

/* ---------- small helpers ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => {
  const raw = atob(String(s).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};
const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/* ---------- storage ---------- */

let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((ok, no) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE_ITEMS)) d.createObjectStore(STORE_ITEMS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(STORE_META)) d.createObjectStore(STORE_META, { keyPath: "k" });
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error || new Error("vault storage unavailable"));
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((ok, no) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    try { result = fn(s); } catch (e) { no(e); return; }
    t.oncomplete = () => ok(result && result.result !== undefined ? result.result : result);
    t.onerror = () => no(t.error);
  });
}
const metaGet = (k) => tx(STORE_META, "readonly", (s) => s.get(k)).then((r) => (r && r.v) ?? null);
const metaPut = (k, v) => tx(STORE_META, "readwrite", (s) => s.put({ k, v }));

/* ---------- the device's own secret ----------
 *
 * The strong path is the WebAuthn PRF extension: the authenticator returns a
 * stable 32 bytes for a given credential and salt, and only after the person
 * has satisfied the device's own unlock. The secret therefore does not exist
 * at rest anywhere, which is the property worth having.
 *
 * The fallback is a random secret generated once. It is weaker, because
 * anything on the device can in principle reach the device's storage, but it
 * still means a stolen PIN is not a stolen vault. Which path was used is
 * recorded, so the app can tell the truth about it on screen. */

const PRF_SALT = enc.encode("xurface.discern.vault.v1");
const WEBAUTHN_MS = 25000;

/** The platform authenticator can take its time, and on some of them the
 * promise simply never settles. A vault that cannot be created because a
 * prompt never came back is worse than one protected by the PIN alone, so the
 * wait is bounded and the answer is "no" rather than nothing. */
function bounded(promise) {
  return Promise.race([
    promise,
    new Promise((_, no) => setTimeout(() => no(new Error("authenticator-timeout")), WEBAUTHN_MS)),
  ]);
}

async function prfSecret(credentialId) {
  if (!window.PublicKeyCredential || !navigator.credentials) return null;
  try {
    const assertion = await bounded(navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: credentialId ? [{ type: "public-key", id: unb64(credentialId) }] : [],
        userVerification: "required",
        timeout: 60000,
        extensions: { prf: { eval: { first: PRF_SALT } } },
      },
    }));
    const out = assertion && assertion.getClientExtensionResults &&
      assertion.getClientExtensionResults().prf;
    if (out && out.results && out.results.first) return new Uint8Array(out.results.first);
  } catch (e) { /* cancelled, unsupported, or no such credential */ }
  return null;
}

async function deviceSecret(meta, { interactive }) {
  if (meta.prfCredential) {
    const s = await prfSecret(meta.prfCredential);
    if (s) return { secret: s, source: "device" };
    if (interactive) throw new Error("device-unlock-failed");
  }
  let local = await metaGet("deviceSecret");
  if (!local) { local = b64(rand(32)); await metaPut("deviceSecret", local); }
  return { secret: unb64(local), source: meta.prfCredential ? "device" : "local" };
}

/* ---------- keys ---------- */

async function kek(pin, saltB64, secret) {
  const salt = unb64(saltB64);
  const pinKey = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const stretched = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" }, pinKey, 256));
  // the two factors are combined, never used one at a time
  const material = await crypto.subtle.importKey("raw", concat(stretched, secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("xurface.vault.kek") },
    material, { name: "AES-GCM", length: 256 }, false, ["wrapKey", "unwrapKey", "encrypt", "decrypt"]);
}

async function sealItem(dek, id, kind, value) {
  const iv = rand(12);
  const aad = enc.encode(`${id} ${kind}`);          // a ciphertext cannot move records
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, dek, enc.encode(JSON.stringify(value)));
  return { iv: b64(iv), ct: b64(ct) };
}
async function openItem(dek, rec) {
  const aad = enc.encode(`${rec.id} ${rec.kind}`);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(rec.iv), additionalData: aad }, dek, unb64(rec.ct));
  return JSON.parse(dec.decode(clear));
}

/* ---------- the vault ---------- */

let DEK = null;                 // in memory only, and only while unlocked
let lockTimer = null;
const subs = new Set();
const emit = () => { for (const fn of subs) { try { fn(Vault.state); } catch (e) {} } };

function armAutoLock() {
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => Vault.lock(), AUTO_LOCK_MS);
}

/** What the vault is willing to hold, and what a person is asked for each. */
const KINDS = {
  wifi:     { fields: ["network", "password"], secret: ["password"] },
  login:    { fields: ["site", "username", "password"], secret: ["password"] },
  otp:      { fields: ["label", "seed"], secret: ["seed"] },
  mfa:      { fields: ["label", "code"], secret: ["code"] },
  passkey:  { fields: ["label", "handle"], secret: ["handle"] },
  card:     { fields: ["label", "number", "expiry", "holder"], secret: ["number"] },
  note:     { fields: ["label", "text"], secret: ["text"] },
};


/* ---- allowances ---- */

/** The same object with its keys in one order, so two values can be compared
 * without caring how they were typed in. */
function stable(v) {
  if (v == null || typeof v !== "object") return JSON.stringify(v);
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stable(v[k])).join(",") + "}";
}

/** A purpose, as something two requests can agree on: lower case, spaces
 * collapsed, bounded. An agent that declares "Join the office wifi" twice is
 * asking for the same thing twice. */
function purposeKey(p) {
  return String(p || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 120);
}

function grantKey(g) { return [g.solution, g.agent, g.purpose].join("|"); }

/** Allowances that still mean something. Older vaults stored a bare Solution
 * id, which said nothing about the agent or the purpose; those are dropped,
 * and the next request simply asks again. */
function liveGrants(rec) {
  return (rec.grants || []).filter((g) => g && typeof g === "object" && g.solution && g.v === (rec.version || 1));
}

const Vault = {
  KINDS,
  get state() {
    return { exists: !!Vault._meta, unlocked: !!DEK, protection: Vault._meta ? Vault._meta.protection : null,
             count: Vault._count };
  },
  _meta: null,
  _count: 0,

  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

  /** Erasing after ten wrong tries can be turned off. It is on by default,
   * because there is no recovery either way: the difference is whether a
   * stolen phone gets a million free guesses. */
  async setWipe(on) {
    if (!Vault._meta) return;
    Vault._meta.wipeOnBruteForce = !!on;
    await metaPut("vault", Vault._meta);
    emit();
  },

  /** Read what is on the device without opening anything. */
  async load() {
    try {
      Vault._meta = await metaGet("vault");
      Vault._count = Vault._meta ? (await tx(STORE_ITEMS, "readonly", (s) => s.getAll())).length : 0;
    } catch (e) { Vault._meta = null; Vault._count = 0; }
    emit();
    return Vault.state;
  },

  /** Set up for the first time. The PIN is required; the device lock is used
   * as well when the authenticator offers it, and the person is told which of
   * the two they ended up with. */
  async create(pin, { useDeviceLock }) {
    if (!/^\d{6}$/.test(String(pin))) throw new Error("pin-6-digits");
    if (Vault._meta) throw new Error("vault-exists");
    let prfCredential = null;
    if (useDeviceLock && window.PublicKeyCredential) {
      try {
        const cred = await bounded(navigator.credentials.create({
          publicKey: {
            challenge: rand(32),
            rp: { name: "Discern" },
            user: { id: rand(16), name: "vault", displayName: "Discern vault" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
            extensions: { prf: { eval: { first: PRF_SALT } } },
            timeout: 60000, attestation: "none",
          },
        }));
        const ext = cred && cred.getClientExtensionResults && cred.getClientExtensionResults();
        // only worth keeping if the authenticator really does PRF
        if (ext && ext.prf && ext.prf.enabled !== false) prfCredential = b64(cred.rawId);
      } catch (e) { prfCredential = null; }
    }
    const salt = b64(rand(16));
    const meta = { v: 1, salt, prfCredential, protection: prfCredential ? "pin+device" : "pin",
                   failures: 0, failedAt: 0, wipeOnBruteForce: true, createdAt: Date.now() };
    const { secret, source } = await deviceSecret(meta, { interactive: false });
    if (!prfCredential && source === "local") meta.protection = "pin+device-secret";

    const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const key = await kek(pin, salt, secret);
    const iv = rand(12);
    const wrapped = await crypto.subtle.wrapKey("raw", dek, key, { name: "AES-GCM", iv });
    meta.wrapped = b64(wrapped);
    meta.wrapIv = b64(iv);
    await metaPut("vault", meta);
    Vault._meta = meta;
    DEK = dek;
    armAutoLock(); emit();
    return Vault.state;
  },

  /** How long this device is making the next attempt wait. */
  penalty() {
    const m = Vault._meta;
    if (!m || !m.failedAt) return 0;
    const wait = BACKOFF_MS[Math.min(m.failures || 0, BACKOFF_MS.length - 1)];
    return Math.max(0, m.failedAt + wait - Date.now());
  },
  triesLeft() {
    const m = Vault._meta;
    if (!m || !m.wipeOnBruteForce) return null;
    return Math.max(0, WIPE_AFTER - (m.failures || 0));
  },

  /** Open it.
   *
   * A wrong PIN says only that it was wrong: which of the two factors failed
   * is not something an attacker should be told. Wrong tries cost an
   * increasing wait, and past ten the vault is erased, which is the only
   * honest defence for six digits on a phone somebody else is holding. */
  async unlock(pin) {
    if (!Vault._meta) throw new Error("no-vault");
    const wait = Vault.penalty();
    if (wait > 0) { const e = new Error("too-soon"); e.waitMs = wait; throw e; }
    const meta = Vault._meta;
    const { secret } = await deviceSecret(meta, { interactive: true });
    const key = await kek(pin, meta.salt, secret);
    let opened;
    try {
      opened = await crypto.subtle.unwrapKey("raw", unb64(meta.wrapped), key,
        { name: "AES-GCM", iv: unb64(meta.wrapIv) }, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    } catch (e) {
      meta.failures = (meta.failures || 0) + 1;
      meta.failedAt = Date.now();
      await metaPut("vault", meta);
      if (meta.wipeOnBruteForce && meta.failures >= WIPE_AFTER) {
        await Vault.destroy();
        throw new Error("wiped");
      }
      emit();
      throw new Error("wrong-pin");
    }
    DEK = opened;
    if (meta.failures) { meta.failures = 0; meta.failedAt = 0; await metaPut("vault", meta); }
    armAutoLock(); await Vault.load();
    return Vault.state;
  },

  lock() {
    DEK = null;
    clearTimeout(lockTimer);
    emit();
  },

  /** Every item, without their secrets. Listing a vault should not open it. */
  async list() {
    const rows = await tx(STORE_ITEMS, "readonly", (s) => s.getAll());
    return (rows || []).map((r) => ({ id: r.id, kind: r.kind, label: r.label, hint: r.hint,
                                      usedAt: r.usedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
                                      version: r.version || 1, grants: liveGrants(r) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /** One item, opened. Requires the vault to be unlocked. */
  async reveal(id) {
    if (!DEK) throw new Error("locked");
    const rec = await tx(STORE_ITEMS, "readonly", (s) => s.get(id));
    if (!rec) throw new Error("no-such-item");
    armAutoLock();
    return openItem(DEK, rec);
  },

  /** Add or replace. `label` and `hint` are deliberately in the clear: a list
   * you cannot read without unlocking is a list nobody can navigate, and the
   * name of a wifi network is not the password to it. */
  async put(item) {
    if (!DEK) throw new Error("locked");
    const kind = KINDS[item.kind] ? item.kind : "note";
    const id = item.id || `vit_${b64(rand(9))}`;
    const value = item.value || {};

    // Replacing an item. If what it holds has changed, every allowance given for
    // it stops here: somebody agreed to hand over that value, not whatever is
    // in this slot next. The same value saved again keeps them.
    const prior = item.id ? await tx(STORE_ITEMS, "readonly", (s) => s.get(item.id)) : null;
    let version = 1, grants = [];
    if (prior) {
      let before = null;
      try { before = await openItem(DEK, prior); } catch { before = null; }
      const same = before != null && stable(before) === stable(value) && prior.kind === kind;
      version = same ? (prior.version || 1) : (prior.version || 1) + 1;
      grants = same ? liveGrants(prior) : [];
    }

    const sealed = await sealItem(DEK, id, kind, value);
    const first = KINDS[kind].fields.find((f) => !KINDS[kind].secret.includes(f));
    const rec = {
      id, kind, label: item.label || value[first] || kind,
      hint: item.hint || hintFor(kind, value),
      ...sealed, createdAt: prior ? prior.createdAt : (item.createdAt || Date.now()),
      updatedAt: Date.now(), version, grants,
    };
    await tx(STORE_ITEMS, "readwrite", (s) => s.put(rec));
    armAutoLock(); await Vault.load();
    return { id };
  },

  async remove(id) {
    await tx(STORE_ITEMS, "readwrite", (s) => s.delete(id));
    await Vault.load();
  },

  /** Permission given once, to be used again for the same purpose.
   *
   * An allowance names who may ask (the Solution and the agent inside it), why
   * (the purpose the agent declared), and which version of the value it was
   * given for. All four have to match for it to apply, so the same agent asking
   * for the same password for a different reason asks again, and so does any
   * agent after the password has been changed.
   *
   * It is a permission, not a copy: every use is still a release sealed to the
   * Solution, and nothing about the value is stored in the allowance. */
  async grant(id, who) {
    const rec = await tx(STORE_ITEMS, "readonly", (s) => s.get(id));
    if (!rec) throw new Error("no-such-item");
    const g = { solution: String(who.solution || ""), agent: String(who.agent || ""),
                purpose: purposeKey(who.purpose), at: Date.now(), v: rec.version || 1 };
    if (!g.solution) throw new Error("no-solution");
    rec.grants = [...liveGrants(rec).filter((x) => grantKey(x) !== grantKey(g)), g];
    await tx(STORE_ITEMS, "readwrite", (s) => s.put(rec));
    await Vault.load();
    return g;
  },

  /** Take one allowance back, or every allowance on the item. */
  async revoke(id, key) {
    const rec = await tx(STORE_ITEMS, "readonly", (s) => s.get(id));
    if (!rec) return;
    rec.grants = key ? liveGrants(rec).filter((g) => grantKey(g) !== key) : [];
    await tx(STORE_ITEMS, "readwrite", (s) => s.put(rec));
    await Vault.load();
  },

  /** Everything a Solution has been allowed, so the person can see it in one
   * place and take it back. */
  async grantsFor(solutionUid) {
    const rows = await Vault.list();
    return rows.filter((r) => (r.grants || []).some((g) => g.solution === solutionUid));
  },

  /** The item a request may be answered from without asking, if the person
   * said so before for exactly this. Null otherwise, which means ask. */
  async standingFor(ask) {
    const want = { solution: String(ask.solution || ""), agent: String(ask.agent || ""),
                   purpose: purposeKey(ask.purpose) };
    const rows = await tx(STORE_ITEMS, "readonly", (s) => s.getAll());
    for (const r of rows) {
      if (ask.kind && r.kind !== ask.kind) continue;
      const hit = liveGrants(r).find((g) => g.solution === want.solution && g.agent === want.agent
        && g.purpose === want.purpose && g.v === (r.version || 1));
      if (hit) return { id: r.id, label: r.label, grant: hit };
    }
    return null;
  },

  grantKey: (g) => grantKey(g),
  purposeKey: (p) => purposeKey(p),

  /* ---- moving the vault to another of your devices ----
   *
   * The receiving device makes a key pair that exists for this one move and
   * shows a code: the relay's id, then a fingerprint of its public key. The
   * sending device types the code, fetches the key, and refuses unless the key
   * it was given has that fingerprint. Forty bits of fingerprint inside a ten
   * minute window means a relay that tried to swap in a key of its own would
   * need to find one matching it in time, which it cannot.
   *
   * What travels is every item's kind, name, hint and value. Not the allowances:
   * those were given on the other phone, for that phone, and the new one asks
   * again. */

  /** Forty bits of SHA-256 over the raw public key, as eight characters a
   * person can read aloud without confusing 0 and O. */
  async fingerprint(pubRaw) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", typeof pubRaw === "string" ? unb64(pubRaw) : pubRaw));
    // thirty two symbols, five bits each, with nothing that reads as another:
    // no I, no O, and no 0 or 1
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let bits = 0, acc = 0, out = "";
    for (let i = 0; i < 5; i++) {
      acc = ((acc << 8) | h[i]) & 0xffff; bits += 8;
      while (bits >= 5) { out += alphabet[(acc >> (bits - 5)) & 31]; bits -= 5; }
    }
    return out;
  },

  /** The receiving side: a key pair for this one move. The private half never
   * leaves this object. */
  async receiver() {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const fp = await Vault.fingerprint(pub);
    return {
      publicKey: b64(pub), fingerprint: fp,
      /** Open what arrived. Throws if it was not sealed for this key. */
      async open(env) {
        const eph = await crypto.subtle.importKey("raw", unb64(env.ephemeral), { name: "ECDH", namedCurve: "P-256" }, false, []);
        const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: eph }, kp.privateKey, 256));
        const mat = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey(
          { name: "HKDF", hash: "SHA-256", salt: unb64(env.salt), info: enc.encode("xurface.vault.transfer") },
          mat, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(env.iv) }, key, unb64(env.ct));
        const parsed = JSON.parse(new TextDecoder().decode(clear));
        if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) throw new Error("not-a-vault");
        return parsed.items;
      },
    };
  },

  /** The sending side: everything in the vault, sealed for one public key,
   * after checking that key has the fingerprint the person typed. */
  async sealFor(receiverKey, expectedFingerprint) {
    if (!DEK) throw new Error("locked");
    const fp = await Vault.fingerprint(receiverKey);
    if (fp !== String(expectedFingerprint || "").toUpperCase().replace(/[^A-Z0-9]/g, "")) {
      throw new Error("fingerprint-mismatch");
    }
    const rows = await tx(STORE_ITEMS, "readonly", (s) => s.getAll());
    const items = [];
    for (const r of rows) {
      items.push({ kind: r.kind, label: r.label, hint: r.hint, value: await openItem(DEK, r) });
    }
    const theirs = await crypto.subtle.importKey("raw", unb64(receiverKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const mine = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirs }, mine.privateKey, 256));
    const salt = rand(16);
    const mat = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("xurface.vault.transfer") },
      mat, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify({ v: 1, items })));
    armAutoLock();
    return {
      count: items.length,
      envelope: { alg: "ecdh-p256-hkdf-sha256-aes256gcm", ephemeral: b64(await crypto.subtle.exportKey("raw", mine.publicKey)),
                  salt: b64(salt), iv: b64(iv), ct: b64(ct) },
    };
  },

  /** Put what arrived into this vault. Something already here with the same
   * kind, name and value is not added twice. */
  async importItems(items) {
    if (!DEK) throw new Error("locked");
    const rows = await tx(STORE_ITEMS, "readonly", (s) => s.getAll());
    const have = new Set();
    for (const r of rows) {
      try { have.add(r.kind + "|" + r.label + "|" + stable(await openItem(DEK, r))); } catch {}
    }
    let added = 0;
    for (const it of items) {
      if (!it || !KINDS[it.kind] || !it.value) continue;
      if (have.has(it.kind + "|" + it.label + "|" + stable(it.value))) continue;
      await Vault.put({ kind: it.kind, label: it.label, hint: it.hint, value: it.value });
      added++;
    }
    return { added, skipped: items.length - added };
  },

  /** Hand one value out, once, sealed to the Solution that asked.
   *
   * The Solution's release key is an ECDH P-256 public key it published in its
   * manifest. The value is encrypted to it with an ephemeral key, which is the
   * same construction the push channel uses, so what travels through Horizon
   * is a ciphertext Horizon cannot read. No release key, no release: a
   * Solution that has not published one is refused rather than quietly served
   * in the clear. */
  async release(id, { solutionUid, publicKey, field }) {
    if (!DEK) throw new Error("locked");
    if (!publicKey) throw new Error("no-release-key");
    const value = await Vault.reveal(id);
    const rec = await tx(STORE_ITEMS, "readonly", (s) => s.get(id));
    const payload = field ? { [field]: value[field] } : value;

    const theirs = await crypto.subtle.importKey("raw", unb64(publicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
    const mine = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: theirs }, mine.privateKey, 256));
    const salt = rand(16);
    const material = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("xurface.vault.release") },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const iv = rand(12);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(payload)));

    rec.usedAt = Date.now();
    await tx(STORE_ITEMS, "readwrite", (s) => s.put(rec));
    armAutoLock();
    return {
      alg: "ecdh-p256-hkdf-sha256-aes256gcm",
      ephemeral: b64(await crypto.subtle.exportKey("raw", mine.publicKey)),
      salt: b64(salt), iv: b64(iv), ct: b64(ct), solution: solutionUid,
    };
  },

  /** Take it all away. Used when somebody signs out of a shared device, and
   * when a person decides they are done with the feature. */
  async destroy() {
    DEK = null;
    clearTimeout(lockTimer);            // nothing left to lock
    await tx(STORE_ITEMS, "readwrite", (s) => s.clear());
    await tx(STORE_META, "readwrite", (s) => s.clear());
    Vault._meta = null; Vault._count = 0;
    emit();
  },
};

/** Something recognisable that is not the secret itself. */
function hintFor(kind, value) {
  if (kind === "card" && value.number) return "ending " + String(value.number).replace(/\D/g, "").slice(-4);
  if (kind === "login" && value.username) return String(value.username);
  if (kind === "wifi" && value.network) return String(value.network);
  return "";
}

window.Vault = Vault;

})();
