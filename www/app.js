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

const { t, tn, tAgo, tList, tCat, tSev, tWhy, isRTL, LANGS } = window.I18N;
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
const BASE = new URLSearchParams(location.search).get("api")
  || (NATIVE ? (window.XURFACE_API || "https://xurface.500xlaunch.com") : location.origin);
const ENVS = { test:{label:"Test"}, live:{label:"Live"} };
const PAGE = 25;

let S = loadPrefs();
function loadPrefs(){
  let p; try{ p = JSON.parse(localStorage.getItem("discern.prefs")||"null"); }catch{ p=null; }
  // live is what a person gets; test is opt in from Settings and shows a chip
  const base = { env:"live", plat:"apple", form:"phone", theme:"system", lang:null,
    fullscreen: !matchMedia("(min-width:900px)").matches, token:null, user:null,
    // the screen lock is per device, so its credential id lives with the prefs
    lockCred:null };
  const s = Object.assign(base, p||{});
  return Object.assign(s, { view:"inbox", mode:"connecting", ready:false,
    intents:[], timeline:[], solutions:[], catalog:[],
    inboxNext:null, inboxTotal:0, tlNext:null, tlTotal:0, loadingMore:false,
    selectedSol:null, review:null, reviewData:null,
    push:{ supported:"serviceWorker" in navigator && "PushManager" in window, permission:
      (typeof Notification!=="undefined" ? Notification.permission : "default"), on:false, busy:false },
    // splash runs once per launch; the lock is cleared once per launch too, so
    // reopening the app asks again while moving between screens does not
    splash:true, locked:false, lockBusy:false,
    // sign in walks: identifier, then a password or a name, never both at once
    signin:{ step:"id", id:"", busy:false, error:"",
             // the field decides for itself which of the two it is holding
             kind:"empty", iso:(window.Phone ? window.Phone.detect() : "US"), picker:false, search:"",
             pw:"", showPw:false },
    net:Net.state, settled:{} });
}
function savePrefs(){ try{ localStorage.setItem("discern.prefs", JSON.stringify({
  env:S.env,plat:S.plat,form:S.form,theme:S.theme,lang:S.lang,fullscreen:S.fullscreen,
  token:S.token,user:S.user,lockCred:S.lockCred})); }catch{} }
function applyTheme(){ const q=new URLSearchParams(location.search).get("theme"); const th=q||S.theme;
  if (th==="light"||th==="dark") document.documentElement.dataset.theme=th; else delete document.documentElement.dataset.theme; }

/* ---------------- backend ---------------- */
const Backend = {
  async probe(){
    const ok = await Net.probe();
    if (ok) { Net.goOnline(); S.mode = "connected"; return true; }
    const cached = Net.cache.read(S.env);
    S.mode = (S.token && cached) ? "degraded" : "demo";
    if (S.mode === "demo") Local.seed(); else Net.goOffline();
    return false;
  },
  /** Sign in to an account that exists. Throws 404 when it does not, which is
   * how the app knows to ask who this person is. */
  async login(identifier, password){
    if (S.mode==="demo") return Local.login(identifier);
    const out = await Net.request("POST","/v1/user/login",{identifier,password},{auth:false});
    S.token = out.token; S.user = out.user; savePrefs();
  },
  async register(identifier, name){
    if (S.mode==="demo") return Local.login(identifier,name);
    const out = await Net.request("POST","/v1/user/register",{identifier,name},{auth:false});
    S.token = out.token; S.user = out.user; savePrefs();
  },
  /** First page of everything. Falls back to the cached view, then to demo. */
  async refresh(){
    if (S.mode==="demo") return Local.refresh();
    try {
      const [inbox, timeline, sols, cat] = await Promise.all([
        Net.request("GET",`/v1/user/inbox?limit=${PAGE}`),
        Net.request("GET",`/v1/user/timeline?limit=${PAGE}`),
        Net.request("GET","/v1/user/solutions"),
        Net.request("GET","/v1/user/solutions/search?q="),
      ]);
      S.intents = inbox.intents; S.inboxNext = inbox.next||null; S.inboxTotal = inbox.total ?? inbox.intents.length;
      S.timeline = timeline.intents; S.tlNext = timeline.next||null; S.tlTotal = timeline.total ?? timeline.intents.length;
      S.solutions = sols.solutions;
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
  async more(which){
    if (S.mode!=="connected") return;
    const cur = which==="inbox" ? S.inboxNext : S.tlNext;
    if (!cur) return;
    const path = which==="inbox" ? "/v1/user/inbox" : "/v1/user/timeline";
    const out = await Net.request("GET",`${path}?limit=${PAGE}&cursor=${encodeURIComponent(cur)}`);
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
    seed(){ if (st.seeded) return; st.seeded=true; },
    async login(email,name){ S.token="local"; S.user={id:"usr_local",email,name:name||"You"}; savePrefs(); },
    async refresh(){
      S.intents = st.intents.slice(0,PAGE); S.inboxNext=null; S.inboxTotal=st.intents.length;
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
      let pending=0; for (const a of s.agents) for (const ab of a.abilities){ const v=reconcile(ab.risk,ab.severity,st.links[uid].appetite,ab.discernment); const rec={id:id("int"),solName:s.name,agent:a.name,capability:ab.key,details:sample(ab.key),risk:ab.risk,severity:ab.severity,reasons:v.reasons,discernment:ab.discernment,appetite:st.links[uid].appetite,at:Date.now(),hash:hash(),sol:uid,link}; if (v.allow){ rec.state="allowed"; st.timeline.unshift(rec);} else { rec.state="pending"; st.intents.unshift(rec); pending++; } }
      return {ok:true,pending}; },
    async decide(id2,decision,opts){ const i=st.intents.findIndex(x=>x.id===id2); if(i<0)return; const it=st.intents.splice(i,1)[0]; it.state=decision==="deny"?"denied":(opts&&opts.edited_details)?"edited":"approved"; if(opts&&opts.edited_details)it.details={...it.details,...opts.edited_details}; it.decidedAt=Date.now(); it.hash=hash(); st.timeline.unshift(it); },
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
  render();

  Net.start({ base:BASE, env:()=>S.env, token:()=>S.token,
    onReplayed:(n)=>{ toast(`<span class="tic">${I.sync}</span><div class="tm">${esc(t("net.back"))}. ${esc(tn("net.queued",n))}</div>`,"ok"); silentRefresh(); } });
  Net.subscribe((st)=>{ const was=S.net.link; S.net=st;
    if (st.link==="online" && was!=="online" && was!=="unknown"){ S.mode="connected"; silentRefresh(); }
    paintNet(); });

  // the lock decision is made once per launch, before anything is shown
  S.locked = !!(S.token && S.lockCred && lockOffered());

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
  setTimeout(() => { S.splash = false; render(); }, q.get("nosplash") ? 0 : 1650);

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
  try { await Backend.refresh(); render(); } catch {}
}

/* ---------------- screen lock ----------------
   A device level gate, not a second sign in: the session is already valid, so
   this only decides whether this phone will show it. It uses the platform
   authenticator, which is Face ID, Touch ID or the device PIN depending on the
   hardware, through WebAuthn.

   The review account never sees any of it. A store reviewer can enrol no
   biometric, and a lock they cannot open is a failed review. */
const lockSupported = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
const isReviewer = () => !!(S.user && S.user.review);
const lockOffered = () => lockSupported() && !isReviewer();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64 = (s2) => { const b=atob(s2.replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from([...b].map(c=>c.charCodeAt(0))); };
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

async function enableLock(){
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
    S.lockCred = b64(cred.rawId); savePrefs();
    toast(`<span class="tic">${I.shield}</span><div class="tm">${esc(t("t.lockOn"))}</div>`,"ok");
  } catch(e){ toast(`<div class="tm">${esc(t("t.lockFail",{msg:e.message||"cancelled"}))}</div>`,"warn"); }
  finally { S.lockBusy=false; render(); }
}
function disableLock(){
  S.lockCred = null; S.locked = false; savePrefs(); render();
  toast(`<div class="tm">${esc(t("t.lockOff"))}</div>`,"ok");
}
async function unlock(){
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

function render(){
  const root = document.getElementById("root");
  root.innerHTML = shellHTML();
  const app = document.getElementById("app-root");
  if (app) app.innerHTML = S.splash ? splashHTML()
                         : S.locked ? lockHTML()
                         : !S.token ? signinHTML() : appHTML();
  applyDevice(); wire(); paintNet();
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
  return `<div class="safe-top"></div>
  <header class="topbar">${MK}<span class="title">${esc(t("app.short"))}</span>
    ${S.env !== "live" ? `<button class="envchip ${S.env}" data-toggle-env aria-label="${esc(t("set.env"))}">${ENVS[S.env].label}</button>` : ""}
    <span class="spacer"></span>
    <button class="iconbtn" data-nav="inbox" aria-label="${esc(t("nav.inbox"))}">${I.bell}${pending?`<span class="count">${pending>9?'9+':pending}</span>`:''}</button>
  </header>
  <div id="netbar"></div>
  <div class="body">
    ${wide?`<nav class="rail">${nav.map(([v,l,ic])=>`<a href="#" data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${esc(l)}</span>${v==="inbox"&&pending?`<span class="railcount">${pending}</span>`:''}</a>`).join("")}<span class="railgrow"></span><div class="railuser">${esc((S.user&&S.user.name)||t("set.you"))}</div></nav>`:''}
    <main class="screen-wrap"><div class="wrap">${!S.ready?skeletonHTML():screenHTML()}</div></main>
  </div>
  ${wide?'':`<nav class="tabbar">${nav.map(([v,l,ic])=>`<button data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${esc(l)}</span>${v==="inbox"&&pending?'<span class="tabdot"></span>':''}</button>`).join("")}</nav>`}
  <div id="overlay"></div>`;
}
function screenHTML(){ return ({inbox:inboxHTML,activity:activityHTML,solutions:solutionsHTML,settings:settingsHTML}[S.view]||inboxHTML)(); }

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
function inboxHTML(){
  const n = S.inboxTotal || S.intents.length;
  const head = `<div class="scrhead"><span class="eyebrow">${esc(t("inbox.eyebrow"))}</span><h1>${esc(t("inbox.title"))}</h1>
    <p class="sub">${esc(n?tn("inbox.sub",n):t("inbox.caughtUp"))}</p></div>`;
  if (!S.intents.length) return head + `<div class="empty"><div class="empty-mk">${MK}</div>
    <div class="empty-t">${esc(t("inbox.empty.title"))}</div><p>${esc(t("inbox.empty.body"))}</p>
    <button class="btn btn-primary" data-nav="solutions">${esc(t("inbox.browse"))}</button></div>`;
  return head + `<div class="cards">${S.intents.map(cardHTML).join("")}</div>` + moreHTML("inbox");
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
function cardHTML(it){
  const sev = it.severity, settling = S.settled[it.id];
  const queued = Net.queuedFor(it.id);
  const rows = Object.entries(it.details||{}).slice(0,4).map(([k,v])=>{
    const editable = (typeof v==="number"||typeof v==="string");
    return `<div class="drow"><span class="dk">${esc(k)}</span>${editable?`<input class="dv-in" data-edit="${it.id}" data-key="${esc(k)}" value="${esc(v)}"/>`:`<span class="dv">${esc(Array.isArray(v)?v.join(", "):v)}</span>`}</div>`;
  }).join("");
  const risks = Object.entries(it.risk||{}).sort((a,b)=>ORD[b[1]]-ORD[a[1]])
    .map(([c,s])=>`<span class="rchip" style="--c:${sevColor(s)};--b:${sevBg(s)}">${esc(t("risk.chip",{cat:tCat(c),sev:tSev(s)}))}</span>`).join("");
  const why = tWhy(it, it.appetite, it.reasons)[0];
  return `<article class="icard ${settling?("settling "+settling):""}" data-card="${it.id}" style="--sev:${sevColor(sev)};--sevb:${sevBg(sev)}">
    <div class="icard-top">
      <span class="slogo">${I.logo}</span>
      <div class="iwho"><div class="isol">${esc(iName(it))}</div><div class="iagent">${esc(iAgent(it))}</div></div>
      <span class="sevtag">${esc(tSev(sev))}</span>
    </div>
    <div class="iact">${esc(pretty(it.capability))}</div>
    <div class="rchips">${risks}</div>
    ${why?`<div class="ireason">${esc(why)}</div>`:''}
    ${rows?`<div class="idetails">${rows}</div>`:''}
    ${queued?`<div class="iqueued">${I.cloudoff}<span>${esc(t("card.queued"))}</span></div>`:`<div class="iacts">
      <button class="btn btn-deny" data-decide="deny" data-id="${it.id}" ${settling?"disabled":""}>${esc(settling==="deny"?t("card.denying"):t("card.deny"))}</button>
      <button class="btn btn-primary" data-decide="approve" data-id="${it.id}" ${settling?"disabled":""}>${esc(settling==="approve"?t("card.approving"):t("card.approve"))}</button>
    </div>`}
  </article>`;
}

/* ---- activity ---- */
function activityHTML(){
  const head = `<div class="scrhead"><span class="eyebrow">${esc(t("activity.eyebrow"))}</span><h1>${esc(t("activity.title"))}</h1>
    <p class="sub">${esc(t("activity.sub"))}</p></div>`;
  if (!S.timeline.length) return head + `<div class="empty"><div class="empty-mk">${I.activity}</div><div class="empty-t">${esc(t("activity.empty"))}</div></div>`;
  return head + `<div class="tl">${S.timeline.map(it=>`<div class="tlrow">
    <span class="tlic" style="--c:${sevColor(it.severity)};--b:${sevBg(it.severity)}">${it.state==="denied"?I.pause:I.play}</span>
    <div class="tlm"><div class="tlt">${esc(pretty(it.capability))}</div>
      <div class="tls">${esc(iAgent(it))} at ${esc(iName(it))}, ${esc(tAgo(iAt(it)))}</div></div>
    <div class="tlend"><span class="stpill st-${it.state}">${esc(stateLabel(it.state))}</span><span class="ref">${iRef(it)}</span></div>
  </div>`).join("")}</div>` + moreHTML("activity");
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
    <span class="slogo big">${I.logo}</span>
    <div class="solm"><div class="soln">${esc(s.name)}</div>
      <div class="solmeta">${esc(tn("sol.agents",(s.agents||[]).length))}, ${esc(tn("sol.abilities",nab))}</div>
      ${surf.length?`<div class="solasks">${esc(t("sol.asksAbout",{list:tList(surf.slice(0,3).map(tCat))}))}</div>`:`<div class="solasks quiet">${esc(t("sol.runsRoutine"))}</div>`}
    </div>
    <div class="solend"><span class="stpill st-${s.status}">${esc(linkLabel(s.status))}</span>${I.chevron}</div>
  </button>`;
}
function catcardHTML(c){
  return `<div class="catcard">
    <div class="cattop"><span class="slogo big grad">${I.logo}</span><div class="catm"><div class="catn">${esc(c.name)}</div>${c.agents?`<div class="catmeta">${esc(tn("sol.agents",c.agents.length))}</div>`:''}</div></div>
    <p class="catd">${esc(c.description||"")}</p>
    <button class="btn btn-primary block" data-review="${c.uid}">${I.shield}<span>${esc(t("sol.seeWhat"))}</span></button>
  </div>`;
}
function soldetailHTML(s){
  const nab = (s.agents||[]).reduce((n,a)=>n+(a.abilities||[]).length,0);
  return `<button class="back" data-back>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
  <div class="soldhead"><span class="slogo xl grad">${I.logo}</span><div><div class="soldn">${esc(s.name)}</div>
    <div class="soldsub">${esc(tn("sol.agents",(s.agents||[]).length))}, ${esc(tn("sol.abilities",nab))}</div></div>
    <span class="stpill st-${s.status}">${esc(linkLabel(s.status))}</span></div>
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
function reviewHTML(){
  const p = S.reviewData;
  if (!p) return `<button class="back" data-back-review>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
    <div class="sk-review">${[0,1,2,3].map(i=>`<div class="abrow sk-card" style="--d:${i*70}ms"><span class="sk sk-logo sm"></span>
      <div class="abm"><span class="sk sk-line w70"></span><span class="sk sk-line w40"></span></div></div>`).join("")}
    <div class="sk-note">${esc(t("rev.reading"))}</div></div>`;
  const s = p.solution;
  return `<button class="back" data-back-review>${I.chevron}<span>${esc(t("sol.back"))}</span></button>
  <div class="soldhead"><span class="slogo xl grad">${I.logo}</span>
    <div><div class="soldn">${esc(s.name)}</div><div class="soldsub">${esc(tn("sol.agents",p.counts.agents))}, ${esc(tn("sol.abilities",p.counts.abilities))}</div></div></div>
  ${s.description?`<p class="sub" style="margin:-2px 0 4px">${esc(s.description)}</p>`:''}
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
  ${lockOffered() ? `<section class="panel"><div class="panelhd"><h3>${esc(t("set.lock"))}</h3><p>${esc(t("set.lockSub"))}</p></div>
    ${S.lockCred
      ? `<div class="kv"><span>${esc(t("set.lockReady"))}</span><b class="ok">${I.check}</b></div>
         <button class="btn btn-ghost block" data-lock="off">${esc(t("set.lockOff"))}</button>`
      : `<button class="btn btn-primary block" data-lock="on" ${S.lockBusy?"disabled":""}>
           ${S.lockBusy?`<span class="tic spin">${I.sync}</span>`:I.face}<span>${esc(t("set.lockOn"))}</span></button>`}
  </section>` : (isReviewer() ? "" : `<section class="panel"><div class="panelhd"><h3>${esc(t("set.lock"))}</h3></div>
    <div class="thin-empty">${esc(t("set.lockNo"))}</div></section>`)}
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.language"))}</h3></div>
    <div class="langgrid">${LANGS.map(l=>`<button class="langb ${window.I18N.lang===l.code?'on':''}" data-lang="${l.code}">
      <b>${l.native}</b><small>${l.name}</small></button>`).join("")}</div></section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.env"))}</h3><p>${esc(t("set.envSub"))}</p></div>
    <div class="envseg">${Object.entries(ENVS).map(([k,e])=>`<button class="${S.env===k?'on':''}" data-env="${k}">${e.label}</button>`).join("")}</div></section>
  <section class="panel"><div class="panelhd"><h3>${esc(t("set.appearance"))}</h3></div>
    <div class="envseg">${[["system",t("set.system")],["light",t("set.light")],["dark",t("set.dark")]].map(([k,l])=>`<button class="${S.theme===k?'on':''}" data-theme-set="${k}">${esc(l)}</button>`).join("")}</div></section>
  <section class="panel"><button class="btn btn-ghost block" data-signout>${esc(t("set.signOut"))}</button></section>
  <p class="motto">${esc(t("app.motto")).replace(/\n/g,"<br/>")}</p>`;
}

/* ---- launch ----
   The mark draws itself, the motto arrives under it, then the app. It is the
   one moment the product gets to say what it is before asking for anything. */
function splashHTML(){
  return `<div class="splash">
    <div class="splash-mk">${MK}</div>
    <div class="splash-name">${esc(t("app.name"))}</div>
    <p class="splash-motto">${esc(t("app.motto")).replace(/\n/g,"<br/>")}</p>
  </div>`;
}

/* ---- screen lock ---- */
function lockHTML(){
  return `<div class="safe-top"></div><div class="lockscreen">
    <div class="lock-mk">${MK}</div>
    <h1>${esc(t("lock.title"))}</h1>
    <p class="lock-body">${esc(t("lock.body"))}</p>
    <button class="btn btn-primary block big" data-unlock ${S.lockBusy?"disabled":""}>
      ${S.lockBusy?`<span class="tic spin">${I.sync}</span>`:I.face}<span>${esc(t("lock.unlock"))}</span></button>
    <button class="btn btn-ghost block" data-signout>${esc(t("lock.signout"))}</button>
  </div>`;
}

/* ---- sign in ----
   One question at a time. An address first, because that is all we need to know
   whether this person already has an account. Only if they do not do we ask who
   they are, and only the account that has a password is ever shown a password
   field. */
function signinHTML(){
  const st = S.signin;
  const err = st.error ? `<div class="signin-err">${esc(st.error)}</div>` : "";
  const head = `<div class="signin-mk">${MK}</div>
    <h1>${esc(t("app.name"))}</h1><p class="signin-motto">${esc(t("app.motto")).replace(/\n/g,"<br/>")}</p>`;

  if (st.step === "name") {
    return `<div class="safe-top"></div><div class="signin">${head}
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
    return `<div class="safe-top"></div><div class="signin">${head}
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
      <button class="btn btn-ghost block" data-signin-back>${esc(t("signin.back"))}</button>
      <div id="overlay"></div></div>`;
  }

  const P = window.Phone;
  const isPhone = st.kind === "phone";
  const c = P.BY_ISO[st.iso] || P.BY_ISO.US;
  const picker = st.picker ? countryPickerHTML() : "";

  return `<div class="safe-top"></div><div class="signin">${head}
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
    const nav=el.closest("[data-nav]"); if(nav){ e.preventDefault(); S.view=nav.dataset.nav; S.selectedSol=null; render(); return; }
    if(el.closest("[data-ctl='fullscreen']")){ S.fullscreen=!S.fullscreen; savePrefs(); render(); return; }
    if(el.closest("[data-toggle-env]")){ S.env=S.env==="test"?"live":"test"; savePrefs(); reloadEnv(); return; }
    const envb=el.closest("[data-env]"); if(envb){ S.env=envb.dataset.env; savePrefs(); reloadEnv(); return; }
    const lg=el.closest("[data-lang]"); if(lg){ S.lang=window.I18N.setLang(lg.dataset.lang); savePrefs(); tellWorkerLang(); render(); return; }
    const th=el.closest("[data-theme-set]"); if(th){ S.theme=th.dataset.themeSet; savePrefs(); applyTheme(); render(); return; }
    const dec=el.closest("[data-decide]"); if(dec){ decide(dec.dataset.id,dec.dataset.decide); return; }
    const mr=el.closest("[data-more]"); if(mr){ loadMore(mr.dataset.more); return; }
    if(el.closest("[data-retry]")){ retryNow(); return; }
    if(el.closest("[data-enablepush]")){ enablePush(); return; }
    if(el.closest("[data-unlock]")){ unlock(); return; }
    const lk=el.closest("[data-lock]"); if(lk){ lk.dataset.lock==="on" ? enableLock() : disableLock(); return; }
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
    if(el.closest("[data-signin]")){ signin(); return; }
    if(el.closest("[data-pw]")){ signinPassword(); return; }
    if(el.closest("[data-create]")){ signinRegister(); return; }
    if(el.closest("[data-signin-back]")){ S.signin = { step:"id", id:S.signin.id, busy:false, error:"" }; render(); return; }
    if(el.closest("[data-signout]")){ S.token=null; S.user=null; S.locked=false; savePrefs(); render(); return; }
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
  root.oninput = e=>{
    if (e.target.id === "ccsearch") { S.signin.search = e.target.value; paintCountryList(); return; }
    if (e.target.id !== "id" || S.token) return;
    const P = window.Phone, st = S.signin, before = idShape();
    const raw = e.target.value;

    // a dial code, typed or pasted, moves the country as it is recognised
    const dialed = P.splitPasted(raw);
    if (dialed) { st.iso = dialed.iso; st.kind = "phone"; st.id = P.group(dialed.national, dialed.iso); }
    else {
      st.kind = P.kindOf(raw);
      st.id = st.kind === "phone" ? P.group(raw, st.iso) : raw;
    }
    st.error = "";

    if (idShape() !== before) {
      render();
      const el = document.getElementById("id");
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      return;
    }
    if (e.target.value !== st.id) {                  // regrouped, caret at the end
      e.target.value = st.id;
      e.target.setSelectionRange(st.id.length, st.id.length);
    }
    const hint = document.querySelector(".idhint");
    if (hint && st.kind === "phone") hint.textContent = `${P.name(st.iso, window.I18N.lang)} ${P.e164(st.iso, st.id)}`;
  };

  root.onchange = e=>{ const c=e.target.closest("[data-ctl]"); if(!c)return;
    if(c.dataset.ctl==="plat")S.plat=e.target.value;
    if(c.dataset.ctl==="form")S.form=e.target.value;
    if(c.dataset.ctl==="lang"){ S.lang=window.I18N.setLang(e.target.value); tellWorkerLang(); }
    savePrefs(); render(); };
}

async function reloadEnv(){
  S.ready=false; S.intents=[];S.timeline=[];S.solutions=[];S.catalog=[];S.inboxNext=null;S.tlNext=null; render();
  await Backend.probe();
  if(S.token){ try{ await Backend.refresh(); }catch{} }
  S.ready=true; render();
}
async function retryNow(){
  const ok = await Net.probe();
  if (ok){ Net.goOnline(); S.mode="connected"; await silentRefresh(); }
  else toast(`<div class="tm">${esc(t("net.failed"))}</div>`,"warn");
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
    const done = Object.assign({}, it, { state: decision==="deny"?"denied":(Object.keys(edits).length?"edited":"approved"), decidedAt: Date.now() });
    S.timeline = [done].concat(S.timeline); S.tlTotal++;
    delete S.settled[id]; render();
    try {
      const sent = await Backend.decide(id, decision, Object.keys(edits).length?{edited_details:edits}:{});
      if (sent){ silentRefresh();
        toast(`<div class="tm"><b>${esc(decision==="deny"?t("card.deny"):t("card.approve"))}</b> ${esc(pretty(it.capability))}</div>`,decision==="deny"?"warn":"ok"); }
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
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
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
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    await Backend.refresh(); S.view = "inbox"; render();
  } catch (e) {
    S.signin.busy = false;
    S.signin.error = e.status === 401 ? t("signin.needPw") : (e.message || t("net.failed"));
    render();
  }
}

/** Step two, for someone new. Registration is the only place a name is asked. */
async function signinRegister(){
  const el = document.getElementById("nm");
  const name = (el ? el.value : "").trim();
  S.signin.error = ""; S.signin.busy = true; render();
  try {
    await Backend.register(S.signin.identifier || S.signin.id, name || undefined);
    S.signin = { ...S.signin, step:"id", id:"", error:"", busy:false, pw:"", showPw:false };
    await Backend.refresh(); S.view = "inbox"; render();
  } catch (e) {
    S.signin.busy = false;
    S.signin.error = e.message || t("net.failed");
    render();
  }
}

boot();
