/* Discern - the app.
 *
 * One responsive web app, wrapped by Capacitor for Android and iOS and by
 * Electron for desktop. It talks to a real Horizon (same origin when served at
 * /app; test or live chosen by the x-xurface-env header).
 *
 * Three states, all real:
 *   connected  - live Horizon, everything current
 *   degraded   - Horizon unreachable, last known view from cache, decisions
 *                queued and replayed in order when the link returns
 *   demo       - Horizon never reached, a local engine running the same
 *                scoring model so the flow can still be tried
 */
"use strict";

const { t, tn, tAgo, tSpan, tWhen, tList, tCat, tSev, tWhy, isRTL, LANGS } = window.I18N;
const Net = window.Net;

/* ---------------- icons ---------------- */
const MK = `<svg class="mk" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path class="wave" d="M 28 160 C 59.9 160, 54.1 96, 86 96 C 117.9 96, 112.1 160, 144 160 C 160 160, 166 156, 166 128"/><circle cx="200" cy="128" r="34"/></svg>`;
const I = {
  inbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h5l1.5 3h5L16 12h5"/><path d="M5 12l1.8-6.5A2 2 0 0 1 8.7 4h6.6a2 2 0 0 1 1.9 1.5L19 12v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/></svg>`,
  activity:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3.5l2 6 3.5-13 2.5 9 1.8-4H21"/></svg>`,
  solutions:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></svg>`,
  settings:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v2.2M12 19.2v2.2M4.5 4.5l1.6 1.6M17.9 17.9l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.5 19.5l1.6-1.6M17.9 6.1l1.6-1.6"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.8 5.7 2 6H4c.2-.3 2-1.5 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  face:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9.2 10v1.2M14.8 10v1.2M12 9.5v3l-1 1M9 15c1.2 1 4.8 1 6 0"/></svg>`,
  logo:`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.4" height="7.4" rx="1.8"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="1.8"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="1.8"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="1.8"/></svg>`,
  chevron:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5 10-11"/></svg>`,
  pause:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 5v14M15 5v14"/></svg>`,
  play:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4l13 8-13 8z"/></svg>`,
  cloudoff:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M7.5 18h9.2a3.8 3.8 0 0 0 .8-7.5A6 6 0 0 0 8.2 7.4"/><path d="M5.8 9.4A3.8 3.8 0 0 0 6.5 18"/></svg>`,
  sync:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-13.7-5.3L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 13.7 5.3L20 16"/><path d="M20 20v-4h-4"/></svg>`,
  eye:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.6 12S6 5.6 12 5.6 21.4 12 21.4 12 18 18.4 12 18.4 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 6A9.9 9.9 0 0 1 12 5.9c6 0 9.4 6.1 9.4 6.1a17 17 0 0 1-3.3 4"/><path d="M6.2 7.9A16.6 16.6 0 0 0 2.6 12S6 18.1 12 18.1a9.6 9.6 0 0 0 4-.86"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>`,
  back:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H7.5"/><path d="M12.5 6.5 7 12l5.5 5.5"/></svg>`,
  reflect:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 0 1 14.5-6"/><path d="M18.5 3.4V6.6h-3.2"/><path d="M20.5 12a8.5 8.5 0 0 1-14.5 6"/><path d="M5.5 20.6v-3.2h3.2"/></svg>`,
  stop:`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2"/></svg>`,
  at:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.7a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/></svg>`,
  person:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/></svg>`,
  work:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.2" y="8.4" width="17.6" height="11.4" rx="2"/><path d="M8.6 8.4V6.2a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v2.2"/><path d="M3.2 13.2h17.6"/></svg>`,
  globe:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3.5 9h17M3.5 15h17"/><path d="M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>`,
};

/* ---------------- risk model (used for the demo engine + labels) --------- */
const SEVS = ["LOW","MEDIUM","HIGH","SEVERE"], ORD = {LOW:0,MEDIUM:1,HIGH:2,SEVERE:3};
const maxSev=(a,b)=>ORD[a]>=ORD[b]?a:b, gt=(a,b)=>ORD[a]>ORD[b], bump=s=>SEVS[Math.min(3,ORD[s]+1)];
const CAT_KEYS = ["identity","financial","location","intellectual","conversation","data","system"];
const DEFAULT_APPETITE = {identity:"LOW",financial:"LOW",location:"MEDIUM",intellectual:"LOW",conversation:"MEDIUM",data:"MEDIUM",system:"LOW"};
const RULES = [
  [/(password|passkey|2fa|mfa|otp|credential|secret|token|scope|permission|\brole\b|grant|consent|login|sign[-_ ]?in|oauth|authn|authz|authoriz\w*|\bauth\b)/i,"identity","HIGH"],
  [/(revoke|deprovision|disable[-_ ]?account|reset[-_ ]?password|rotate[-_ ]?key)/i,"identity","SEVERE"],
  [/(pay|payment|purchase|buy|checkout|invoice|transfer|wire|remit|refund|charge|payout|withdraw|trade|invest|order)/i,"financial","HIGH"],
  [/(spend|budget|subscribe|billing)/i,"financial","MEDIUM"],
  [/(location|gps|geo|geofence|coordinates|whereabouts|address|itinerary|travel|track)/i,"location","MEDIUM"],
  [/(publish|release|\bpost\b|tweet|patent|copyright|proprietary|licen[cs]e|contract|\bsign\b|repository|source[-_ ]?code|manuscript)/i,"intellectual","HIGH"],
  [/(document|draft|write|author|generate[-_ ]?doc)/i,"intellectual","MEDIUM"],
  [/(send|reply|email|message|\bdm\b|sms|\bcall\b|contact|reach[-_ ]?out|notify|comment|respond)/i,"conversation","MEDIUM"],
  [/(broadcast|mass[-_ ]?email|campaign|announce)/i,"conversation","HIGH"],
  [/(\bread\b|\blist\b|search|fetch|export|download|share|access|scrape|sync)/i,"data","MEDIUM"],
  [/(delete|destroy|drop|wipe|erase|purge|remove[-_ ]?all)/i,"system","SEVERE"],
  [/(deploy|release|rollback|force[-_ ]?push|config|infrastructure|migrate|scale|provision|restart|shutdown)/i,"system","HIGH"],
];
const ESC = /(\ball\b|bulk|mass|every(one|body)?|permanent|irreversible|production|prod\b)/i;
function score(key, desc, dev){
  const text = `${key} ${desc||""}`, esc = ESC.test(text), risk={};
  for (const [re,c,s] of RULES) if (re.test(text)) risk[c]=maxSev(risk[c]||"LOW", esc?bump(s):s);
  if (!Object.keys(risk).length) risk.data="LOW";
  if (dev) for (const c of Object.keys(dev)) risk[c]=maxSev(risk[c]||"LOW", dev[c]);
  return {risk, severity:Object.values(risk).reduce((m,s)=>maxSev(m,s),"LOW")};
}
function reconcile(risk, severity, appetite, policy){
  if (severity==="SEVERE") return {allow:false, reasons:[t("why.severe")]};
  if (policy==="always") return {allow:false, reasons:[t("why.always")]};
  const reasons=[];
  for (const c of Object.keys(risk)){ const tol=appetite[c]||DEFAULT_APPETITE[c]||"LOW";
    if (gt(risk[c],tol)) reasons.push(t("why.above",{cat:tCat(c),got:tSev(risk[c]),want:tSev(tol)})); }
  return reasons.length ? {allow:false, reasons} : {allow:true, reasons:[t("why.within")]};
}

/* ---------------- config + state ---------------- */
const DEVICES = {
  apple:{label:"Apple",phone:{name:"iPhone 15",w:390,h:844,cam:"notch"},tablet:{name:"iPad Air",w:834,h:1112,cam:"none"},laptop:{name:"MacBook",w:1280,h:820,cam:"none"}},
  android:{label:"Android",phone:{name:"Pixel 8",w:412,h:892,cam:"hole"},tablet:{name:"Galaxy Tab",w:800,h:1220,cam:"hole"},laptop:{name:"Chromebook",w:1280,h:800,cam:"none"}},
  windows:{label:"Windows",phone:{name:"Surface Duo",w:400,h:860,cam:"none"},tablet:{name:"Surface Pro",w:912,h:1240,cam:"none"},laptop:{name:"Surface Laptop",w:1366,h:820,cam:"none"}},
};
/* Where Horizon lives. On the web the app is served by Horizon itself, so the
 * same origin is right. Inside the native shell the page comes from the app
 * bundle (https://localhost), so it has to be told the real host. ?api= beats
 * both, which is how a build gets pointed at a different Horizon. */
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
/** Both axes travel as comma separated lists. An empty list is not sent at
 * all, because asking for nothing in particular means asking for everything. */
const filterQuery = () => {
  const f = S.filter, q = [];
  if (f.solutions.length) q.push(`solution=${f.solutions.map(encodeURIComponent).join(",")}`);
  if (f.severities.length) q.push(`severity=${f.severities.join(",")}`);
  return q.length ? `&${q.join("&")}` : "";
};
// Activity is a record of answers. Anything still waiting is the inbox's job,
// and showing it in both places made the second one look like a broken copy.
const DECIDED = "&state=approved,denied,reflected,edited";
const ANSWERED = new Set(["approved", "denied", "reflected", "edited"]);
const BASE = new URLSearchParams(location.search).get("api")
  || (NATIVE ? (window.XURFACE_API || "https://xurface.500xlaunch.com") : location.origin);
// The environment key is an API contract and stays "test" on the wire. What a
// person reads is Beta, because that is what it is to them.
const ENVS = { test:{ label:()=>t("env.beta") }, live:{ label:()=>t("set.live") } };
const PAGE = 25;

let S = loadPrefs();
function loadPrefs(){
  let p; try{ p = JSON.parse(localStorage.getItem("discern.prefs")||"null"); }catch{ p=null; }
  // live is what a person gets; test is opt in from Settings and shows a chip
  const base = { env:"live", plat:"apple", form:"phone", theme:"system", lang:null,
    fullscreen: !matchMedia("(min-width:900px)").matches, token:null, user:null,
    // the lock is per device, so how it is set lives with the prefs
    lockMode:"off", lockCred:null, pinSalt:null, pinHash:null,
    // addresses used on this device, so nobody retypes one on a phone keyboard
    recent:[],
    // what the person chose to look at, which outlives the screen they chose
    // it on. Empty lists mean everything, which is what All is.
    filter:{ solutions:[], severities:[] } };
  const s = Object.assign(base, p||{});
  // an older build stored one value per axis rather than a list
  if (!Array.isArray(s.filter && s.filter.solutions)) {
    const was = s.filter || {};
    s.filter = { solutions: was.solution ? [was.solution] : [], severities: was.severity ? [was.severity] : [] };
  }
  return Object.assign(s, { view:"inbox", mode:"connecting", ready:false,
    intents:[], timeline:[], solutions:[], catalog:[],
    inboxNext:null, inboxTotal:0, tlNext:null, tlTotal:0, loadingMore:false,
    selectedSol:null, review:null, reviewData:null,
    push:{ supported:"serviceWorker" in navigator && "PushManager" in window, permission:
      (typeof Notification!=="undefined" ? Notification.permission : "default"), on:false, busy:false },
    // the lock is cleared once per launch, so reopening the app asks again
    // while moving between screens does not
    locked:false, lockBusy:false, pinEntry:"", pinSetup:null,
    health:{ reachable:true, ok:true, audit_ok:null, why:"" },
    detail:null, moreBusy:false, drop:null, ask:null, scrollTop:0,
    // which agent groups and which individual actions are unfolded
    open:{ g:{}, a:{} },
    summary:null, focus:null, confirm:null, envAsk:false, solAgent:null,
    // sign in walks: identifier, then a password or a name, never both at once
    signin:{ step:"id", id:"", busy:false, error:"",
             // the field decides for itself which of the two it is holding
             kind:"empty", iso:(window.Phone ? window.Phone.detect() : "US"), picker:false, search:"",
             pw:"", showPw:false },
    envAcked:false,
    net:Net.state, settled:{} });
}
function savePrefs(){ try{ localStorage.setItem("discern.prefs", JSON.stringify({
  env:S.env,plat:S.plat,form:S.form,theme:S.theme,lang:S.lang,fullscreen:S.fullscreen,
  token:S.token,user:S.user,envAcked:S.envAcked,lockMode:S.lockMode,lockCred:S.lockCred,
  pinSalt:S.pinSalt,pinHash:S.pinHash,recent:S.recent,filter:S.filter})); }catch{} }
function applyTheme(){ const q=new URLSearchParams(location.search).get("theme"); const th=q||S.theme;
  if (th==="light"||th==="dark") document.documentElement.dataset.theme=th; else delete document.documentElement.dataset.theme; }

/* ---------------- getting back in without a network ----------------
 *
 * Signing in normally is a question for the server: it holds the accounts. But
 * a person on a plane who signed in last week is not a stranger, and making
 * them wait for a signal to read their own cached inbox is the kind of thing
 * that makes an app feel like a website.
 *
 * So a successful sign in leaves a sealed record behind: the identifier, the
 * password stretched through the same PBKDF2 work factor as the PIN, and the
 * session it produced. Offline, the typed password is stretched again and
 * compared. Nothing here is a security boundary against someone holding the
 * phone with the screen unlocked, and it is not meant to be: the server still
 * decides what the session may do the moment there is a network again. It is a
 * way to reopen a door this device has already opened.
 *
 * The review account is deliberately left out. A reviewer is checking what the
 * live service does, so their sign in always goes to the service. */
const VAULT_KEY = "discern.vault";
const REVIEW_ID = "test@500xlaunch.com";
const normId = (x) => String(x || "").trim().toLowerCase();

const Vault = {
  all(){ try { return JSON.parse(localStorage.getItem(VAULT_KEY)) || {}; } catch { return {}; } },
  read(env, identifier){
    const r = this.all()[env || S.env];
    return r && (!identifier || r.id === normId(identifier)) ? r : null;
  },
  /** Remembered after a real sign in, never instead of one. */
  async keep(identifier, password){
    const id = normId(identifier);
    if (!S.token || id === REVIEW_ID) return;
    const rec = { id, token:S.token, user:S.user, at:Date.now(), salt:null, hash:null };
    if (password) { rec.salt = b64(rand(16)); rec.hash = await pinHash(password, rec.salt); }
    else { const was = this.read(S.env, id); if (was) { rec.salt = was.salt; rec.hash = was.hash; } }
    const all = this.all(); all[S.env] = rec;
    try { localStorage.setItem(VAULT_KEY, JSON.stringify(all)); } catch {}
  },
  async verify(identifier, password){
    const r = this.read(S.env, identifier);
    if (!r || !r.salt || !r.hash) return false;
    return (await pinHash(password, r.salt)) === r.hash;
  },
  /** Hand the remembered session back to the app. */
  restore(identifier){
    const r = this.read(S.env, identifier);
    if (!r) return false;
    S.token = r.token; S.user = r.user; savePrefs();
    return true;
  },
  forget(env){ const all = this.all(); delete all[env || S.env];
    try { localStorage.setItem(VAULT_KEY, JSON.stringify(all)); } catch {} },
};

/* ---------------- backend ---------------- */
const Backend = {
  async probe(){
    const h = await Net.health();
    S.health = h;
    if (h.reachable && h.ok) { Net.goOnline(); S.mode = "connected"; return true; }
    const cached = Net.cache.read(S.env);
    // a remembered sign in counts as much as a cached view: either one means
    // this device has something real to show, so it opens degraded and not in demo
    S.mode = (cached && (S.token || Vault.read(S.env))) ? "degraded" : "demo";
    if (S.mode === "demo") Local.seed(); else Net.goOffline();
    return false;
  },
  /** Sign in to an account that exists. Throws 404 when it does not, which is
   * how the app knows to ask who this person is. */
  async login(identifier, password){
    if (S.mode==="demo") return Local.login(identifier);
    // no server to ask: the device answers for itself if it has been here
    if (S.mode!=="connected" && normId(identifier) !== REVIEW_ID) {
      if (!password) { const e=new Error("password"); e.status=401; throw e; }
      if (await Vault.verify(identifier, password)) { Vault.restore(identifier); return; }
      const e = new Error(t("signin.offlineNo")); e.status = 401; throw e;
    }
    const out = await Net.request("POST","/v1/user/login",{identifier,password},{auth:false});
    S.token = out.token; S.user = out.user; savePrefs();
    await Vault.keep(identifier, password);
  },
  async register(identifier, name){
    if (S.mode==="demo") return Local.login(identifier,name);
    const out = await Net.request("POST","/v1/user/register",{identifier,name},{auth:false});
    S.token = out.token; S.user = out.user; savePrefs();
    await Vault.keep(identifier, null);
  },
  /** First page of everything. Falls back to the cached view, then to demo. */
  async refresh(){
    if (S.mode==="demo") return Local.refresh();
    try {
      const [inbox, timeline, sols, cat] = await Promise.all([
        Net.request("GET",`/v1/user/inbox?limit=${PAGE}${filterQuery()}`),
        Net.request("GET",`/v1/user/timeline?limit=${PAGE}${DECIDED}`),
        Net.request("GET","/v1/user/solutions"),
        Net.request("GET","/v1/user/solutions/search?q="),
      ]);
      S.intents = inbox.intents; S.inboxNext = inbox.next||null; S.inboxTotal = inbox.total ?? inbox.intents.length;
      S.timeline = timeline.intents; S.tlNext = timeline.next||null; S.tlTotal = timeline.total ?? timeline.intents.length;
      S.solutions = sols.solutions;
      Backend.summary().then((sm)=>{ S.summary = sm; const el=document.querySelector(".sevbar"); if (el||sm) render(); });
      const linked = new Set(S.solutions.map(s=>s.uid));
      S.catalog = cat.solutions.filter(s=>!linked.has(s.uid));
      S.mode = "connected";
      Net.cache.write(S.env, { intents:S.intents, timeline:S.timeline, solutions:S.solutions, catalog:S.catalog,
        inboxTotal:S.inboxTotal, tlTotal:S.tlTotal });
    } catch (e) {
      if (!(e instanceof window.NetworkError)) throw e;
      const c = Net.cache.read(S.env);
      if (c) { Object.assign(S, { intents:c.intents||[], timeline:c.timeline||[], solutions:c.solutions||[],
        catalog:c.catalog||[], inboxTotal:c.inboxTotal||0, tlTotal:c.tlTotal||0, inboxNext:null, tlNext:null, mode:"degraded" }); }
      else { S.mode="demo"; Local.seed(); await Local.refresh(); }
    }
  },
  async decideMany(decision, ids){
    if (S.mode === "demo") { for (const id of ids) await Local.decide(id, decision === "approve" ? "approve" : decision); return { decided: ids.length, skipped: [] }; }
    return Net.request("POST", "/v1/user/inbox/decide", { decision, ids });
  },
  async summary(){
    if (S.mode === "demo") return null;
    try { return await Net.request("GET", "/v1/user/inbox/summary"); } catch { return null; }
  },
  async more(which){
    if (S.mode!=="connected") return;
    const cur = which==="inbox" ? S.inboxNext : S.tlNext;
    if (!cur) return;
    const path = which==="inbox" ? "/v1/user/inbox" : "/v1/user/timeline";
    const q = which==="inbox" ? filterQuery() : DECIDED;
    const out = await Net.request("GET",`${path}?limit=${PAGE}&cursor=${encodeURIComponent(cur)}${q}`);
    if (which==="inbox"){ S.intents = S.intents.concat(out.intents); S.inboxNext = out.next||null; S.inboxTotal = out.total ?? S.inboxTotal; }
    else { S.timeline = S.timeline.concat(out.intents); S.tlNext = out.next||null; S.tlTotal = out.total ?? S.tlTotal; }
  },
  /** A decision must never be lost: durable() sends it now or queues it. */
  async decide(id, decision, opts){
    if (S.mode==="demo") { await Local.decide(id,decision,opts); return true; }
    return Net.durable({ method:"POST", path:`/v1/user/intents/${id}/decide`, body:{decision,...opts}, intentId:id });
  },
  async setAppetite(link, appetite){
    if (S.mode==="demo") return Local.setAppetite(link,appetite);
    return Net.durable({ method:"POST", path:`/v1/user/links/${link}/appetite`, body:{appetite} });
  },
  async setStatus(link, status){
    if (S.mode==="demo") return Local.setStatus(link,status);
    return Net.durable({ method:"POST", path:`/v1/user/links/${link}/status`, body:{status} });
  },
  async profile(uid){ if (S.mode==="demo") return Local.profile(uid); return Net.request("GET",`/v1/user/solutions/${uid}/profile`); },
  async connect(uid){ if (S.mode==="demo") return Local.connect(uid); return Net.request("POST",`/v1/user/solutions/${uid}/connect`); },
};

/* demo engine: the same flow, in memory, using the real scoring model */
const Local = (()=>{
  const CATALOG = [
    {uid:"battlemate",slug:"battlemate",name:"BattleMate",description:"Competitive intelligence, on watch. Writes a KPI brief and delivers it to your team.",
     agents:[["intel-scout","Intel Scout",[["sources.fetch","Fetch public pages and pricing"],["signals.collect","Read and normalize market signals"]]],["analyst","Analyst",[["metrics.compute","Compute KPIs from signals"],["report.compose","Author the competitive brief"]]],["courier","Courier",[["report.broadcast","Broadcast the brief to the whole team by email and WhatsApp",{conversation:"HIGH"},"always"],["budget.spend","Buy a premium data source",{financial:"HIGH"}]]]]},
    {uid:"freeleap",slug:"freeleap",name:"FreeLeap",description:"Your freelance career, always lining up the next mission. Evolves your CV and applies for you.",
     agents:[["cv-smith","CV Smith",[["cv.update","Update the evolving CV document"],["cv.publish","Publish the CV to the public portfolio",null,"always"]]],["scout","Scout",[["jobs.search","Search job boards for the next mission"]]],["applicant","Applicant",[["job.apply","Submit a job application on your behalf",{conversation:"HIGH",intellectual:"HIGH"}]]]]},
    {uid:"devbot",slug:"devbot",name:"Coding Agent",description:"Reads, tests and ships to staging on its own. Force-push, prod deploy and drops ask you.",
     agents:[["coding-agent","Coding Agent",[["repo.read","Read files in the working tree"],["test.run","Run the test suite"],["deploy.staging","Deploy the build to staging"],["repo.force_push","Force-push a branch",null,"always"],["deploy.production","Deploy the API to production"],["db.table_drop","Drop a database table"]]]]},
    {uid:"finbot",slug:"finbot",name:"Finance Assistant",description:"Categorizes expenses freely. Every dollar out is your call.",
     agents:[["finance-assistant","Finance Assistant",[["expense.categorize","Categorize an expense"],["pay.invoice","Pay an invoice"],["funds.transfer","Transfer funds to a payee"]]]]},
  ];
  const st = { seeded:false, links:{}, intents:[], timeline:[], seq:0 };
  const id=p=>`${p}_${(st.seq++).toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const hash=()=>Array.from({length:8},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
  const sample=k=>{ k=k.toLowerCase();
    if(/pay|invoice|transfer|refund/.test(k))return{amount:2400,currency:"USD",to:"acme-invoicing"};
    if(/spend|budget|buy/.test(k))return{amount:900,currency:"USD",vendor:"PremiumIntel"};
    if(/broadcast/.test(k))return{recipients:3,channels:["email","whatsapp"]};
    if(/reply|send|email|message/.test(k))return{to:"recruiter@acme.co",text:"Yes, that works."};
    if(/deploy/.test(k))return{service:"api",target:k.includes("prod")?"production":"staging"};
    if(/publish/.test(k))return{site:"portfolio.example.com"}; if(/apply/.test(k))return{company:"Lumen Labs",rate_usd_day:780};
    if(/drop|delete/.test(k))return{target:"invoices"}; return{}; };
  function catOf(uid){ return CATALOG.find(c=>c.uid===uid); }
  function sol(uid){ const c=catOf(uid); const agents=c.agents.map(([id2,name,abs])=>({id:id2,name,abilities:abs.map(([key,desc,dev,disc])=>({key,kind:"capability",description:desc,discernment:disc||"auto",...score(key,desc,dev)}))})); return {uid,name:c.name,description:c.description,agents}; }
  return {
    /** Demo mode used to open on an empty app, which reads as broken rather
     * than as a demo. Two solutions are connected up front so the first screen
     * is the thing the product is, with real scoring behind it. */
    seed(){ if (st.seeded) return; st.seeded=true;
      this.connect("battlemate"); this.connect("freeleap"); },
    async login(email,name){ S.token="local"; S.user={id:"usr_local",email,name:name||"You"}; savePrefs(); },
    async refresh(){
      const f = S.filter || { solutions:[], severities:[] };
      const keep = st.intents.filter((i) =>
        (!f.solutions.length || f.solutions.includes(i.sol)) &&
        (!f.severities.length || f.severities.includes(i.severity)));
      S.intents = keep.slice(0,PAGE); S.inboxNext=null; S.inboxTotal=keep.length;
      S.timeline = st.timeline.slice(0,PAGE); S.tlNext=null; S.tlTotal=st.timeline.length;
      S.solutions = Object.keys(st.links).map(uid=>{ const s=sol(uid); const l=st.links[uid]; return {uid,name:s.name,description:s.description,link:l.link,status:l.status,appetite:l.appetite,matched_by:"connect",
        agents:s.agents.map(a=>({name:a.name,description:"",abilities:a.abilities.map(ab=>({key:ab.key,kind:ab.kind,severity:ab.severity,risk:ab.risk}))}))}; });
      S.catalog = CATALOG.filter(c=>!st.links[c.uid]).map(c=>({uid:c.uid,name:c.name,description:c.description,agents:c.agents.map(a=>({name:a[1]}))}));
    },
    async profile(uid){ const s=sol(uid); const l=st.links[uid];
      const appetite = l ? l.appetite : {...DEFAULT_APPETITE};
      const asks=[], runs=[];
      for (const a of s.agents) for (const ab of a.abilities){
        const v=reconcile(ab.risk,ab.severity,appetite,ab.discernment);
        const e={agent:a.name,key:ab.key,kind:ab.kind,description:ab.description,severity:ab.severity,risk:ab.risk,discernment:ab.discernment,why:v.reasons};
        (v.allow?runs:asks).push(e);
      }
      return {solution:{uid,name:s.name,description:s.description},connected:!!l,appetite,asks,runs,
        counts:{agents:s.agents.length,abilities:asks.length+runs.length,asks:asks.length,runs:runs.length}}; },
    async connect(uid){ const s=sol(uid); const link=id("lnk"); st.links[uid]={link,status:"active",appetite:{...DEFAULT_APPETITE,...(uid==="battlemate"||uid==="freeleap"?{intellectual:"HIGH",data:"HIGH"}:uid==="devbot"?{system:"HIGH"}:{})}};
      let pending=0, nth=0; for (const a of s.agents) for (const ab of a.abilities){ const v=reconcile(ab.risk,ab.severity,st.links[uid].appetite,ab.discernment); const rec={id:id("int"),solName:s.name,solution:{uid,name:s.name,slug:catOf(uid).slug},agent:a.name,capability:ab.key,details:sample(ab.key),risk:ab.risk,severity:ab.severity,reasons:v.reasons,discernment:ab.discernment,appetite:st.links[uid].appetite,at:Date.now()-(nth++)*17*60000,hash:hash(),sol:uid,link}; if (v.allow){ rec.state="allowed"; st.timeline.unshift(rec);} else { rec.state="pending"; st.intents.unshift(rec); pending++; } }
      return {ok:true,pending}; },
    async decide(id2,decision,opts){ const i=st.intents.findIndex(x=>x.id===id2); if(i<0)return; const it=st.intents.splice(i,1)[0];
      it.state = decision==="deny" ? "denied" : decision==="reflect" ? "reflected"
        : (opts&&opts.edited_details) ? "edited" : "approved";
      it.decision = { decision, at: Date.now() }; if(opts&&opts.edited_details)it.details={...it.details,...opts.edited_details}; it.decidedAt=Date.now(); it.hash=hash(); st.timeline.unshift(it); },
    async setAppetite(link,ap){ for(const u in st.links) if(st.links[u].link===link) Object.assign(st.links[u].appetite,ap); },
    async setStatus(link,stt){ for(const u in st.links) if(st.links[u].link===link) st.links[u].status=stt; },
  };
})();

/* ---------------- helpers ---------------- */
const sevColor=s=>({LOW:"var(--lo)",MEDIUM:"var(--me)",HIGH:"var(--hi)",SEVERE:"var(--sv)"}[s]||"var(--me)");
const sevBg=s=>({LOW:"var(--lo-bg)",MEDIUM:"var(--me-bg)",HIGH:"var(--hi-bg)",SEVERE:"var(--sv-bg)"}[s]||"var(--me-bg)");
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pretty=c=>String(c||"").replace(/[._]/g," ").replace(/\b\w/g,x=>x.toUpperCase());
const iName = it => (it.solution && it.solution.name) || it.solName || t("app.short");
const iAgent = it => (it.agent && it.agent.name) || it.agent || "";
const iAt = it => it.created_at || it.at || it.decidedAt;
const iRef = it => String(it.hash || it.id || "").slice(-8);
const stateLabel = st => t(`ist.${st}`) !== `ist.${st}` ? t(`ist.${st}`) : st;
const linkLabel  = st => t(`st.${st}`)  !== `st.${st}`  ? t(`st.${st}`)  : st;
function surfaces(sol){
  const cats=new Set();
  for (const a of sol.agents||[]) for (const ab of a.abilities||[]){ const ap=sol.appetite||DEFAULT_APPETITE;
    for (const [c,s] of Object.entries(ab.risk||{})) if (gt(s, ap[c]||DEFAULT_APPETITE[c]||"LOW")||ab.severity==="SEVERE") cats.add(c); }
  return [...cats];
}

/* ---------------- boot ---------------- */
async function boot(){
  const q = new URLSearchParams(location.search);
  S.lang = window.I18N.setLang(window.I18N.pickLang(S.lang));
  if (q.get("env") === "test" || q.get("env") === "live") S.env = q.get("env");
  if (q.get("view")) S.view = q.get("view");
  applyTheme();
  if (!q.get("nosplash")) playSplash();
  render();

  Net.start({ base:BASE, env:()=>S.env, token:()=>S.token,
    onReplayed:(n)=>{ toast(`<span class="tic">${I.sync}</span><div class="tm">${esc(t("net.back"))}. ${esc(tn("net.queued",n))}</div>`,"ok"); silentRefresh(); } });
  Net.subscribe((st)=>{ const was=S.net.link; S.net=st;
    if (st.link==="online" && was!=="online" && was!=="unknown"){ S.mode="connected"; silentRefresh(); }
    paintNet(); });

  // the lock decision is made once per launch, before anything is shown
  S.locked = !!(S.token && lockOn() && lockOffered());
  armLockOnResume();

  await Backend.probe();
  // ?email= opens straight into the app, registering first if that address is
  // new. It is how the screenshot tooling and a shared link both work.
  if (!S.token && q.get("email")) {
    try { await Backend.login(q.get("email")); }
    catch (e) {
      if (e.status === 404) { try { await Backend.register(q.get("email"), q.get("name")||undefined); } catch {} }
    }
  }
  if (S.token){ try{ await Backend.refresh(); }catch(e){ if (e.status===401){ S.token=null; S.user=null; savePrefs(); } } }
  S.ready = true; render();

  // hold the launch animation, then reveal whatever comes next. ?nosplash=1
  // skips it, which is what the screenshot tooling uses.
  // the sheet waits for the animation rather than landing on top of it
  setTimeout(() => {
    maybeAskEnv(); render();
    // the sign in screen carries its own notice, so this is for the case where
    // the app opened straight into a session that cannot reach anything
    if (S.token) {
      if (!S.health.reachable) toast(`<span class="tic">${I.cloudoff}</span><div class="tm">${esc(t("net.offlineIn"))}</div>`,"warn");
      else if (S.health.why) toast(`<span class="tic">${I.shield}</span><div class="tm">${esc(t("net.degraded"))}</div>`,"warn");
    }
  }, q.get("nosplash") ? 0 : 1500);

  // deep links: ?review= the permission label before connecting, ?solution= a
  // connected solution's settings. Both are how a notification tap lands you on
  // the right screen rather than the inbox.
  if (q.get("review")) openReview(q.get("review"));
  else if (q.get("solution")) { S.view = "solutions"; S.selectedSol = q.get("solution"); render(); }
  registerSW();
}

/** Refresh without tearing the screen down: no skeletons, no scroll jump. */
async function silentRefresh(){
  if (!S.token) return;
  try { await Backend.refresh(); render(); }
  catch (e) {
    // 401 means this session is not valid here any more. Showing empty screens
    // instead of saying so is how a signed out app looks broken.
    if (e && e.status === 401) { S.token=null; S.user=null; S.locked=false; savePrefs(); render(); }
  }
}

/* The agent's account of itself is written, not spoken.
   It used to be read aloud, and the feature is gone on purpose: this is read
   while someone is being talked to, in a meeting, on a street, which is
   exactly when audio is the wrong medium. What the agent has to say now lands
   as a summary and a line about what happens if the answer is no. */

/* ---------------- screen lock ----------------
   A device level gate, not a second sign in: the session is already valid, so
   this only decides whether this phone will show it. It uses the platform
   authenticator, which is Face ID, Touch ID or the device PIN depending on the
   hardware, through WebAuthn.

   The review account never sees any of it. A store reviewer can enrol no
   biometric, and a lock they cannot open is a failed review. */
/* Who is this, and what should they be shown?
 *
 *   builder   holds a Horizon console account, developer or admin. Beta exists
 *             for them and nobody else.
 *   reviewer  the store review account. No lock, ever.
 *
 * Everyone else sees Live and never learns an environment switch exists. */
const isBuilder = () => !!(S.user && (S.user.role === "developer" || S.user.role === "admin"));
const canSwitchEnv = () => isBuilder();

const lockSupported = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
const isReviewer = () => !!(S.user && S.user.review);
/** The review account is offered no lock of any kind: a store reviewer can
 * enrol no biometric and should not be handed a PIN to remember. */
/** The lock is offered in Live only. A reviewer can enrol nothing, and someone
 * building in Beta is going in and out all day: a lock there costs more than it
 * protects, and the data behind it is test data. */
const lockOffered = () => !isReviewer() && S.env === "live";
const lockOn = () => S.lockMode === "device" || S.lockMode === "pin";
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s2) => { const b=atob(s2.replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from([...b].map(c=>c.charCodeAt(0))); };
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

/** A PIN is stretched before it is stored. It never leaves the device and is
 * never sent anywhere, so this is about a stolen phone, not a stolen database,
 * but four digits deserve the work factor all the same. */
async function pinHash(pin, saltB64){
  const salt = unb64(saltB64);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", salt, iterations:150000, hash:"SHA-256" }, key, 256);
  return b64(bits);
}

async function enableDeviceLock(){
  S.lockBusy = true; render();
  try {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: rand(32),
      rp: { name: "Discern" },
      user: { id: rand(16), name: (S.user&&S.user.email)||"you", displayName: (S.user&&S.user.name)||"You" },
      pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }],
      authenticatorSelection: { authenticatorAttachment:"platform", userVerification:"required", residentKey:"preferred" },
      timeout: 60000, attestation: "none",
    }});
    if (!cred) throw new Error("cancelled");
    S.lockCred = b64(cred.rawId); S.lockMode = "device"; savePrefs();
    toast(`<span class="tic">${I.shield}</span><div class="tm">${esc(t("t.lockOn"))}</div>`,"ok");
  } catch(e){ toast(`<div class="tm">${esc(t("t.lockFail",{msg:e.message||"cancelled"}))}</div>`,"warn"); }
  finally { S.lockBusy=false; render(); }
}

function disableLock(){
  S.lockMode = "off"; S.lockCred = null; S.pinSalt = null; S.pinHash = null;
  S.locked = false; S.pinEntry = ""; S.pinSetup = null; savePrefs(); render();
  toast(`<div class="tm">${esc(t("t.lockOff"))}</div>`,"ok");
}

/** Setting a PIN asks for it twice, which is the only way to catch a typo that
 * would otherwise lock someone out of their own phone. */
function startPinSetup(){ S.pinSetup = { first:"", stage:"first" }; S.pinEntry = ""; render(); }

async function pinDigit(d){
  if (d === "back") { S.pinEntry = S.pinEntry.slice(0, -1); render(); return; }
  if (S.pinEntry.length >= 6) return;
  S.pinEntry += d;
  render();
  if (S.pinEntry.length < 4) return;
  if (S.pinEntry.length === 6) await pinSubmit();
}

async function pinSubmit(){
  const pin = S.pinEntry;
  if (pin.length < 4) { S.signinError = ""; return; }
  if (S.pinSetup) {
    if (S.pinSetup.stage === "first") {
      S.pinSetup = { first: pin, stage: "again" }; S.pinEntry = ""; render(); return;
    }
    if (pin !== S.pinSetup.first) {
      S.pinSetup = { first:"", stage:"first" }; S.pinEntry = "";
      toast(`<div class="tm">${esc(t("t.pinMismatch"))}</div>`,"warn"); render(); return;
    }
    S.lockBusy = true; render();
    S.pinSalt = b64(rand(16));
    S.pinHash = await pinHash(pin, S.pinSalt);
    S.lockMode = "pin"; S.pinSetup = null; S.pinEntry = ""; S.lockBusy = false;
    savePrefs(); render();
    toast(`<span class="tic">${I.shield}</span><div class="tm">${esc(t("t.lockOn"))}</div>`,"ok");
    return;
  }
  // unlocking
  S.lockBusy = true; render();
  const ok = (await pinHash(pin, S.pinSalt)) === S.pinHash;
  S.lockBusy = false; S.pinEntry = "";
  if (ok) { S.locked = false; }
  else toast(`<div class="tm">${esc(t("t.lockDenied"))}</div>`,"warn");
  render();
}

async function unlock(){
  if (S.lockMode === "pin") return;            // the keypad drives that path
  S.lockBusy = true; render();
  try {
    const got = await navigator.credentials.get({ publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type:"public-key", id: unb64(S.lockCred) }],
      userVerification: "required", timeout: 60000,
    }});
    if (!got) throw new Error("cancelled");
    S.locked = false;
  } catch { toast(`<div class="tm">${esc(t("t.lockDenied"))}</div>`,"warn"); }
  finally { S.lockBusy=false; render(); }
}

/** Coming back to the app is the moment the lock is for. A phone does not tell
 * a web view it was killed, so anything that looks like leaving counts:
 * hiding the page, losing focus, or the native shell reporting a pause. */
function armLockOnResume(){
  let left = 0;
  const leaving = () => { left = Date.now(); };
  const returning = () => {
    if (!left) return;
    // a glance at the notification shade should not demand a face; a real
    // departure should. Ten seconds is the line, and it is the same line for
    // replaying the launch animation: coming back should feel like arriving.
    const real = Date.now() - left > 10000;
    left = 0;
    if (!real || !S.token) return;
    playSplash();
    if (lockOn() && lockOffered()) { S.locked = true; S.pinEntry = ""; }
    maybeAskEnv();
    render();
    // what it knows is already cached, so the screen is never blank while this
    // catches up with whatever happened while the app was away
    Net.probe().then((ok) => { if (ok) { Net.goOnline(); S.mode = "connected"; silentRefresh(); } });
  };
  document.addEventListener("visibilitychange", () => (document.hidden ? leaving() : returning()));
  addEventListener("blur", leaving);
  addEventListener("focus", returning);
  try {
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) App.addListener("appStateChange", ({ isActive }) => (isActive ? returning() : leaving()));
  } catch {}
}

/* ---------------- push ---------------- */
async function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    navigator.serviceWorker.addEventListener("message", (e)=>{
      const d=e.data||{};
      if (d.type==="open-intent"){ S.view="inbox"; silentRefresh(); }
      if (d.type==="resubscribe") enablePush(true);
    });
    // the worker renders notifications outside the app, so it needs to be told
    // which language the person picked
    const tellLang = () => reg.active && reg.active.postMessage({ type:"lang", lang: window.I18N.lang });
    tellLang(); navigator.serviceWorker.ready.then(tellLang);
    const sub = await reg.pushManager.getSubscription();
    S.push.on = !!sub;
    if (sub && S.token && S.mode==="connected") await sendSubscription(sub);
    paintNet();
  } catch(e){ /* file:// or an insecure origin: push simply is not available */ }
}
function tellWorkerLang(){
  try { navigator.serviceWorker?.ready?.then(r => r.active?.postMessage({ type:"lang", lang: window.I18N.lang })); } catch {}
}
const b64ToU8 = (s)=>{ const pad="=".repeat((4-s.length%4)%4); const b=atob((s+pad).replace(/-/g,"+").replace(/_/g,"/"));
  return Uint8Array.from([...b].map(c=>c.charCodeAt(0))); };
async function sendSubscription(sub){
  try { await Net.request("POST","/v1/user/devices",{ platform:"web", token:JSON.stringify(sub),
    label: navigator.userAgent.match(/Chrome|Firefox|Safari|Edg/)?.[0] || "Browser" }); } catch {}
}
async function enablePush(silent){
  if (!S.push.supported) return;
  S.push.busy = true; render();
  try {
    const perm = await Notification.requestPermission();
    S.push.permission = perm;
    if (perm !== "granted") throw new Error(t("set.notifyBlocked"));
    const { key, enabled } = await Net.request("GET","/v1/push/vapid-key",null,{auth:false});
    if (!enabled || !key) throw new Error("server has no VAPID key");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:b64ToU8(key) });
    await sendSubscription(sub);
    S.push.on = true;
    if (!silent) toast(`<span class="tic">${I.bell}</span><div class="tm">${esc(t("t.pushOn"))}</div>`,"ok");
  } catch(e){ if (!silent) toast(`<div class="tm">${esc(t("t.pushFail",{msg:e.message}))}</div>`,"warn"); }
  finally { S.push.busy=false; render(); }
}
async function testPush(){
  try { await Net.request("POST","/v1/user/devices/test",{});
    toast(`<span class="tic">${I.bell}</span><div class="tm">${esc(t("t.pushSent"))}</div>`,"ok"); }
  catch(e){ toast(`<div class="tm">${esc(e.message)}</div>`,"warn"); }
}

/* ==================== rendering ==================== */
const NAV = ()=>[["inbox",t("nav.inbox"),I.inbox],["activity",t("nav.activity"),I.activity],
  ["solutions",t("nav.solutions"),I.solutions],["settings",t("nav.settings"),I.settings]];

/** Where the reader was, kept across a redraw.
 *
 * render() replaces the whole tree, so the scroller it hands back is a new
 * element starting at zero. Unfolding one action in a long list would put you
 * back at the top of that list, which is the single most irritating thing a
 * list can do. The position is kept per screen, so moving between screens
 * still starts where a new screen should. */
let lastScreen = null;
const screenKey = () => `${S.view}:${S.selectedSol || ""}:${S.review || ""}:${S.focus ? "1" : ""}`;

function render(){
  const here = screenKey();
  const same = lastScreen === here;
  const was = document.querySelector(".screen-wrap");
  if (was && same) S.scrollTop = was.scrollTop;

  const root = document.getElementById("root");
  root.innerHTML = shellHTML();
  const app = document.getElementById("app-root");
  if (app) app.innerHTML = S.pinSetup ? pinSetupHTML()
                         : S.locked ? lockHTML()
                         : !S.token ? signinHTML() : appHTML();
  applyDevice(); wire(); paintNet(); watchForMore();

  const now = document.querySelector(".screen-wrap");
  if (now) now.scrollTop = same ? (S.scrollTop || 0) : 0;
  if (!same) S.scrollTop = 0;
  lastScreen = here;
}

function shellHTML(){
  if (S.fullscreen) return `<div class="app-fill"><div class="app" id="app-root"></div></div>`;
  const dev = DEVICES[S.plat][S.form];
  return `<div class="studio" data-plat="${S.plat}">
    <div class="studio-bar">
      <span class="studio-brand">${MK}<b>Discern</b><small>preview</small></span>
      <span class="grow"></span>
      <select class="studio-select" data-ctl="lang" aria-label="Language">${LANGS.map(l=>`<option value="${l.code}" ${window.I18N.lang===l.code?"selected":""}>${l.native}</option>`).join("")}</select>
      <select class="studio-select" data-ctl="plat">${Object.entries(DEVICES).map(([k,d])=>`<option value="${k}" ${S.plat===k?"selected":""}>${d.label}</option>`).join("")}</select>
      <select class="studio-select" data-ctl="form">${["phone","tablet","laptop"].map(f=>`<option value="${f}" ${S.form===f?"selected":""}>${DEVICES[S.plat][f].name}</option>`).join("")}</select>
      <button class="studio-select" data-ctl="fullscreen">Fill screen</button>
    </div>
    <div class="stage"><div class="stage-scale"><div class="device ${S.form}" id="device">
      <div class="cam"><div class="${dev.cam==='notch'?'notch':dev.cam==='hole'?'hole':''}"></div></div>
      <div class="screen"><div class="app" id="app-root"></div></div>
      ${S.form==='laptop'?'<div class="notch-base"></div>':''}
    </div></div></div></div>`;
}

function appHTML(){
  const wide = S.form!=="phone" && !S.fullscreen ? true : (S.fullscreen && matchMedia("(min-width:820px)").matches);
  const pending = S.intents.length;
  const nav = NAV();
  return `
  <header class="topbar">${MK}<span class="title">${esc(t("app.short"))}</span>
    ${S.env !== "live" && canSwitchEnv() ? `<button class="envchip ${S.env}" data-toggle-env aria-label="${esc(t("set.env"))}">${esc(ENVS[S.env].label())}</button>` : ""}
    <span class="spacer"></span>
    <button class="iconbtn" data-nav="inbox" aria-label="${esc(t("nav.inbox"))}">${I.bell}${pending?`<span class="count">${pending>9?'9+':pending}</span>`:''}</button>
  </header>
  <div id="netbar"></div>
  <div class="body">
    ${wide?`<nav class="rail">${nav.map(([v,l,ic])=>`<a href="#" data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${esc(l)}</span>${v==="inbox"&&pending?`<span class="railcount">${pending}</span>`:''}</a>`).join("")}<span class="railgrow"></span><div class="railuser">${esc((S.user&&S.user.name)||t("set.you"))}</div></nav>`:''}
    <main class="screen-wrap"><div class="wrap">${!S.ready?skeletonHTML():screenHTML()}</div></main>
  </div>
  ${wide?'':`<nav class="tabbar">${nav.map(([v,l,ic])=>`<button data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${esc(l)}</span>${v==="inbox"&&pending?'<span class="tabdot"></span>':''}</button>`).join("")}</nav>`}
  <div id="overlay">${S.envAsk ? envAskHTML() : S.confirm ? confirmHTML()
    : S.detail ? detailHTML() : S.ask ? askHTML() : ""}</div>`;
}
function screenHTML(){ if (S.focus && S.view === "inbox") return focusHTML();
  return ({inbox:inboxHTML,activity:activityHTML,solutions:solutionsHTML,settings:settingsHTML}[S.view]||inboxHTML)(); }

/* ---- the connection strip: always honest about where the data came from ---- */
function paintNet(){
  const el = document.getElementById("netbar"); if (!el) return;
  const n = S.net, q = n.queue ? n.queue.length : 0;
  let html = "";
  if (S.mode==="demo"){
    html = `<div class="netbar demo"><span class="dot"></span><b>${esc(t("net.demo"))}</b><span class="nsub">${esc(t("net.offlineBody"))}</span></div>`;
  } else if (n.link==="offline" || n.link==="reconnecting" || S.mode==="degraded"){
    const label = n.link==="reconnecting" ? t("net.reconnecting") : t("net.offline");
    html = `<div class="netbar off"><span class="tic">${I.cloudoff}</span><b>${esc(label)}</b>
      <span class="nsub">${esc(q?tn("net.queued",q):t("net.offlineBody"))}</span>
      <button class="nretry" data-retry>${esc(t("net.retry"))}</button></div>`;
  } else if (n.syncing || q){
    html = `<div class="netbar sync"><span class="tic spin">${I.sync}</span><b>${esc(t("net.syncing"))}</b>
      <span class="nsub">${esc(tn("net.queued",q))}</span></div>`;
  }
  el.innerHTML = html;
  el.classList.toggle("has", !!html);
}

/* ---- skeletons: a shape that is about to be filled, not a spinner ---- */
function skeletonHTML(){
  return `<div class="scrhead"><span class="sk sk-eyebrow"></span><span class="sk sk-h1"></span><span class="sk sk-sub"></span></div>
  <div class="cards">${[0,1,2].map(i=>`<article class="icard sk-card" style="--d:${i*90}ms">
    <div class="icard-top"><span class="sk sk-logo"></span><div class="iwho"><span class="sk sk-line w60"></span><span class="sk sk-line w40"></span></div></div>
    <span class="sk sk-line w80 tall"></span>
    <div class="rchips"><span class="sk sk-chip"></span><span class="sk sk-chip"></span></div>
    <div class="iacts"><span class="sk sk-btn"></span><span class="sk sk-btn"></span></div>
  </article>`).join("")}
  <div class="sk-note">${esc(t("boot.connecting"))}</div>`;
}

/* ---- inbox ---- */

/** Narrowing by solution and by risk.
 *
 * Both are lists, because both are things a person holds several of at once:
 * two solutions worth watching this week, anything above medium. Both are sent
 * to the server, so a long inbox is narrowed before it crosses the network
 * rather than after, and both survive leaving the screen and coming back.
 *
 * This used to be a row of chips that scrolled sideways, which is a bad answer
 * on a phone: the chip you want is always the one just off the edge. */
function filterBarHTML(){
  const sols = S.solutions || [];
  const f = S.filter;
  const solName = (uid) => (sols.find((s2) => s2.uid === uid) || {}).name || uid;
  const solLabel = !f.solutions.length ? t("flt.allSol")
    : f.solutions.length === 1 ? solName(f.solutions[0]) : t("flt.chosen", { n: f.solutions.length });
  const sevLabel = !f.severities.length ? t("flt.allRisk")
    : f.severities.length === 1 ? tSev(f.severities[0]) : t("flt.chosen", { n: f.severities.length });

  const box = (on) => `<span class="fbox ${on ? "on" : ""}">${on ? I.check : ""}</span>`;
  const solMenu = `<div class="fmenu" role="listbox">
    <button class="fopt ${!f.solutions.length ? "on" : ""}" data-fsol="">${box(!f.solutions.length)}
      <span class="foptn">${esc(t("flt.allSol"))}</span></button>
    ${sols.map((s2) => `<button class="fopt ${f.solutions.includes(s2.uid) ? "on" : ""}" data-fsol="${esc(s2.uid)}">
      ${box(f.solutions.includes(s2.uid))}${window.Marks.solution(s2, 18)}
      <span class="foptn">${esc(s2.name)}</span></button>`).join("")}
  </div>`;
  const sevMenu = `<div class="fmenu" role="listbox">
    <button class="fopt ${!f.severities.length ? "on" : ""}" data-fsev="">${box(!f.severities.length)}
      <span class="foptn">${esc(t("flt.allRisk"))}</span></button>
    ${["SEVERE","HIGH","MEDIUM","LOW"].map((lv) => `<button class="fopt sev ${f.severities.includes(lv) ? "on" : ""}"
      data-fsev="${lv}" style="--c:${sevColor(lv)};--b:${sevBg(lv)}">
      ${box(f.severities.includes(lv))}<span class="fdot"></span>
      <span class="foptn">${esc(tSev(lv))}</span></button>`).join("")}
  </div>`;

  const drop = (which, label, on, count, menu, extra) => `<div class="fdrop">
    <button class="fbtn ${on ? "on" : ""} ${S.drop === which ? "open" : ""}" data-drop="${which}"
            aria-expanded="${S.drop === which}">
      ${extra || ""}<span class="flab">${esc(label)}</span>
      ${count ? `<span class="fcount">${count}</span>` : ""}
      <span class="fchev">${I.chevron}</span>
    </button>
    ${S.drop === which ? menu : ""}
  </div>`;

  return `<div class="fbar">
    ${drop("sol", solLabel, !!f.solutions.length, f.solutions.length > 1 ? f.solutions.length : 0, solMenu)}
    ${drop("sev", sevLabel, !!f.severities.length, f.severities.length > 1 ? f.severities.length : 0, sevMenu,
      f.severities.length === 1 ? `<span class="fdot" style="--c:${sevColor(f.severities[0])}"></span>` : "")}
    ${(f.solutions.length || f.severities.length) ? `<button class="fclear" data-fclear>${esc(t("flt.clear"))}</button>` : ""}
  </div>`;
}

/** What is waiting, at a glance, before deciding how to face it. Counting by
 * severity is what lets someone act on thirty asks without reading thirty
 * cards: two severe and twenty eight routine is a different morning from
 * thirty severe. */
function summaryHTML(){
  const sum = S.summary;
  if (!sum || sum.total < 2) return "";
  const parts = ["SEVERE","HIGH","MEDIUM","LOW"]
    .filter((lv) => sum.bySeverity[lv])
    .map((lv)=>`<button class="sevcount ${S.filter.severities.includes(lv)?"on":""}" data-fsev="${lv}"
        style="--c:${sevColor(lv)};--b:${sevBg(lv)}"><b>${sum.bySeverity[lv]}</b>${esc(tSev(lv))}</button>`);
  if (!parts.length) return "";
  return `<div class="sevbar">${parts.join("")}</div>`;
}

/** One group per agent, because an agent is who is asking.
 *
 * The same display name can belong to two different solutions, so the group is
 * keyed by both. Inside a group the agent is never named again: everything in
 * there is that agent, and repeating it thirty times is noise that pushes the
 * actual question off the screen. */
function agentGroups(list){
  const by = new Map();
  for (const it of list) {
    const sol = it.solution || { name: iName(it) };
    const name = iAgent(it) || t("grp.unnamed");
    const key = `${sol.uid || "?"}::${name}`;
    if (!by.has(key)) by.set(key, { key, agent: name, agentId: (it.agent && it.agent.id) || null,
      solution: sol, items: [], counts: { LOW:0, MEDIUM:0, HIGH:0, SEVERE:0 }, worst: "LOW", latest: 0 });
    const g = by.get(key);
    g.items.push(it);
    g.counts[it.severity] = (g.counts[it.severity] || 0) + 1;
    g.worst = maxSev(g.worst, it.severity);
    g.latest = Math.max(g.latest, iAt(it) || 0);
  }
  // newest first, which is the order the list was asked to be in
  return [...by.values()].sort((a, b) => b.latest - a.latest);
}

/** The first group is open, the rest are folded. Someone who opens or closes
 * one has said what they want and that is remembered. */
const groupOpen = (g, i) => (S.open.g[g.key] === undefined ? i === 0 : !!S.open.g[g.key]);

/** How the waiting work divides by risk.
 *
 * The bar is only drawn when there is more than one kind, because a bar with a
 * single segment says nothing the chip beside it does not already say and
 * reads like a progress meter, which it is not. */
function breakdownHTML(counts){
  const has = ["SEVERE","HIGH","MEDIUM","LOW"].filter((lv) => counts[lv]);
  if (!has.length) return "";
  const bar = has.length > 1
    ? `<div class="gbar" aria-hidden="true">${has.map((lv) =>
        `<i style="--c:${sevColor(lv)};flex:${counts[lv]}"></i>`).join("")}</div>` : "";
  return `<div class="gbreak">${bar}
    <div class="gtags">${has.map((lv) => `<span class="gtag" style="--c:${sevColor(lv)};--b:${sevBg(lv)}">
      <b>${counts[lv]}</b>${esc(tSev(lv))}</span>`).join("")}</div>
  </div>`;
}

function groupHTML(g, i){
  const M = window.Marks, open = groupOpen(g, i), n = g.items.length;
  const ids = g.items.map((x) => x.id);
  return `<section class="agrp ${open ? "open" : ""}" data-gkey="${esc(g.key)}"
      style="--sev:${sevColor(g.worst)};--sevb:${sevBg(g.worst)}">
    <div class="ghead">
      <span class="gav">${M.agent(g.agent, 44)}</span>
      <div class="gm">
        <button class="gtog" data-gtog="${esc(g.key)}" aria-expanded="${open}">
          <b class="gname">${esc(g.agent)}</b>
          <small class="gcount">${esc(t("cl.waiting", { n }))}</small>
        </button>
        <button class="gsol" data-gosol="${esc(g.solution.uid || "")}" data-goag="${esc(g.agent)}">
          ${M.solution(g.solution, 18)}<span class="gsoln">${esc(g.solution.name || "")}</span>
          <span class="gsolgo">${I.chevron}</span>
        </button>
      </div>
      <button class="gchev" data-gtog="${esc(g.key)}" aria-expanded="${open}"
              aria-label="${esc(t(open ? "act.less" : "act.more"))}">${I.chevron}</button>
    </div>
    ${breakdownHTML(g.counts)}
    ${open ? `<div class="gopen">
      ${n > 1 ? `<div class="gbulk">
        <button class="gb deny" data-gdec="deny" data-gkey="${esc(g.key)}">${esc(t("grp.denyAll"))}</button>
        <button class="gb reflect" data-gdec="reflect" data-gkey="${esc(g.key)}">${esc(t("grp.reflectAll"))}</button>
        <button class="gb approve" data-gdec="approve" data-gkey="${esc(g.key)}">${esc(t("grp.approveAll"))}</button>
      </div>
      <button class="gone" data-gone="${esc(g.key)}">${esc(t("cl.oneByOne"))}${I.chevron}</button>` : ""}
      <div class="glist">${g.items.map(actionRowHTML).join("")}</div>
    </div>` : ""}
  </section>`;
}

/** One action. The agent is not named again: the group above is the agent.
 *
 * Tapping the action opens it in full, which is a sheet rather than a panel
 * because an answer deserves the whole screen. The chevron unfolds it in place
 * for someone who only wants a look without leaving the list. */
function actionRowHTML(it){
  const open = !!S.open.a[it.id], settling = S.settled[it.id], queued = Net.queuedFor(it.id);
  return `<article class="arow ${open ? "open" : ""} ${settling ? "settling " + settling : ""}"
      data-aid="${it.id}" style="--sev:${sevColor(it.severity)};--sevb:${sevBg(it.severity)}">
    <div class="atop">
      <button class="aopen" data-aask="${it.id}">
        <span class="adot"></span>
        <span class="am"><b class="aname">${esc(pretty(it.capability))}</b>
          <small class="awhen">${esc(tAgo(iAt(it)))}</small></span>
      </button>
      <span class="sevtag">${esc(tSev(it.severity))}</span>
      <button class="achev" data-atog="${it.id}" aria-expanded="${open}"
              aria-label="${esc(t(open ? "act.less" : "act.more"))}">${I.chevron}</button>
    </div>
    ${open ? `<div class="abody">${askBodyHTML(it)}
      ${queued ? `<div class="iqueued">${I.cloudoff}<span>${esc(t("card.queued"))}</span></div>`
        : decideRowHTML(it, settling)}</div>` : ""}
  </article>`;
}

/** Everything the agent has to say for itself, in writing.
 * The spoken version is gone: people read this while someone is talking to
 * them, which is exactly when audio is the wrong medium. */
function askBodyHTML(it){
  const risks = Object.entries(it.risk||{}).sort((a,b)=>ORD[b[1]]-ORD[a[1]])
    .map(([c,s2])=>`<span class="rchip" style="--c:${sevColor(s2)};--b:${sevBg(s2)}">${esc(t("risk.chip",{cat:tCat(c),sev:tSev(s2)}))}</span>`).join("");
  const rows = Object.entries(it.details||{}).map(([k,v])=>{
    const editable = (typeof v==="number"||typeof v==="string");
    return `<div class="drow"><span class="dk">${esc(k)}</span>${editable
      ? `<input class="dv-in" data-edit="${it.id}" data-key="${esc(k)}" value="${esc(v)}"/>`
      : `<span class="dv">${esc(Array.isArray(v)?v.join(", "):v)}</span>`}</div>`;
  }).join("");
  const why = tWhy(it, it.appetite, it.reasons)[0];
  const v = it.voice || {};
  return `${why ? `<div class="ireason">${esc(why)}</div>` : ""}
    ${v.summary ? `<p class="whysum">${esc(v.summary)}</p>` : ""}
    ${v.if_blocked ? `<p class="whyblock"><b>${esc(t("card.ifBlocked"))}</b> ${esc(v.if_blocked)}</p>` : ""}
    <div class="rchips">${risks}</div>
    ${rows ? `<div class="idetails">${rows}</div>` : ""}`;
}

function decideRowHTML(it, settling){
  return `<div class="iacts three">
    <button class="btn btn-deny" data-decide="deny" data-id="${it.id}" ${settling?"disabled":""}>${esc(t("card.deny"))}</button>
    <button class="btn btn-reflect" data-decide="reflect" data-id="${it.id}" ${settling?"disabled":""}>${I.reflect}<span>${esc(t("card.reflect"))}</span></button>
    <button class="btn btn-primary" data-decide="approve" data-id="${it.id}" ${settling?"disabled":""}>${esc(t("card.approve"))}</button>
  </div>`;
}

/** An action opened on its own, over everything else.
 * The list behind it can be thirty rows long; a decision should not be made
 * while the thing being decided is half scrolled off the top. */
function askHTML(){
  const it = (S.intents || []).find((x) => x.id === S.ask);
  if (!it) return "";
  const M = window.Marks, sol = it.solution || { name: iName(it) };
  return `<div class="scrim" data-ask-close>
    <div class="sheet asksheet" role="dialog" aria-modal="true">
      <div class="askhead" style="--sev:${sevColor(it.severity)};--sevb:${sevBg(it.severity)}">
        <span class="askav">${M.agent(iAgent(it), 38)}</span>
        <div class="askwho"><b>${esc(iAgent(it))}</b>
          <button class="asksol" data-gosol="${esc(sol.uid || "")}" data-goag="${esc(iAgent(it))}">
            ${M.solution(sol, 16)}<span>${esc(sol.name || "")}</span></button></div>
        <span class="sevtag">${esc(tSev(it.severity))}</span>
      </div>
      <h3 class="askact">${esc(pretty(it.capability))}</h3>
      <div class="askscroll">${askBodyHTML(it)}</div>
      ${Net.queuedFor(it.id) ? `<div class="iqueued">${I.cloudoff}<span>${esc(t("card.queued"))}</span></div>`
        : decideRowHTML(it, S.settled[it.id])}
      <button class="btn btn-ghost block" data-ask-close>${esc(t("act.close"))}</button>
    </div></div>`;
}

function inboxHTML(){
  const n = S.inboxTotal || S.intents.length;
  const head = `<div class="scrhead"><span class="eyebrow">${esc(t("inbox.eyebrow"))}</span><h1>${esc(t("inbox.title"))}</h1>
    <p class="sub">${esc(n?tn("inbox.sub",n):t("inbox.caughtUp"))}</p></div>`;
  const filtering = !!(S.filter.solutions.length || S.filter.severities.length);
  if (!S.intents.length) {
    if (filtering) return head + filterBarHTML() + `<div class="empty"><div class="empty-mk">${I.solutions}</div>
      <div class="empty-t">${esc(t("flt.none"))}</div>
      <button class="btn btn-ghost" data-fclear>${esc(t("flt.clear"))}</button></div>`;
    return head + `<div class="empty"><div class="empty-mk">${MK}</div>
      <div class="empty-t">${esc(t("inbox.empty.title"))}</div><p>${esc(t("inbox.empty.body"))}</p>
      <button class="btn btn-primary" data-nav="solutions">${esc(t("inbox.browse"))}</button></div>`;
  }
  return head + summaryHTML() + filterBarHTML()
    + `<div class="agrps">${agentGroups(S.intents).map(groupHTML).join("")}</div>`
    + moreHTML("inbox");
}

function moreHTML(which){
  const next = which==="inbox" ? S.inboxNext : S.tlNext;
  const shown = which==="inbox" ? S.intents.length : S.timeline.length;
  const total = which==="inbox" ? S.inboxTotal : S.tlTotal;
  if (!next) return shown>=PAGE ? `<div class="more-end">${esc(t("more.end"))}</div>` : "";
  return `<button class="more" data-more="${which}" ${S.loadingMore?"disabled":""}>
    ${S.loadingMore?`<span class="tic spin">${I.sync}</span>${esc(t("more.loading"))}`:esc(t("more.load"))}
    <span class="more-n">${shown} / ${total}</span></button>`;
}

/** The old single card, kept for the one by one walk, where there is nothing
 * else on screen to say who is asking. */
function cardHTML(it){
  const settling = S.settled[it.id], queued = Net.queuedFor(it.id);
  const M = window.Marks, sol = it.solution || { name: iName(it) };
  return `<article class="icard ${settling?("settling "+settling):""}" data-card="${it.id}"
      style="--sev:${sevColor(it.severity)};--sevb:${sevBg(it.severity)}">
    <div class="icard-top">
      ${M.solution(sol, 40)}
      <div class="iwho">
        <div class="isol">${esc(sol.name || iName(it))}</div>
        <div class="iagent">${M.agent(iAgent(it), 20)}<span>${esc(iAgent(it))}</span></div>
      </div>
      <span class="sevtag">${esc(tSev(it.severity))}</span>
    </div>
    <div class="iact">${esc(pretty(it.capability))}</div>
    ${askBodyHTML(it)}
    ${queued?`<div class="iqueued">${I.cloudoff}<span>${esc(t("card.queued"))}</span></div>`
      : decideRowHTML(it, settling)}
  </article>`;
}

/** One at a time, for a queue too long to skim. Position is shown because
 * "3 of 17" is the difference between working through something and being
 * buried by it. */
function focusList(){
  if (!S.focus) return [];
  const groups = agentGroups(S.intents || []);
  const g = groups.find((x) => x.key === S.focus.key);
  return g ? g.items : [];
}
function focusHTML(){
  const list = focusList();
  const it = list[S.focus.at];
  if (!it) {
    return `<div class="scrhead"><span class="eyebrow">${esc(t("inbox.eyebrow"))}</span><h1>${esc(t("inbox.title"))}</h1></div>
      <div class="empty"><div class="empty-mk">${MK}</div>
      <div class="empty-t">${esc(t("cl.done"))}</div>
      <button class="btn btn-primary" data-focus-exit>${esc(t("cl.back"))}</button></div>`;
  }
  return `<div class="focusbar">
      <button class="fx" data-focus-exit>${I.back}<span>${esc(t("cl.back"))}</span></button>
      <span class="fxpos">${esc(t("cl.of",{ i: S.focus.at + 1, n: list.length }))}</span>
    </div>
    <div class="cards focusone">${cardHTML(it)}</div>`;
}

/* ---- activity ---- */

/** A record of answers, grouped by the agent who asked.
 *
 * It used to list everything including what was still waiting, which made it a
 * second inbox with none of the buttons. What is waiting belongs in Discern.
 * This is what was decided, when it was asked, and how long it sat there. */
function decidedGroups(list){
  const by = new Map();
  for (const it of list) {
    const sol = it.solution || { name: iName(it) };
    const name = iAgent(it) || t("grp.unnamed");
    const key = `${sol.uid || "?"}::${name}`;
    if (!by.has(key)) by.set(key, { key: "tl:" + key, agent: name, solution: sol, items: [], latest: 0 });
    const g = by.get(key);
    g.items.push(it);
    g.latest = Math.max(g.latest, iAnswered(it) || iAt(it) || 0);
  }
  return [...by.values()].sort((a, b) => b.latest - a.latest);
}

const iAnswered = (it) => (it.decision && it.decision.at) || it.decidedAt || null;

/** How long the agent waited. Worth showing: an answer in four seconds and an
 * answer in two days are different kinds of answer. */
function waited(it){
  const a = iAnswered(it), b = iAt(it);
  if (!a || !b || a < b) return "";
  return tSpan(a - b);
}

function activityHTML(){
  const head = `<div class="scrhead"><span class="eyebrow">${esc(t("activity.eyebrow"))}</span><h1>${esc(t("activity.title"))}</h1>
    <p class="sub">${esc(t("activity.sub"))}</p></div>`;
  // answers only. Something that ran without asking was never a decision, and
  // something still waiting belongs to Discern, not to a record of what was said.
  const done = (S.timeline || []).filter((it) => ANSWERED.has(it.state));
  if (!done.length) return head + `<div class="empty"><div class="empty-mk">${I.activity}</div>
    <div class="empty-t">${esc(t("activity.empty"))}</div></div>`;
  return head + `<div class="agrps">${decidedGroups(done).map(tlGroupHTML).join("")}</div>` + moreHTML("activity");
}

function tlGroupHTML(g, i){
  const M = window.Marks, open = groupOpen(g, i);
  return `<section class="agrp tlgrp ${open ? "open" : ""}" data-gkey="${esc(g.key)}">
    <div class="ghead">
      <span class="gav">${M.agent(g.agent, 40)}</span>
      <div class="gm">
        <button class="gtog" data-gtog="${esc(g.key)}" aria-expanded="${open}">
          <b class="gname">${esc(g.agent)}</b>
          <small class="gcount">${esc(tn("act.answers", g.items.length))}</small>
        </button>
        <button class="gsol" data-gosol="${esc(g.solution.uid || "")}" data-goag="${esc(g.agent)}">
          ${M.solution(g.solution, 18)}<span class="gsoln">${esc(g.solution.name || "")}</span>
          <span class="gsolgo">${I.chevron}</span>
        </button>
      </div>
      <button class="gchev" data-gtog="${esc(g.key)}" aria-expanded="${open}"
              aria-label="${esc(t(open ? "act.less" : "act.more"))}">${I.chevron}</button>
    </div>
    ${open ? `<div class="gopen"><div class="glist">${g.items.map(tlRowHTML).join("")}</div></div>` : ""}
  </section>`;
}

function tlRowHTML(it){
  const open = !!S.open.a[it.id], w = waited(it);
  return `<article class="arow tlitem ${open ? "open" : ""}" data-aid="${it.id}"
      style="--sev:${sevColor(it.severity)};--sevb:${sevBg(it.severity)}">
    <div class="atop">
      <button class="aopen" data-open="${it.id}">
        <span class="adot"></span>
        <span class="am"><b class="aname">${esc(pretty(it.capability))}</b>
          <small class="awhen">${esc(t("act.asked"))} ${esc(tAgo(iAt(it)))}${
            w ? `, ${esc(t("act.answeredIn", { span: w }))}` : ""}</small></span>
      </button>
      <span class="stpill st-${it.state}">${esc(stateLabel(it.state))}</span>
      <button class="achev sm" data-atog="${it.id}" aria-expanded="${open}"
              aria-label="${esc(t(open ? "act.less" : "act.more"))}">${I.chevron}</button>
    </div>
    ${open ? `<div class="abody">
      <div class="kv"><span>${esc(t("act.asked"))}</span><b>${esc(tWhen(iAt(it)))}</b></div>
      ${iAnswered(it) ? `<div class="kv"><span>${esc(t("act.answered"))}</span><b>${esc(tWhen(iAnswered(it)))}</b></div>` : ""}
      ${askBodyHTML(it)}
      <button class="btn btn-ghost block" data-open="${it.id}">${esc(t("act.detail"))}</button>
    </div>` : ""}
  </article>`;
}

/** The whole record of one action, which is the thing the audit ledger exists
 * to make readable. Opened from anywhere an action is listed. */
function detailHTML(){
  const it = S.detail; if (!it) return "";
  const M = window.Marks, sol = it.solution || { name: iName(it) };
  const risks = Object.entries(it.risk||{}).sort((a,b)=>ORD[b[1]]-ORD[a[1]])
    .map(([c,s2])=>`<span class="rchip" style="--c:${sevColor(s2)};--b:${sevBg(s2)}">${esc(t("risk.chip",{cat:tCat(c),sev:tSev(s2)}))}</span>`).join("");
  const rows = Object.entries(it.details||{}).map(([k,v])=>
    `<div class="drow"><span class="dk">${esc(k)}</span><span class="dv">${esc(Array.isArray(v)?v.join(", "):v)}</span></div>`).join("");
  return `<div class="scrim" data-detail-close>
    <div class="sheet detailsheet" role="dialog">
      <div class="dhead">${M.solution(sol, 38)}
        <div class="dwho"><b>${esc(pretty(it.capability))}</b>
          <span>${esc(sol.name || iName(it))}</span></div>
        <span class="stpill st-${it.state}">${esc(stateLabel(it.state))}</span></div>
      <div class="dagent">${M.agent(iAgent(it), 26)}<span>${esc(iAgent(it))}</span>
        <span class="sevtag" style="--sev:${sevColor(it.severity)};--sevb:${sevBg(it.severity)}">${esc(tSev(it.severity))}</span></div>
      <div class="rchips">${risks}</div>
      ${it.voice && it.voice.summary ? `<p class="whysum">${esc(it.voice.summary)}</p>` : ""}
      ${it.voice && it.voice.context ? `<p class="dsay">${esc(it.voice.context)}</p>` : ""}
      ${rows ? `<div class="idetails">${rows}</div>` : ""}
      <div class="kv"><span>${esc(t("act.when"))}</span><b>${esc(tAgo(iAt(it)))}</b></div>
      <div class="kv"><span>${esc(t("act.ref"))}</span><b class="ref">${iRef(it)}</b></div>
      <button class="btn btn-ghost block" data-detail-close>${esc(t("act.close"))}</button>
    </div></div>`;
}

/* ---- solutions ---- */
function solutionsHTML(){
  if (S.review) return reviewHTML();
  if (S.selectedSol){ const s=S.solutions.find(x=>x.uid===S.selectedSol); if (s) return soldetailHTML(s); S.selectedSol=null; }
  const connected = S.solutions, cat = S.catalog;
  let html = `<div class="scrhead"><span class="eyebrow">${esc(t("sol.eyebrow"))}</span><h1>${esc(t("sol.title"))}</h1><p class="sub">${esc(t("sol.sub"))}</p></div>`;
  html += `<div class="secrow"><h2 class="sech">${esc(t("sol.connected"))}</h2><span class="secn">${connected.length}</span></div>`;
  if (!connected.length) html += `<div class="thin-empty">${esc(t("sol.none"))}</div>`;
  else html += `<div class="sollist">${connected.map(solrowHTML).join("")}</div>`;
  if (cat.length){
    html += `<div class="secrow" style="margin-top:22px"><h2 class="sech">${esc(t("sol.catalog"))}</h2></div>`;
    html += `<div class="catgrid">${cat.map(catcardHTML).join("")}</div>`;
  }
  return html;
}
function solrowHTML(s){
  const surf = surfaces(s), nab = (s.agents||[]).reduce((n,a)=>n+(a.abilities||[]).length,0);
  return `<button class="solrow" data-sol="${s.uid}">
    ${window.Marks.solution(s, 42)}
    <div class="solm"><div class="soln">${esc(s.name)}</div>
      <div class="solmeta">${esc(tn("sol.agents",(s.agents||[]).length))}, ${esc(tn("sol.abilities",nab))}</div>
      ${surf.length?`<div class="solasks">${esc(t("sol.asksAbout",{list:tList(surf.slice(0,3).map(tCat))}))}</div>`:`<div class="solasks quiet">${esc(t("sol.runsRoutine"))}</div>`}
    </div>
    <div class="solend"><span class="stpill st-${s.status}">${esc(linkLabel(s.status))}</span>${I.chevron}</div>
  </button>`;
}
function catcardHTML(c){
  return `<div class="catcard">
    <div class="cattop">${window.Marks.solution(c, 42)}<div class="catm"><div class="catn">${esc(c.name)}</div>${c.agents?`<div class="catmeta">${esc(tn("sol.agents",c.agents.length))}</div>`:''}</div></div>
    <p class="catd">${esc(c.description||"")}</p>
    <button class="btn btn-primary block" data-review="${c.uid}">${I.shield}<span>${esc(t("sol.seeWhat"))}</span></button>
  </div>`;
}
/** How the agents in a solution relate, drawn from what the developer declared.
 * Horizon records agents in the order they were declared and the abilities each
 * one holds, so the chain shown here is the developer's own submission rather
 * than anything invented: who hands to whom, and which of them stop to ask.
 *
 * It is a claim about structure, not about runtime. An agent that never runs
 * still appears, because what a solution may do is the thing being disclosed. */
function agentGraphHTML(sol, appetite){
  const M = window.Marks, agents = sol.agents || [];
  if (!agents.length) return "";
  const ap = appetite || sol.appetite || DEFAULT_APPETITE;
  // what is actually waiting from each of them, right now
  const waiting = new Map();
  for (const it of (S.intents || [])) {
    const uid = (it.solution && it.solution.uid) || it.solutionUid;
    if (uid !== sol.uid) continue;
    const n = iAgent(it);
    waiting.set(n, (waiting.get(n) || 0) + 1);
  }
  const nodes = agents.map((a, i) => {
    const abs = a.abilities || [];
    const asks = abs.filter((ab) => {
      const v = reconcile(ab.risk || {}, ab.severity || "LOW", ap, ab.discernment || "auto");
      return !v.allow;
    }).length;
    const now = waiting.get(a.name) || 0;
    const worst = abs.reduce((m, ab) => maxSev(m, ab.severity || "LOW"), "LOW");
    // The badge is a live count and a way in: tapping it takes you to Discern
    // narrowed to this one agent, which is a narrower question than the inbox
    // and the reason someone is looking at this screen at all.
    const badge = now
      ? `<button class="gasks live" data-agasks="${esc(a.name)}" data-agsol="${esc(sol.uid)}"
           title="${esc(tn("sol.asksNow", now))}">${I.bell}<b>${now}</b></button>`
      : asks ? `<span class="gasks" title="${esc(t("rev.asks"))}">${I.bell}${asks}</span>`
             : `<span class="gruns" title="${esc(t("rev.runs"))}">${I.check}</span>`;
    return `<div class="gnode ${now ? "live" : asks ? "asks" : ""}" data-agent="${esc(a.name)}"
        style="--c:${sevColor(worst)}">
      ${i ? `<span class="gedge" aria-hidden="true"></span>` : ""}
      <div class="gbody">
        ${M.agent(a.name, 30)}
        <div class="gmeta"><b>${esc(a.name)}</b>
          <small>${esc(tn("sol.abilities", abs.length))}</small></div>
        ${badge}
      </div></div>`;
  }).join("");
  return `<section class="panel"><div class="panelhd"><h3>${esc(t("sol.flow"))}</h3>
      <p>${esc(t("sol.flowSub"))}</p></div>
    <div class="graph">${nodes}</div></section>`;
}

function soldetailHTML(s){
  const nab = (s.agents||[]).reduce((n,a)=>n+(a.abilities||[]).length,0);
  return `<button class="back" data-back>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
  <div class="soldhead">${window.Marks.solution(s, 52)}<div><div class="soldn">${esc(s.name)}</div>
    <div class="soldsub">${esc(tn("sol.agents",(s.agents||[]).length))}, ${esc(tn("sol.abilities",nab))}</div></div>
    <span class="stpill st-${s.status}">${esc(linkLabel(s.status))}</span></div>
  ${s.description?`<p class="soldesc">${esc(s.description)}</p>`:''}
  ${agentGraphHTML(s, s.appetite)}
  <section class="panel"><div class="panelhd"><h3>${esc(t("sol.appetite"))}</h3><p>${esc(t("sol.appetiteSub"))}</p></div>
    <div class="apwrap">${CAT_KEYS.map(c=>appetiteRow(s,c)).join("")}</div></section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("sol.kill"))}</h3><p>${esc(t("sol.killSub"))}</p></div>
    <button class="btn ${s.status==='active'?'btn-warn':'btn-primary'} block" data-status="${s.link}" data-to="${s.status==='active'?'paused':'active'}">${esc(s.status==='active'?t("sol.pause"):t("sol.resume"))}</button></section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("sol.agentsTitle"))}</h3></div>
    ${(s.agents||[]).map(a=>`<div class="agentblock"><div class="agentn">${esc(a.name)}</div><div class="abchips">${(a.abilities||[]).map(ab=>`<span class="abchip" style="--c:${sevColor(ab.severity)}"><span class="abk">${esc(ab.key)}</span><span class="absev" style="color:${sevColor(ab.severity)}">${esc(tSev(ab.severity))}</span></span>`).join("")}</div></div>`).join("")}</section>`;
}
function appetiteRow(s,c){
  const cur = (s.appetite&&s.appetite[c])||DEFAULT_APPETITE[c];
  return `<div class="aprow"><div class="aplab">${esc(tCat(c))}</div>
    <div class="apseg" data-appetite="${s.link}" data-cat="${c}">${SEVS.map(l=>`<button class="apbtn ${cur===l?'on':''} lv-${l}" data-level="${l}" title="${esc(tSev(l))}">${esc(tSev(l))}</button>`).join("")}</div></div>`;
}

/* ---- pre-connect disclosure: the permission label ---- */
function abilityRow(a, kind, appetite){
  const c = sevColor(a.severity), b = sevBg(a.severity);
  const why = kind==="ask" ? (tWhy(a, appetite, a.why)[0] || t("rev.needsYou")) : t("rev.allowed");
  return `<div class="abrow"><span class="abdot" style="--c:${c};--b:${b}">${kind==="ask"?I.bell:I.check}</span>
    <div class="abm"><div class="abt">${esc(a.description||pretty(a.key))}</div>
      <div class="abs">${esc(a.agent)}<span class="abkey">${esc(a.key)}</span></div>
      <div class="abwhy">${esc(why)}</div></div>
    <span class="sevtag" style="--sev:${c};--sevb:${b}">${esc(tSev(a.severity))}</span></div>`;
}
/** The permission label lists abilities flat; the graph wants them per agent.
 * Rebuild that shape from what the profile returned. */
function groupAsksByAgent(p){
  const by = new Map();
  for (const a of [...(p.asks||[]), ...(p.runs||[])]) {
    if (!by.has(a.agent)) by.set(a.agent, { name: a.agent, abilities: [] });
    by.get(a.agent).abilities.push(a);
  }
  return [...by.values()];
}

function reviewHTML(){
  const p = S.reviewData;
  if (!p) return `<button class="back" data-back-review>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
    <div class="sk-review">${[0,1,2,3].map(i=>`<div class="abrow sk-card" style="--d:${i*70}ms"><span class="sk sk-logo sm"></span>
      <div class="abm"><span class="sk sk-line w70"></span><span class="sk sk-line w40"></span></div></div>`).join("")}
    <div class="sk-note">${esc(t("rev.reading"))}</div></div>`;
  const s = p.solution;
  return `<button class="back" data-back-review>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
  <div class="soldhead">${window.Marks.solution(s, 52)}
    <div><div class="soldn">${esc(s.name)}</div><div class="soldsub">${esc(tn("sol.agents",p.counts.agents))}, ${esc(tn("sol.abilities",p.counts.abilities))}</div></div></div>
  ${s.description?`<p class="soldesc">${esc(s.description)}</p>`:''}
  ${agentGraphHTML({ agents: groupAsksByAgent(p) }, p.appetite)}
  <section class="panel"><div class="panelhd"><h3>${esc(t("rev.asks"))} <span class="cnt ask">${p.counts.asks}</span></h3>
    <p>${esc(t("rev.asksSub"))}</p></div>
    ${p.asks.length?p.asks.map(a=>abilityRow(a,"ask",p.appetite)).join(""):`<div class="thin-empty">${esc(t("rev.noAsks"))}</div>`}</section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("rev.runs"))} <span class="cnt run">${p.counts.runs}</span></h3>
    <p>${esc(t("rev.runsSub"))}</p></div>
    ${p.runs.length?p.runs.map(a=>abilityRow(a,"run",p.appetite)).join(""):`<div class="thin-empty">${esc(t("rev.noRuns"))}</div>`}</section>
  <p class="consent-note">${I.shield}<span>${esc(t("rev.note"))}</span></p>
  ${p.connected?`<button class="btn btn-ghost block big" data-back-review>${esc(t("rev.already"))}</button>`
    :`<button class="btn btn-primary block big" data-connect="${s.uid}">${esc(t("rev.connect",{name:s.name}))}</button>`}`;
}
async function openReview(uid){
  S.review = uid; S.reviewData = null; S.view = "solutions"; S.selectedSol = null; render();
  try { S.reviewData = await Backend.profile(uid); }
  catch(e){ toast(`<div class="tm">${esc(t("t.profileFail",{msg:e.message}))}</div>`,"warn"); }
  render();
}

/* ---- settings ---- */
function settingsHTML(){
  const conn = S.mode==="connected" ? `${t("set.live")} at ${BASE.replace(/^https?:\/\//,"")}`
    : S.mode==="degraded" ? `${t("set.offline")}, ${t("net.synced",{ago:tAgo(S.net.lastSync)})}` : t("net.demo");
  const p = S.push;
  return `<div class="scrhead"><span class="eyebrow">${esc(t("set.eyebrow"))}</span><h1>${esc(t("set.title"))}</h1></div>
  <section class="panel">
    <div class="kv"><span>${esc(t("set.signedIn"))}</span><b>${esc((S.user&&S.user.name)||t("set.you"))}</b></div>
    <div class="kv"><span>${esc(t("set.email"))}</span><b>${esc((S.user&&S.user.email)||"")}</b></div>
    <div class="kv"><span>${esc(t("set.connection"))}</span><b class="${S.mode==="connected"?'ok':'warn'}">${esc(conn)}</b></div>
  </section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.notify"))}</h3><p>${esc(t("set.notifySub"))}</p></div>
    ${!p.supported ? `<div class="thin-empty">${esc(t("set.notifyNo"))}</div>`
      : p.permission==="denied" ? `<div class="thin-empty">${esc(t("set.notifyBlocked"))}</div>`
      : p.on ? `<div class="kv"><span>${esc(t("set.notifyReady"))}</span><b class="ok">${I.check}</b></div>
               <button class="btn btn-ghost block" data-testpush>${esc(t("set.notifyTest"))}</button>`
      : `<button class="btn btn-primary block" data-enablepush ${p.busy?"disabled":""}>${p.busy?`<span class="tic spin">${I.sync}</span>`:I.bell}<span>${esc(t("set.notifyOn"))}</span></button>`}
  </section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.lock"))}</h3><p>${esc(t("set.lockSub"))}</p></div>
    ${isReviewer() ? `<div class="thin-empty">${esc(t("set.lockReview"))}</div>`
      : S.env !== "live" ? `<div class="thin-empty">${esc(t("set.lockBeta"))}</div>` : `
    <div class="lockopts">
      <button class="lockopt ${S.lockMode==="off"?"on":""}" data-lockmode="off">
        <b>${esc(t("set.lockOff2"))}</b><small>${esc(t("set.lockOffSub"))}</small></button>
      ${lockSupported() ? `<button class="lockopt ${S.lockMode==="device"?"on":""}" data-lockmode="device" ${S.lockBusy?"disabled":""}>
        <b>${esc(t("set.lockDevice"))}</b><small>${esc(t("set.lockDeviceSub"))}</small></button>` : ""}
      <button class="lockopt ${S.lockMode==="pin"?"on":""}" data-lockmode="pin" ${S.lockBusy?"disabled":""}>
        <b>${esc(t("set.lockPin"))}</b><small>${esc(t("set.lockPinSub"))}</small></button>
    </div>`}
  </section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.language"))}</h3></div>
    <div class="langgrid">${LANGS.map(l=>`<button class="langb ${window.I18N.lang===l.code?'on':''}" data-lang="${l.code}">
      <b>${l.native}</b><small>${l.name}</small></button>`).join("")}</div></section>
  ${canSwitchEnv() ? `<section class="panel"><div class="panelhd"><h3>${esc(t("set.env"))}</h3><p>${esc(t("set.envSub"))}</p></div>
    <div class="envseg">${Object.entries(ENVS).map(([k,e])=>`<button class="${S.env===k?'on':''}" data-env="${k}">${esc(e.label())}</button>`).join("")}</div></section>` : ""}
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.appearance"))}</h3></div>
    <div class="envseg">${[["system",t("set.system")],["light",t("set.light")],["dark",t("set.dark")]].map(([k,l])=>`<button class="${S.theme===k?'on':''}" data-theme-set="${k}">${esc(l)}</button>`).join("")}</div></section>
  <section class="panel"><button class="btn btn-ghost block" data-signout>${esc(t("set.signOut"))}</button></section>
  <p class="motto">${esc(t("app.motto")).replace(/\n/g,"<br/>")}</p>`;
}

/** The launch animation, deliberately outside the render tree.
 *
 * It used to be part of the screen, which meant every render() during boot
 * rebuilt its SVG and restarted the stroke from zero. Booting renders three or
 * four times, so the mark stuttered. Now it is one element appended to the
 * document, animated once, and removed when it is done. Nothing the app draws
 * can touch it. */
function playSplash(){
  const had = document.querySelector(".splashlayer");
  if (had) had.remove();
  // one source of truth for the mark: take the stroke and the ring apart
  const wave = MK.replace(/<circle[^>]*\/>/, "");
  const ring = MK.replace(/<path[^>]*\/>/, "");
  const el = document.createElement("div");
  el.className = "splashlayer";
  el.innerHTML = `<div class="spmk">
    <div class="spwave">${wave}</div>
    <i class="spwipe"></i>
    <div class="spring">${ring}</div>
    <i class="sppulse"></i>
  </div>`;
  document.body.appendChild(el);
  const done = () => {
    el.classList.add("out");
    el.addEventListener("transitionend", () => el.remove(), { once:true });
    setTimeout(() => el.remove(), 800);
  };
  setTimeout(done, 1550);
}

/* ---- screen lock ---- */
function keypadHTML(setup){
  const len = S.pinEntry.length;
  const dots = Array.from({length:6},(_,i)=>`<span class="pindot ${i<len?"on":""}"></span>`).join("");
  const keys = ["1","2","3","4","5","6","7","8","9","","0","back"];
  return `<div class="pindots">${dots}</div>
    <div class="keypad">${keys.map(k=>k===""
      ? `<span class="keygap"></span>`
      : `<button class="key ${k==="back"?"kback":""}" data-pin="${k}" ${S.lockBusy?"disabled":""}>
           ${k==="back"?I.back:k}</button>`).join("")}</div>
    <button class="btn btn-primary block" data-pin-ok ${len<4||S.lockBusy?"disabled":""}>
      ${S.lockBusy?`<span class="tic spin">${I.sync}</span>`:""}<span>${esc(t(setup?"lock.setPin":"lock.unlock"))}</span></button>`;
}

function lockHTML(){
  const pin = S.lockMode === "pin";
  return `<div class="lockscreen">
    <div class="lock-mk">${MK}</div>
    <h1>${esc(t("lock.title"))}</h1>
    <p class="lock-body">${esc(t(pin ? "lock.bodyPin" : "lock.body"))}</p>
    ${pin ? keypadHTML(false) : `<button class="btn btn-primary block big" data-unlock ${S.lockBusy?"disabled":""}>
      ${S.lockBusy?`<span class="tic spin">${I.sync}</span>`:I.face}<span>${esc(t("lock.unlock"))}</span></button>`}
    <button class="btn btn-ghost block" data-signout>${esc(t("lock.signout"))}</button>
  </div>`;
}

/** Choosing a PIN, which is a full screen because getting it wrong twice is
 * worse than any amount of space saved. */
function pinSetupHTML(){
  const again = S.pinSetup.stage === "again";
  return `<div class="lockscreen">
    <div class="lock-mk">${MK}</div>
    <h1>${esc(t(again ? "lock.pinAgain" : "lock.pinNew"))}</h1>
    <p class="lock-body">${esc(t("lock.pinHint"))}</p>
    ${keypadHTML(true)}
    <button class="btn btn-ghost block" data-pin-cancel>${esc(t("bio.cancel"))}</button>
  </div>`;
}

/* ---- sign in ----
   One question at a time. An address first, because that is all we need to know
   whether this person already has an account. Only if they do not do we ask who
   they are, and only the account that has a password is ever shown a password
   field. */
/** What the launch probe found, said once, where signing in happens.
 *
 * It is a notice and not a wall: the whole point is that someone who has been
 * here before can carry on. */
function healthNoteHTML(){
  const h = S.health || {};
  if (!h.reachable) return `<div class="hnote warn">
      <span class="tic">${I.cloudoff}</span>
      <div><b>${esc(t("signin.offTitle"))}</b><span>${esc(t("signin.offBody"))}</span></div></div>`;
  if (h.why === "degraded" || h.why === "unhealthy") return `<div class="hnote warn">
      <span class="tic">${I.shield}</span>
      <div><b>${esc(t("signin.degTitle"))}</b><span>${esc(t("signin.degBody"))}</span></div></div>`;
  return "";
}

function signinHTML(){
  const st = S.signin;
  const err = st.error ? `<div class="signin-err">${esc(st.error)}</div>` : "";
  const note = healthNoteHTML();
  const head = `<div class="signin-mk">${MK}</div>
    <h1>${esc(t("app.name"))}</h1><p class="signin-motto">${esc(t("app.motto")).replace(/\n/g,"<br/>")}</p>`;

  if (st.step === "name") {
    return `<div class="signin">${head}
      ${note}
      <div class="signin-lead"><b>${esc(t("signin.newTitle"))}</b>
        <span>${esc(t("signin.newBody",{id:st.identifier || st.id}))}</span></div>
      ${err}
      <div class="field"><label for="nm">${esc(t("signin.name"))}</label>
        <input id="nm" autocomplete="name" enterkeyhint="done" placeholder="Ada Lovelace"/></div>
      <button class="btn btn-primary block big" data-create ${st.busy?"disabled":""}>
        ${st.busy?`<span class="tic spin">${I.sync}</span>`:""}<span>${esc(t("signin.create"))}</span></button>
      <button class="btn btn-ghost block" data-signin-back>${esc(t("signin.back"))}</button>
      <div id="overlay"></div></div>`;
  }

  if (st.step === "password") {
    return `<div class="signin">${head}
      ${note}
      <div class="signin-lead"><b>${esc(st.identifier || st.id)}</b><span>${esc(t("signin.pwNote"))}</span></div>
      ${err}
      <div class="field"><label for="pw">${esc(t("signin.pw"))}</label>
        <div class="pwwrap">
          <input id="pw" type="${st.showPw ? "text" : "password"}" autocomplete="current-password"
                 enterkeyhint="go" value="${esc(st.pw || "")}"/>
          <button type="button" class="pweye" data-pweye
                  aria-label="${esc(t(st.showPw ? "signin.hidePw" : "signin.showPw"))}"
                  aria-pressed="${st.showPw ? "true" : "false"}">${st.showPw ? I.eyeOff : I.eye}</button>
        </div></div>
      <button class="btn btn-primary block big" data-pw ${st.busy?"disabled":""}>
        ${st.busy?`<span class="tic spin">${I.sync}</span>`:""}<span>${esc(t("signin.continue"))}</span></button>
      ${passkeyOffered(st.identifier || st.id) ? `<button class="btn btn-ghost block" data-passkey>
        <span class="tic">${I.face}</span><span>${esc(t("signin.usePasskey"))}</span></button>` : ""}
      <button class="btn btn-ghost block" data-signin-back>${esc(t("signin.back"))}</button>
      <div id="overlay"></div></div>`;
  }

  const P = window.Phone;
  const isPhone = st.kind === "phone";
  const c = P.BY_ISO[st.iso] || P.BY_ISO.US;
  const picker = st.picker ? countryPickerHTML() : "";

  return `<div class="signin">${head}
    ${note}
    ${err}
    <div class="field idfield">
      <label for="id">${esc(t("signin.id"))}</label>
      <div class="idwrap ${isPhone ? "phone" : "mail"}">
        ${idLeadHTML()}
        <input id="id" type="${isPhone ? "tel" : "email"}"
               inputmode="${isPhone ? "tel" : "email"}"
               autocomplete="${isPhone ? "tel-national" : "username"}"
               enterkeyhint="go" spellcheck="false" autocapitalize="none"
               placeholder="${esc(t("signin.idPh"))}" value="${esc(st.id)}"/>
      </div>
      ${(S.recent || []).length ? `<div class="recents" ${st.id ? "hidden" : ""}>
        <span class="recentlab">${esc(t("signin.recent"))}</span>
        ${S.recent.map((r)=>`<button type="button" class="recent" data-recent="${esc(r)}">${esc(r)}</button>`).join("")}
      </div>` : `<div class="idhint quiet">${esc(t("signin.idBoth"))}</div>`}
      ${isPhone
        ? `<div class="idhint">${esc(P.name(c.iso, window.I18N.lang))} ${esc(P.e164(c.iso, st.id))}</div>`
        : (P.emailKind(st.id) !== "unknown"
            ? `<div class="idhint">${esc(P.emailKind(st.id) === "personal" ? t("signin.personal") : t("signin.work"))}</div>`
            : "")}
    </div>
    <button class="btn btn-primary block big" data-signin ${st.busy?"disabled":""}>
      ${st.busy?`<span class="tic spin">${I.sync}</span>`:""}<span>${esc(t("signin.next"))}</span></button>
    <div class="signin-note">${I.shield}<span>${esc(t("signin.note"))}</span></div>
    <div class="signin-langs">${I.globe}${LANGS.map(l=>`<button class="${window.I18N.lang===l.code?'on':''}" data-lang="${l.code}">${l.native}</button>`).join("")}</div>
    ${picker}
    <div id="overlay"></div></div>`;
}

function paintCountryList(){
  const host = document.querySelector(".ccscrim");
  if (!host) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = countryPickerHTML();
  host.querySelector(".cclist").replaceWith(tmp.querySelector(".cclist"));
}

/** What sits at the head of the field right now. A flag when it is a number,
 * so the country is both visible and changeable; an icon when it is an address,
 * so the field is never empty-headed while someone types. */
function idLeadHTML(){
  const P = window.Phone, st = S.signin;
  if (st.kind === "phone") {
    const c = P.BY_ISO[st.iso] || P.BY_ISO.US;
    return `<button type="button" class="cc" data-picker aria-label="${esc(t("signin.country"))}">
      <span class="ccflag">${P.flag(c.iso)}</span><span class="ccdial">+${c.dial}</span></button>`;
  }
  const kind = st.kind === "email" ? P.emailKind(st.id) : "empty";
  const icon = kind === "personal" ? I.person : kind === "work" ? I.work : I.at;
  const label = kind === "personal" ? t("signin.personal") : kind === "work" ? t("signin.work") : "";
  return `<span class="idlead ${kind}" title="${esc(label)}" aria-label="${esc(label)}">${icon}</span>`;
}

/** Everything that changes what the head of the field looks like. Rendering is
 * driven off this so the caret is only disturbed when the shape really moves. */
function idShape(){
  const P = window.Phone, st = S.signin;
  return st.kind === "phone" ? `phone:${st.iso}` : `${st.kind}:${P.emailKind(st.id)}`;
}

/** The country list, named in the reader's language and searchable, because
 * scrolling 229 rows to find one is not a design. */
function countryPickerHTML(){
  const P = window.Phone, lang = window.I18N.lang, q = S.signin.search.trim().toLowerCase();
  const rows = P.COUNTRIES
    .map((c) => ({ ...c, label: P.name(c.iso, lang) }))
    .filter((c) => !q || c.label.toLowerCase().includes(q) || c.dial.startsWith(q.replace(/^\+/, "")) || c.iso.toLowerCase() === q)
    .sort((a, b) => a.label.localeCompare(b.label, lang));
  return `<div class="scrim ccscrim" data-picker-close>
    <div class="sheet ccsheet" role="dialog" aria-label="${esc(t("signin.country"))}">
      <h3>${esc(t("signin.country"))}</h3>
      <input id="ccsearch" class="ccsearch" placeholder="${esc(t("signin.search"))}" value="${esc(S.signin.search)}" autocomplete="off"/>
      <div class="cclist">${rows.map((c)=>`<button class="ccrow ${c.iso===S.signin.iso?"on":""}" data-cc="${c.iso}">
        <span class="ccflag">${P.flag(c.iso)}</span><span class="ccname">${esc(c.label)}</span>
        <span class="ccdial">+${c.dial}</span></button>`).join("") || `<div class="thin-empty">${esc(t("more.end"))}</div>`}</div>
    </div></div>`;
}

/** Someone who builds can be in either environment, and the cost of forgetting
 * which is high in one direction: a decision taken in Live is real. So they are
 * told on the way in, every time they come back, until they say not to. That
 * choice lasts until they sign out, because signing out is the moment the
 * answer might change. */
function envAskHTML(){
  const here = ENVS[S.env].label();
  const other = S.env === "live" ? "test" : "live";
  return `<div class="scrim" data-envask-close>
    <div class="sheet envsheet" role="dialog">
      <span class="envbadge ${S.env}">${esc(here)}</span>
      <h3>${esc(t("env.youAreIn",{env:here}))}</h3>
      <p>${esc(t(S.env === "live" ? "env.liveBody" : "env.betaBody"))}</p>
      <label class="envdont"><input type="checkbox" id="envdont" ${S.envAcked?"checked":""}/>
        <span>${esc(t("env.dontAsk"))}</span></label>
      <button class="btn btn-primary block big" data-envask-stay>${esc(t("env.stay",{env:here}))}</button>
      <button class="btn btn-ghost block" data-envask-switch="${other}">${esc(t("env.switchTo",{env:ENVS[other].label()}))}</button>
    </div></div>`;
}

/* ---- answering ----
   Every answer is confirmed. Approve, deny and reflect all change what an agent
   does next, and two of them cannot be taken back, so none of them happen on a
   single tap. The sheet says what the answer means in the agent's terms rather
   than asking "are you sure", which tells nobody anything. */
function confirmHTML(){
  const c = S.confirm; if (!c) return "";
  const many = c.count && c.count > 1;
  const body = c.decision === "approve" ? t("ok.approveBody")
             : c.decision === "deny" ? t("ok.denyBody") : t("ok.reflectBody");
  const kind = c.decision === "approve" ? "primary" : c.decision === "deny" ? "deny" : "reflect";
  return `<div class="scrim" data-confirm-close>
    <div class="sheet confirmsheet" role="dialog">
      <h3>${esc(t("ok." + c.decision))}</h3>
      <p>${esc(body)}</p>
      ${many ? `<p class="cmany">${esc(t("ok.bulk",{n:c.count}))}${
        c.decision === "approve" ? " " + esc(t("ok.severeKept")) : ""}</p>` : ""}
      ${c.label ? `<div class="kv"><span>${esc(t("act.detail"))}</span><b>${esc(c.label)}</b></div>` : ""}
      <button class="btn btn-${kind} block big" data-confirm-go>${esc(t("card." + c.decision))}</button>
      <button class="btn btn-ghost block" data-confirm-close>${esc(t("bio.cancel"))}</button>
    </div></div>`;
}

function askConfirm(decision, opts){ S.confirm = { decision, ...opts }; render(); }

async function runConfirmed(){
  const c = S.confirm; if (!c) return;
  S.confirm = null; render();
  if (c.ids) { await decideGroup(c.decision, c.ids, c.count); return; }
  await decide(c.id, c.decision);
}

/* ---- overlays ---- */
function toast(html, kind){
  const ov=document.getElementById("overlay"); if(!ov)return;
  const el=document.createElement("div"); el.className="toast "+(kind||"");
  el.innerHTML=html; el.addEventListener("click",()=>el.remove()); ov.appendChild(el);
  setTimeout(()=>{ el.style.opacity="0"; setTimeout(()=>el.remove(),300); },3000);
}
function biometric(onOk){
  const ov=document.getElementById("overlay"); if(!ov)return;
  const scrim=document.createElement("div"); scrim.className="scrim";
  scrim.innerHTML=`<div class="sheet"><div class="faceic">${I.face}</div><h3>${esc(t("bio.title"))}</h3><p>${esc(t("bio.body"))}</p>
    <button class="btn btn-primary block" data-bio="ok">${esc(t("bio.confirm"))}</button>
    <button class="btn btn-ghost block" data-bio="x">${esc(t("bio.cancel"))}</button></div>`;
  scrim.addEventListener("click",e=>{ const b=e.target.closest("[data-bio]"); if(!b&&e.target!==scrim)return; scrim.remove(); if(b&&b.dataset.bio==="ok")onOk(); });
  ov.appendChild(scrim);
}

/* ---- device sizing ---- */
function applyDevice(){
  if (S.fullscreen) return;
  const dev=DEVICES[S.plat][S.form], device=document.getElementById("device"); if(!device)return;
  device.style.setProperty("--w",dev.w+"px"); device.style.setProperty("--h",dev.h+"px");
  const app=document.getElementById("app-root"); if(app) app.classList.toggle("wide", S.form!=="phone");
  requestAnimationFrame(()=>{ const stage=device.closest(".stage"), sc=device.closest(".stage-scale"); if(!stage||!sc)return;
    sc.style.setProperty("--scale",1); const r=device.getBoundingClientRect(), s=stage.getBoundingClientRect();
    const k=Math.min((s.width-48)/r.width,(s.height-48)/r.height,1); sc.style.setProperty("--scale",k>0?k:1); });
}
addEventListener("resize", applyDevice);

/* ---- events ---- */
function wire(){
  const root=document.getElementById("root");
  root.onclick = async e=>{
    const el=e.target;
    // An open menu closes on a tap anywhere else, but that tap still counts:
    // swallowing it means everything on the screen needs pressing twice.
    let closedDrop = false;
    if (S.drop && !el.closest(".fdrop")) { S.drop = null; closedDrop = true; }
    const nav=el.closest("[data-nav]"); if(nav){ e.preventDefault(); S.view=nav.dataset.nav; S.selectedSol=null; render(); return; }
    if(el.closest("[data-ctl='fullscreen']")){ S.fullscreen=!S.fullscreen; savePrefs(); render(); return; }
    if(el.closest("[data-toggle-env]")){ S.env=S.env==="test"?"live":"test"; savePrefs(); reloadEnv(); return; }
    const envb=el.closest("[data-env]"); if(envb){ S.env=envb.dataset.env; savePrefs(); reloadEnv(); return; }
    const lg=el.closest("[data-lang]"); if(lg){ S.lang=window.I18N.setLang(lg.dataset.lang); savePrefs(); tellWorkerLang(); render(); return; }
    const th=el.closest("[data-theme-set]"); if(th){ S.theme=th.dataset.themeSet; savePrefs(); applyTheme(); render(); return; }
    const dec=el.closest("[data-decide]");
    if(dec){ const id=dec.dataset.id;
      const it=(S.intents||[]).find(x=>x.id===id);
      askConfirm(dec.dataset.decide, { id, label: it ? pretty(it.capability) : "" }); return; }
    const mr=el.closest("[data-more]"); if(mr){ loadMore(mr.dataset.more); return; }
    if(el.closest("[data-retry]")){ retryNow(); return; }
    if(el.closest("[data-enablepush]")){ enablePush(); return; }
    if(el.closest("[data-unlock]")){ unlock(); return; }
    const lm=el.closest("[data-lockmode]");
    if(lm){ const m=lm.dataset.lockmode;
      if(m==="off") disableLock();
      else if(m==="device") enableDeviceLock();
      else startPinSetup();
      return; }
    const kp=el.closest("[data-pin]"); if(kp){ pinDigit(kp.dataset.pin); return; }
    if(el.closest("[data-pin-ok]")){ pinSubmit(); return; }
    if(el.closest("[data-pin-cancel]")){ S.pinSetup=null; S.pinEntry=""; render(); return; }
    if(el.closest("[data-testpush]")){ testPush(); return; }
    const rev=el.closest("[data-review]"); if(rev){ openReview(rev.dataset.review); return; }
    if(el.closest("[data-back-review]")){ S.review=null; S.reviewData=null; render(); return; }
    const con=el.closest("[data-connect]"); if(con){ connect(con.dataset.connect); return; }
    const sol=el.closest("[data-sol]"); if(sol){ S.selectedSol=sol.dataset.sol; render(); return; }
    if(el.closest("[data-back]")){ S.selectedSol=null; render(); return; }
    const lvl=el.closest("[data-level]"); if(lvl){ const box=lvl.closest("[data-appetite]"); await setAppetite(box.dataset.appetite,box.dataset.cat,lvl.dataset.level); return; }
    const stt=el.closest("[data-status]"); if(stt){ await setStatus(stt.dataset.status,stt.dataset.to); return; }
    if(el.closest("[data-pweye]")){
      const f=document.getElementById("pw"); S.signin.pw = f ? f.value : "";
      S.signin.showPw = !S.signin.showPw; render();
      const g=document.getElementById("pw");
      if(g){ g.focus(); g.setSelectionRange(g.value.length, g.value.length); }
      return; }
    if(el.closest("[data-picker]")){ S.signin.picker = true; S.signin.search = ""; render();
      const q=document.getElementById("ccsearch"); if(q) q.focus(); return; }
    const cc = el.closest("[data-cc]");
    if(cc){ S.signin.iso = cc.dataset.cc; S.signin.picker = false; S.signin.error = ""; render();
      const f=document.getElementById("id"); if(f) f.focus(); return; }
    if(el.closest("[data-picker-close]") && !el.closest(".ccsheet")){ S.signin.picker = false; render(); return; }
    // -- agent groups: fold, unfold, answer as one, or walk them one by one --
    const gt = el.closest("[data-gtog]");
    if(gt){ const k=gt.dataset.gtog; S.open.g[k] = !groupOpenNow(k); render(); return; }
    const gs = el.closest("[data-gosol]");
    if(gs){ openSolutionFor(gs.dataset.gosol, gs.dataset.goag); return; }
    const ga = el.closest("[data-agasks]");
    if(ga){ focusAgentAsks(ga.dataset.agsol, ga.dataset.agasks); return; }
    const gd = el.closest("[data-gdec]");
    if(gd){ const g = groupByKey(gd.dataset.gkey); if(!g) return;
      const ids = g.items.map(i=>i.id);
      askConfirm(gd.dataset.gdec, { ids, count: ids.length, label: g.agent }); return; }
    const g1 = el.closest("[data-gone]");
    if(g1){ S.focus = { key: g1.dataset.gone, at: 0 }; S.ask = null; render(); return; }
    if(el.closest("[data-focus-exit]")){ S.focus = null; render(); return; }
    // -- one action: unfold in place, or open it over everything else --
    const at = el.closest("[data-atog]");
    if(at){ const id=at.dataset.atog; S.open.a[id] = !S.open.a[id]; render();
      if (S.open.a[id]) bringIntoView(`[data-aid="${id}"]`);
      return; }
    const aa = el.closest("[data-aask]");
    if(aa){ S.ask = aa.dataset.aask; S.drop = null; render(); return; }
    if(el.closest("[data-ask-close]") && !el.closest(".asksheet")){ S.ask=null; render(); return; }
    if(el.closest("[data-ask-close]")){ S.ask=null; render(); return; }
    if(el.closest("[data-envask-stay]")){
      const c=document.getElementById("envdont"); S.envAcked = !!(c && c.checked); savePrefs();
      S.envAsk=false; render(); return; }
    const esw = el.closest("[data-envask-switch]");
    if(esw){ const c=document.getElementById("envdont"); S.envAcked = !!(c && c.checked);
      S.envAsk=false; S.env=esw.dataset.envaskSwitch; savePrefs(); reloadEnv(); return; }
    if(el.closest("[data-confirm-go]")){ runConfirmed(); return; }
    if(el.closest("[data-confirm-close]")){ S.confirm=null; render(); return; }
    // -- the two filter menus --
    const dp = el.closest("[data-drop]");
    if(dp){ const w=dp.dataset.drop; S.drop = S.drop===w ? null : w; render(); return; }
    const fs = el.closest("[data-fsol]");
    if(fs){ toggleFilter("solutions", fs.dataset.fsol); return; }
    const fv = el.closest("[data-fsev]");
    if(fv){ toggleFilter("severities", fv.dataset.fsev); return; }
    if(el.closest("[data-fclear]")){ S.filter={solutions:[],severities:[]}; S.drop=null; savePrefs(); applyFilter(); return; }

    const op = el.closest("[data-open]");
    if(op){ const id=op.dataset.open;
      S.detail = S.timeline.find(x=>x.id===id) || S.intents.find(x=>x.id===id) || null; render(); return; }
    if(el.closest("[data-detail-close]") && !el.closest(".detailsheet")){ S.detail=null; render(); return; }
    if(el.closest("[data-detail-close]")){ S.detail=null; render(); return; }
    const rc = el.closest("[data-recent]");
    if(rc){ const v = rc.dataset.recent, P = window.Phone;
      const dialed = P.splitPasted(v);
      if (dialed) { S.signin.iso = dialed.iso; S.signin.kind = "phone"; S.signin.id = P.group(dialed.national, dialed.iso); }
      else { S.signin.kind = P.kindOf(v); S.signin.id = v; }
      S.signin.error = ""; render();
      const f = document.getElementById("id"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
      return; }
    if(el.closest("[data-signin]")){ signin(); return; }
    if(el.closest("[data-pw]")){ signinPassword(); return; }
    if(el.closest("[data-passkey]")){ signinPasskey(); return; }
    if(el.closest("[data-create]")){ signinRegister(); return; }
    if(el.closest("[data-signin-back]")){ S.signin = { step:"id", id:S.signin.id, busy:false, error:"" }; render(); return; }
    if(el.closest("[data-signout]")){ S.token=null; S.user=null; S.locked=false;
      S.envAcked=false; S.envAsk=false; savePrefs(); render(); return; }
    // nothing else claimed the tap, so the only thing that changed is the menu
    if (closedDrop) render();
  };
  // a phone keyboard offers Go or Done, and people press it
  root.onkeydown = e=>{
    if (e.key !== "Enter") return;
    const id = e.target.id;
    if (id === "id") { e.preventDefault(); signin(); }
    else if (id === "pw") { e.preventDefault(); signinPassword(); }
    else if (id === "nm" && S.signin.step === "name") { e.preventDefault(); signinRegister(); }
  };
  // typing decides what the field is. Re-rendering on every keystroke would
  // fight the caret, so the shape is only redrawn when the kind actually flips.
  // Typing decides what the field is. A full redraw on every keystroke would
  // fight the caret, so it only happens when the head of the field actually
  // changes: a different kind, a different country, a different sort of
  // address. Everything else is patched in place.
  // Typing must never destroy the input. Re-rendering the screen on the first
  // keystroke replaced the field, put the caret back at zero, and every
  // following character landed in front of the last one, so the text came out
  // backwards. Nothing here calls render(): the parts that change are patched
  // in place around a field that is left alone.
  root.oninput = e=>{
    if (e.target.id === "ccsearch") { S.signin.search = e.target.value; paintCountryList(); return; }
    if (e.target.id !== "id" || S.token) return;
    const P = window.Phone, st = S.signin, el = e.target;
    const wasPhone = st.kind === "phone";
    const raw = el.value;

    let text = raw;
    const dialed = P.splitPasted(raw);
    if (dialed && dialed.national !== "") {
      // a recognisable dial code moves into the chip, the rest stays typed
      st.iso = dialed.iso; st.kind = "phone"; text = P.group(dialed.national, dialed.iso);
    } else if (/^\+/.test(raw)) {
      // still being typed: keep the plus visible rather than eating it
      st.kind = "phone"; text = raw;
    } else {
      st.kind = P.kindOf(raw);
      text = st.kind === "phone" ? P.group(raw, st.iso) : raw;
    }
    st.id = text;
    st.error = "";

    if (el.value !== text) {                       // regrouped: keep the caret at the end
      const atEnd = el.selectionStart === el.value.length;
      el.value = text;
      if (atEnd) el.setSelectionRange(text.length, text.length);
    }

    // the field's own attributes only change when it flips between the two
    const nowPhone = st.kind === "phone";
    if (nowPhone !== wasPhone) {
      const caret = el.selectionStart;
      el.type = nowPhone ? "tel" : "email";
      el.inputMode = nowPhone ? "tel" : "email";
      el.autocomplete = nowPhone ? "tel-national" : "username";
      try { el.setSelectionRange(caret, caret); } catch {}
    }
    paintIdField();
  };

  /** Everything around the input, redrawn without touching the input. */
  function paintIdField(){
    const P = window.Phone, st = S.signin;
    const wrap = document.querySelector(".idwrap");
    if (!wrap) return;
    wrap.classList.toggle("phone", st.kind === "phone");
    wrap.classList.toggle("mail", st.kind !== "phone");

    const lead = wrap.querySelector(".cc, .idlead");
    const tmp = document.createElement("div");
    tmp.innerHTML = idLeadHTML();
    if (lead) lead.replaceWith(tmp.firstElementChild);
    else wrap.insertBefore(tmp.firstElementChild, wrap.firstChild);

    const hint = document.querySelector(".idhint");
    const text = st.kind === "phone"
      ? `${P.name(st.iso, window.I18N.lang)} ${P.e164(st.iso, st.id)}`
      : (P.emailKind(st.id) !== "unknown"
          ? (P.emailKind(st.id) === "personal" ? t("signin.personal") : t("signin.work")) : "");
    if (hint) hint.textContent = text;
    const recents = document.querySelector(".recents");
    if (recents) recents.hidden = st.id.length > 0;
  }

  root.onchange = e=>{ const c=e.target.closest("[data-ctl]"); if(!c)return;
    if(c.dataset.ctl==="plat")S.plat=e.target.value;
    if(c.dataset.ctl==="form")S.form=e.target.value;
    if(c.dataset.ctl==="lang"){ S.lang=window.I18N.setLang(e.target.value); tellWorkerLang(); }
    savePrefs(); render(); };
}

async function reloadEnv(){
  // Identities are per environment, so a session from one is meaningless in the
  // other. Carrying it over is what made every screen come back empty.
  S.token=null; S.user=null; S.locked=false;
  S.signin={ ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
  savePrefs();
  S.ready=false; S.intents=[];S.timeline=[];S.solutions=[];S.catalog=[];S.inboxNext=null;S.tlNext=null;
  render();
  await Backend.probe();
  S.ready=true; render();
}
async function retryNow(){
  const ok = await Net.probe();
  if (ok){ Net.goOnline(); S.mode="connected"; await silentRefresh(); }
  else toast(`<div class="tm">${esc(t("net.failed"))}</div>`,"warn");
}
/** Turning one value of one axis on or off.
 *
 * The All row is not a value, it is the absence of all of them, so choosing it
 * empties the list rather than adding something called all. Unticking the last
 * remaining value lands in the same place, which is why nobody can end up
 * looking at nothing. */
function toggleFilter(axis, value){
  const cur = S.filter[axis] || [];
  S.filter[axis] = !value ? [] : cur.includes(value) ? cur.filter((x) => x !== value) : cur.concat([value]);
  savePrefs();
  applyFilter();
}

async function applyFilter(){
  S.intents = []; S.inboxNext = null; S.inboxTotal = 0;
  S.scrollTop = 0;                       // a new question starts at the top
  render();
  try { await Backend.refresh(); } catch {}
  render();
}

/* ---- moving between the inbox and a solution ---- */
const groupByKey = (key) => agentGroups(S.intents || []).find((g) => g.key === key);

/** Whichever list is on screen, since both group by agent and the first one is
 * open by default in each. Asking the wrong list would report every Activity
 * group as closed, so toggling one could only ever open it. */
const shownGroups = () => S.view === "activity"
  ? decidedGroups((S.timeline || []).filter((it) => ANSWERED.has(it.state)))
  : agentGroups(S.intents || []);
const groupOpenNow = (key) => {
  const gs = shownGroups();
  const i = gs.findIndex((g) => g.key === key);
  return i < 0 ? false : groupOpen(gs[i], i);
};

/** The solution an agent belongs to, opened on that agent.
 * Asked for because the question "who is this, and what else can they do"
 * comes up on every single ask, and the answer lives one screen away. */
function openSolutionFor(uid, agent){
  if (!uid) return;
  S.ask = null; S.focus = null; S.drop = null;
  S.view = "solutions"; S.selectedSol = uid; S.solAgent = agent || null;
  S.scrollTop = 0;
  render();
  if (agent) bringIntoView(`[data-agent="${cssq(agent)}"]`);
}

/** The other direction: one agent's asks, from the solution screen.
 * The inbox shows everyone. This narrows to the one agent whose count was
 * tapped, which is a different question and deserves a different answer. */
function focusAgentAsks(uid, agent){
  S.view = "inbox"; S.selectedSol = null; S.solAgent = null;
  S.filter = { solutions: uid ? [uid] : [], severities: [] };
  S.open.g = {}; S.open.a = {};
  const key = `${uid || "?"}::${agent}`;
  S.open.g[key] = true;
  savePrefs();
  S.scrollTop = 0;
  applyFilter().then(() => {
    // everyone else folds away, so the one that was asked for is the screen
    for (const g of agentGroups(S.intents || [])) if (g.key !== key) S.open.g[g.key] = false;
    render();
    bringIntoView(`[data-gkey="${cssq(key)}"]`);
  });
}

const cssq = (v) => String(v).replace(/["\\]/g, "\\$&");

/** Put something where it can be read, without yanking the page.
 * Called after a render, so the element is the new one, not the one that was
 * just thrown away. */
function bringIntoView(sel){
  requestAnimationFrame(() => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

/** Infinite scroll, with the button kept underneath. A sentinel is cheaper than
 * a scroll listener and does not fire a hundred times a second; the button
 * stays because a reader who never scrolls to the very bottom still needs it,
 * and because it is the only affordance a keyboard can reach. */
function watchForMore(){
  const el = document.querySelector("[data-more]");
  if (!el || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting) && !S.loadingMore) {
      io.disconnect();
      loadMore(el.dataset.more);
    }
  }, { root: document.querySelector(".screen-wrap"), rootMargin: "300px" });
  io.observe(el);
}

async function loadMore(which){
  if (S.loadingMore) return;
  S.loadingMore = true; render();
  try { await Backend.more(which); }
  catch(e){ toast(`<div class="tm">${esc(e.message)}</div>`,"warn"); }
  finally { S.loadingMore = false; render(); }
}

/** Optimistic: the card commits on screen at once, and rolls back if the
 * server disagrees. Offline it is queued and shown as queued, not as failed. */
async function decide(id, decision){
  const idx=S.intents.findIndex(x=>x.id===id); if(idx<0)return;
  const it=S.intents[idx];
  const edits={};
  document.querySelectorAll(`[data-edit="${id}"]`).forEach(inp=>{
    const o=it.details?it.details[inp.dataset.key]:undefined; let v=inp.value;
    if(typeof o==="number")v=Number(v);
    if(String(o)!==String(v))edits[inp.dataset.key]=v; });

  const go=async ()=>{
    S.settled[id]=decision; render();                       // the card starts leaving
    await new Promise(r=>setTimeout(r,180));
    const snapshot = S.intents.slice();
    S.intents = S.intents.filter(x=>x.id!==id);
    S.inboxTotal = Math.max(0, S.inboxTotal-1);
    const done = Object.assign({}, it, { state:
      decision==="deny" ? "denied" : decision==="reflect" ? "reflected"
      : (Object.keys(edits).length ? "edited" : "approved"), decidedAt: Date.now() });
    S.timeline = [done].concat(S.timeline); S.tlTotal++;
    delete S.settled[id];
    if (S.focus) {
      const left = S.intents.filter((i) => !S.focus.uid || (i.solution && i.solution.uid) === S.focus.uid);
      if (S.focus.at >= left.length) S.focus.at = Math.max(0, left.length - 1);
    }
    render();
    try {
      const sent = await Backend.decide(id, decision, Object.keys(edits).length?{edited_details:edits}:{});
      if (sent){ silentRefresh();
        toast(`<div class="tm"><b>${esc(t("card."+decision))}</b> ${esc(pretty(it.capability))}</div>`,decision==="deny"?"warn":"ok"); }
      else { toast(`<span class="tic">${I.cloudoff}</span><div class="tm">${esc(t("t.queued"))}</div>`,"queued"); paintNet(); }
    } catch(e){
      S.intents = snapshot; S.inboxTotal++; S.timeline = S.timeline.filter(x=>x!==done); S.tlTotal--;
      render();
      toast(`<div class="tm">${esc(t("t.recordFail",{msg:e.message}))}</div>`,"warn");
    }
  };
  if(decision==="approve" && it.severity==="SEVERE"){ biometric(go); return; }
  go();
}

/** A group answered at once. The cards leave together, and anything the server
 * refused to sweep, which is only ever something severe, is put back so it can
 * be looked at on its own. */
async function decideGroup(decision, ids, count){
  const keep = new Set(ids);
  const before = S.intents;
  S.intents = S.intents.filter((i) => !keep.has(i.id));
  S.inboxTotal = Math.max(0, S.inboxTotal - ids.length);
  render();
  try {
    const out = await Backend.decideMany(decision, ids);
    const skipped = (out && out.skipped) || [];
    if (skipped.length) {
      const back = new Set(skipped.map((x) => x.id));
      S.intents = before.filter((i) => back.has(i.id)).concat(S.intents);
      S.inboxTotal += skipped.length;
    }
    await silentRefresh();
    toast(`<div class="tm"><b>${esc(t("t.decidedMany",{n:(out&&out.decided)||count}))}</b>${
      skipped.length ? " " + esc(t("ok.severeKept")) : ""}</div>`, decision === "deny" ? "warn" : "ok");
  } catch (e) {
    S.intents = before; S.inboxTotal += ids.length; render();
    toast(`<div class="tm">${esc(t("t.recordFail",{msg:e.message}))}</div>`,"warn");
  }
}

async function connect(uid){
  const c=S.catalog.find(x=>x.uid===uid); const name=c?c.name:"Solution";
  try{
    const r=await Backend.connect(uid);
    await Backend.refresh(); S.review=null; S.reviewData=null; S.view="inbox"; render();
    toast(`<span class="slogo sm">${I.logo}</span><div class="tm"><b>${esc(t("t.connected",{name}))}</b>${r&&r.pending?`. ${esc(tn("t.toReview",r.pending))}`:''}</div>`,"ok");
  } catch(e){ toast(`<div class="tm">${esc(t("t.connectFail",{msg:e.message}))}</div>`,"warn"); }
}
async function setAppetite(link,cat,level){
  const s=S.solutions.find(x=>x.link===link);
  if(s){ s.appetite=s.appetite||{...DEFAULT_APPETITE}; s.appetite[cat]=level; }
  render();
  try{ await Backend.setAppetite(link,{[cat]:level}); }catch{}
}
async function setStatus(link,to){
  const s=S.solutions.find(x=>x.link===link); if(s)s.status=to; render();
  try{ await Backend.setStatus(link,to); }catch{}
}
/** Only a builder is ever asked, and only while they have not waved it away. */
function maybeAskEnv(){
  if (S.token && canSwitchEnv() && !S.envAcked) S.envAsk = true;
}

/** Keep the last few, newest first, without duplicates. Three is enough to be
 * useful and few enough to stay out of the way. */
function rememberIdentifier(v){
  if (!v) return;
  S.recent = [v, ...(S.recent || []).filter((x) => x !== v)].slice(0, 3);
  savePrefs();
}

/** Step one. An address is all we need to find out whether this person has an
 * account. What comes back decides the next question. */
async function signin(){
  const el = document.getElementById("id");
  const id = (el ? el.value : "").trim();
  const P = window.Phone, st = S.signin;
  st.id = id;                            // keep what was typed, whatever happens next
  if (!id) { st.error = t("signin.needId"); render(); return; }

  let identifier;
  if (st.kind === "phone") {
    if (!P.validPhone(st.iso, id)) {
      const n = P.digits(id).length, span = { US:10, CA:10 }[st.iso];
      const dir = t(n && span && n > span ? "signin.tooLong" : "signin.tooShort");
      st.error = t("signin.badPhone", { dir, country: P.name(st.iso, window.I18N.lang) });
      render(); return;
    }
    identifier = P.e164(st.iso, id);     // stored and sent in E.164, always
  } else {
    if (!P.validEmail(id)) { st.error = t("signin.badId"); render(); return; }
    identifier = id.trim();
  }
  st.identifier = identifier;
  st.error = ""; st.busy = true; render();
  try {
    await Backend.login(identifier);
    rememberIdentifier(S.signin.identifier || S.signin.id);
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    maybeAskEnv();            // a builder is told which world they just entered
    await Backend.refresh(); S.view = "inbox"; render();
  } catch (e) {
    S.signin.busy = false;
    if (e.status === 404)      S.signin.step = "name";       // new here, ask who they are
    else if (e.status === 401) S.signin.step = "password";   // the one account that has one
    else S.signin.error = e.message || t("net.failed");
    render();
  }
}

/** Step two, for the one account that carries a password. */
async function signinPassword(){
  const el = document.getElementById("pw");
  const pw = el ? el.value : "";
  if (!pw) { S.signin.error = t("signin.needPw"); render(); return; }
  S.signin.error = ""; S.signin.busy = true; render();
  try {
    await Backend.login(S.signin.identifier || S.signin.id, pw);
    rememberIdentifier(S.signin.identifier || S.signin.id);
    if (S.mode !== "connected") await Backend.refresh();
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    maybeAskEnv();            // a builder is told which world they just entered
    await Backend.refresh(); S.view = "inbox"; render();
  } catch (e) {
    S.signin.busy = false;
    S.signin.error = e.status === 401 ? t("signin.needPw") : (e.message || t("net.failed"));
    render();
  }
}

/** The phone's own lock, standing in for the password.
 *
 * Only offered when all three things are true: the device holds a platform
 * credential, it holds a remembered session for this identifier, and the
 * account is not the review account. A face is a better proof than a typed
 * password and it works with the radio off, which is the point. */
function passkeyOffered(identifier){
  return !!(S.lockCred && Vault.read(S.env, identifier) && normId(identifier) !== REVIEW_ID);
}

async function signinPasskey(){
  const id = S.signin.identifier || S.signin.id;
  if (!passkeyOffered(id)) return;
  S.signin.error = ""; S.signin.busy = true; render();
  try {
    const got = await navigator.credentials.get({ publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type:"public-key", id: unb64(S.lockCred) }],
      userVerification: "required", timeout: 60000,
    }});
    if (!got) throw new Error("cancelled");
    Vault.restore(id);
    rememberIdentifier(id);
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    maybeAskEnv();            // a builder is told which world they just entered
    S.view = "inbox";
    try { await Backend.refresh(); } catch {}
    render();
  } catch {
    S.signin.busy = false; S.signin.error = t("t.lockDenied"); render();
  }
}

/** Step two, for someone new. Registration is the only place a name is asked. */
async function signinRegister(){
  const el = document.getElementById("nm");
  const name = (el ? el.value : "").trim();
  S.signin.error = ""; S.signin.busy = true; render();
  try {
    await Backend.register(S.signin.identifier || S.signin.id, name || undefined);
    rememberIdentifier(S.signin.identifier || S.signin.id);
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    maybeAskEnv();            // a builder is told which world they just entered
    await Backend.refresh(); S.view = "inbox"; render();
  } catch (e) {
    S.signin.busy = false;
    S.signin.error = e.message || t("net.failed");
    render();
  }
}

boot();
