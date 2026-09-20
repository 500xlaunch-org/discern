/* Xurface Discern - the app. One responsive UI, framed by a web device simulator.
   Demo mode runs a self-contained mock Horizon (with the real scoring model) so
   you can try the whole loop offline; Test/Live connect to a real Horizon. */
"use strict";

/* ---------------- icons ---------------- */
const MK = `<svg class="mk" viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path class="wave" d="M 28 160 C 59.9 160, 54.1 96, 86 96 C 117.9 96, 112.1 160, 144 160 C 160 160, 166 156, 166 128"/><circle cx="200" cy="128" r="34"/></svg>`;
const I = {
  inbox:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h5l2 3h4l2-3h5"/><path d="M4 12l2-7h12l2 7v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/></svg>`,
  activity:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6"/></svg>`,
  solutions:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/></svg>`,
  examples:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 9-14 9z"/></svg>`,
  settings:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>`,
  x:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  edit:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18 10l-4-4L4 16z"/><path d="M13 5l4 4"/></svg>`,
  face:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 10v1M15 10v1M12 9v3l-1 1M9 15c1 1 5 1 6 0"/></svg>`,
  logo:`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7.4" height="7.4" rx="1.6"/><rect x="13.6" y="3" width="7.4" height="7.4" rx="1.6"/><rect x="3" y="13.6" width="7.4" height="7.4" rx="1.6"/><rect x="13.6" y="13.6" width="7.4" height="7.4" rx="1.6"/></svg>`,
  chevron:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/></svg>`,
};

/* ---------------- the risk model (mirrors Horizon) ---------------- */
const SEVS = ["LOW","MEDIUM","HIGH","SEVERE"], ORD = {LOW:0,MEDIUM:1,HIGH:2,SEVERE:3};
const maxSev = (a,b)=> ORD[a]>=ORD[b]?a:b, gt = (a,b)=> ORD[a]>ORD[b];
const bump = s => SEVS[Math.min(3,ORD[s]+1)];
const CATS = {
  identity:{label:"Identity / Auth",maps:"NIST 800-63 / ISO 24760"},
  financial:{label:"Financial",maps:"PCI-DSS / ISO 27001"},
  location:{label:"Location",maps:"ISO 27701 (PII)"},
  intellectual:{label:"Intellectual property",maps:"ISO 27001 A.5 / NIST MP"},
  conversation:{label:"Conversation",maps:"NIST SC / ISO 27701"},
  data:{label:"Data",maps:"ISO 27001 A.8 / GDPR Art.5"},
  system:{label:"Systems & access",maps:"NIST CM/AC/AU"},
};
const CAT_KEYS = Object.keys(CATS);
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
const DEFAULT_APPETITE = {identity:"LOW",financial:"LOW",location:"MEDIUM",intellectual:"LOW",conversation:"MEDIUM",data:"MEDIUM",system:"LOW"};

function scoreAbility(a){
  const text = `${a.key} ${a.description||""} ${a.kind} ${a.details?JSON.stringify(a.details):""}`;
  const esc = ESC.test(text); const risk = {};
  for (const [re,cat,sev] of RULES) if (re.test(text)) risk[cat] = maxSev(risk[cat]||"LOW", esc?bump(sev):sev);
  if (!Object.keys(risk).length) risk.data = "LOW";
  const dev = a.developer_risk;
  if (dev) for (const c of Object.keys(dev)) risk[c] = maxSev(risk[c]||"LOW", dev[c]);
  const severity = Object.values(risk).reduce((m,s)=>maxSev(m,s),"LOW");
  return {risk, severity};
}
function reconcile(risk, severity, appetite, policy){
  if (severity==="SEVERE") return {decision:"discern",reasons:["Severe actions are never delegated"]};
  if (policy==="always") return {decision:"discern",reasons:["The developer marked this ability for discernment"]};
  const reasons=[];
  for (const c of Object.keys(risk)){
    const tol = appetite[c] || DEFAULT_APPETITE[c] || "LOW";
    if (gt(risk[c], tol)) reasons.push(`${CATS[c].label} scored ${risk[c]}, above your ${tol} appetite`);
  }
  return reasons.length ? {decision:"discern",reasons} : {decision:"allow",reasons:["Within your appetite"]};
}

/* ---------------- seed solutions + examples ---------------- */
function ability(key,kind,description,extra){ const a={key,kind,description,...extra}; return {...a, ...scoreAbility(a)}; }
function makeSol(uid,name,icon,appetite,agents,status){
  const A={}; for (const [id,def] of Object.entries(agents)) A[id]={...def, abilities:def.abilities.map(x=>ability(x.key,x.kind,x.description,{developer_risk:x.developer_risk,discernment:x.discernment}))};
  return {uid,name,icon,appetite:{...DEFAULT_APPETITE,...(appetite||{})},status:status||"active",agents:A};
}
function seedSolutions(){
  return {
    battlemate: makeSol("battlemate","BattleMate","chart",{intellectual:"HIGH",data:"HIGH"},{
      "intel-scout":{display_name:"Intel Scout",abilities:[{key:"sources.fetch",kind:"skill",description:"Fetch public pages and pricing"},{key:"signals.collect",kind:"skill",description:"Read and normalize market signals"}]},
      "analyst":{display_name:"Analyst",abilities:[{key:"metrics.compute",kind:"skill",description:"Compute KPIs from signals"},{key:"report.compose",kind:"tool",description:"Author the competitive brief document"}]},
      "narrator":{display_name:"Narrator",abilities:[{key:"audio.synthesize",kind:"tool",description:"Synthesize a spoken audio summary"}]},
      "courier":{display_name:"Courier",abilities:[{key:"report.broadcast",kind:"capability",description:"Broadcast the brief to the whole team by email and WhatsApp",developer_risk:{conversation:"HIGH"},discernment:"always"},{key:"budget.spend",kind:"capability",description:"Buy a premium data source",developer_risk:{financial:"HIGH"}}]},
    }),
    freeleap: makeSol("freeleap","FreeLeap","briefcase",{intellectual:"HIGH",data:"HIGH"},{
      "cv-smith":{display_name:"CV Smith",abilities:[{key:"cv.update",kind:"tool",description:"Update the evolving CV document"},{key:"cv.publish",kind:"capability",description:"Publish the CV to the public portfolio",discernment:"always"}]},
      "scout":{display_name:"Scout",abilities:[{key:"jobs.search",kind:"skill",description:"Search job boards for the next mission"}]},
      "applicant":{display_name:"Applicant",abilities:[{key:"job.apply",kind:"capability",description:"Submit a job application on the freelancer's behalf",developer_risk:{conversation:"HIGH",intellectual:"HIGH"}}]},
      "interviewer":{display_name:"Interviewer",abilities:[{key:"interview.reply",kind:"capability",description:"Reply to a recruiter interview message",developer_risk:{conversation:"HIGH"}}]},
    }),
    devbot: makeSol("devbot","Coding Agent","code",{system:"HIGH"},{
      "coding-agent":{display_name:"Coding Agent",abilities:[{key:"repo.read",kind:"skill",description:"Read files in the working tree"},{key:"test.run",kind:"skill",description:"Run the test suite"},{key:"deploy.staging",kind:"capability",description:"Deploy the build to staging"},{key:"repo.force_push",kind:"capability",description:"Force-push a branch",discernment:"always"},{key:"deploy.production",kind:"capability",description:"Deploy the API to production"},{key:"db.table_drop",kind:"capability",description:"Drop a database table"}]},
    }),
    finbot: makeSol("finbot","Finance Assistant","coin",{financial:"LOW"},{
      "finance-assistant":{display_name:"Finance Assistant",abilities:[{key:"expense.categorize",kind:"skill",description:"Categorize an expense"},{key:"pay.invoice",kind:"capability",description:"Pay an invoice"},{key:"funds.transfer",kind:"capability",description:"Transfer funds to a payee"}]},
    }),
  };
}
const EXAMPLES = [
  {id:"battlemate",sol:"battlemate",name:"BattleMate: morning brief",desc:"Watches competitors, writes a KPI brief and audio summary, delivers to the team.",tags:["competitive intel","email + WhatsApp"],icon:"chart",
   steps:[["intel-scout","sources.fetch",{sources:5}],["intel-scout","signals.collect",{competitors:5}],["analyst","metrics.compute",{}],["analyst","report.compose",{title:"Morning Brief"}],["narrator","audio.synthesize",{}],["courier","report.broadcast",{recipients:3,channels:["email","whatsapp"]}],["courier","budget.spend",{vendor:"PremiumIntel",amount:900,currency:"USD"}]]},
  {id:"freeleap",sol:"freeleap",name:"FreeLeap: next-mission prep",desc:"Two months out, evolves the CV, applies to the next missions, answers recruiters.",tags:["freelance","CV + applications"],icon:"briefcase",
   steps:[["cv-smith","cv.update",{version:4}],["scout","jobs.search",{query:"ml contract"}],["cv-smith","cv.publish",{site:"portfolio.freeleap.dev"}],["applicant","job.apply",{company:"Lumen Labs",rate_usd_day:780,match:0.92}],["applicant","job.apply",{company:"Grove Retail",rate_usd_day:720,match:0.88}],["interviewer","interview.reply",{company:"Lumen Labs",text:"Tuesday works."}]]},
  {id:"devbot",sol:"devbot",name:"Coding agent: ship a change",desc:"Reads, tests and ships to staging on its own; force-push, prod deploy and drops ask you.",tags:["coding","MCP / Claude Code"],icon:"code",
   steps:[["coding-agent","repo.read",{path:"src/"}],["coding-agent","test.run",{}],["coding-agent","deploy.staging",{build:"a1b2c3"}],["coding-agent","repo.force_push",{branch:"feature/x"}],["coding-agent","deploy.production",{service:"api"}],["coding-agent","db.table_drop",{table:"invoices"}]]},
  {id:"finbot",sol:"finbot",name:"Finance assistant: pay the bills",desc:"Categorizes freely; every dollar out is your call.",tags:["payments","OpenAI"],icon:"coin",
   steps:[["finance-assistant","expense.categorize",{merchant:"GitHub"}],["finance-assistant","pay.invoice",{vendor:"Acme",amount:180}],["finance-assistant","pay.invoice",{vendor:"Unknown LLC",amount:50000}],["finance-assistant","funds.transfer",{payee:"landlord",amount:200}]]},
];

/* ---------------- state ---------------- */
const DEVICES = {
  apple:{label:"Apple",phone:{name:"iPhone 15",w:390,h:844,cam:"notch"},tablet:{name:"iPad Air",w:834,h:1112,cam:"none"},laptop:{name:"MacBook",w:1280,h:820,cam:"none"}},
  android:{label:"Android",phone:{name:"Pixel 8",w:412,h:892,cam:"hole"},tablet:{name:"Galaxy Tab",w:800,h:1220,cam:"hole"},laptop:{name:"Chromebook",w:1280,h:800,cam:"none"}},
  windows:{label:"Windows",phone:{name:"Surface Duo",w:400,h:860,cam:"none"},tablet:{name:"Surface Pro",w:912,h:1240,cam:"none"},laptop:{name:"Surface Laptop",w:1366,h:820,cam:"none"}},
};
const HOST = "https://xurface.500xlaunch.com";
const ENVS = {
  demo:{label:"Demo",cls:"env-demo"},
  test:{label:"Test",cls:"env-test",base:HOST,hdr:"test"},
  live:{label:"Live",cls:"env-live",base:HOST,hdr:"live"},
};
let S = load();
function load(){
  let s; try{ s = JSON.parse(localStorage.getItem("discern")||"null"); }catch{ s=null; }
  const base = {view:"inbox",signedIn:true,user:{name:"You",email:"you@demo.dev"},env:"demo",plat:"apple",form:"phone",
    fullscreen:false,seq:0,solutions:seedSolutions(),intents:[],timeline:[],selectedSol:null,__seeded:false};
  s = Object.assign(base, s||{});
  if (!s.solutions || !s.solutions.battlemate) s.solutions = seedSolutions();
  return s;
}
function save(){ try{ localStorage.setItem("discern", JSON.stringify(S)); }catch{} }

/* ---------------- mock backend (demo) ---------------- */
function nextId(p){ return `${p}_${(S.seq++).toString(36)}${Math.random().toString(36).slice(2,6)}`; }
function hash(){ return Array.from({length:8},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join(""); }
function evaluate(solKey, agentId, capability, details){
  const sol = S.solutions[solKey]; const agent = sol.agents[agentId];
  const abil = agent.abilities.find(a=>a.key===capability) || {...scoreAbility({key:capability,kind:"capability",description:capability,details}), discernment:"always", undeclared:true};
  const v = reconcile(abil.risk, abil.severity, sol.appetite, abil.discernment||"auto");
  const rec = {id:nextId("int"),sol:solKey,solName:sol.name,icon:sol.icon,agent:agent.display_name||agentId,
    capability,details:{...details},risk:abil.risk,severity:abil.severity,reasons:(abil.undeclared?["Undeclared capability: always asks"]:[]).concat(v.reasons),
    at:Date.now(),hash:hash()};
  if (v.decision==="allow"){ rec.state="allowed"; S.timeline.unshift(rec); }
  else { rec.state="pending"; S.intents.unshift(rec); }
  return rec;
}
function decideIntent(id, decision, edited){
  const idx = S.intents.findIndex(i=>i.id===id); if (idx<0) return;
  const it = S.intents.splice(idx,1)[0];
  it.decidedAt = Date.now(); it.hash = hash();
  if (decision==="deny"){ it.state="denied"; }
  else if (edited){ it.state="edited"; it.details = {...it.details, ...edited}; }
  else { it.state="approved"; }
  S.timeline.unshift(it);
  save();
}

/* example runner: enqueue steps with a small delay + a push toast per held card */
let running = false;
async function runExample(ex){
  if (running) return; running = true;
  render();
  for (const [agent,cap,details] of ex.steps){
    const rec = evaluate(ex.sol, agent, cap, details);
    if (rec.state==="pending") toast(rec);
    save(); if (S.view==="inbox"||S.view==="activity") render();
    await sleep(360);
  }
  running = false; save(); render();
}
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* ---------------- rendering ---------------- */
const NAV = [["inbox","Discern",I.inbox],["activity","Activity",I.activity],["solutions","Solutions",I.solutions],["examples","Examples",I.examples],["settings","Settings",I.settings]];
const sevColor = s => ({LOW:"var(--lo)",MEDIUM:"var(--me)",HIGH:"var(--hi)",SEVERE:"var(--sv)"}[s]);
const sevBg = s => ({LOW:"var(--lo-bg)",MEDIUM:"var(--me-bg)",HIGH:"var(--hi-bg)",SEVERE:"var(--sv-bg)"}[s]);
const solLogo = () => I.logo;
const esc = s => String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const timeAgo = t => { const m=Math.round((Date.now()-t)/60000); return m<1?"just now":m<60?`${m}m ago`:`${Math.round(m/60)}h ago`; };

function render(){
  const root = document.getElementById("root");
  root.innerHTML = shellHTML();
  const appEl = document.getElementById("app-root");
  appEl.innerHTML = S.signedIn ? appHTML() : signInHTML();
  applyDevice();
  wire();
}
function shellHTML(){
  if (S.fullscreen) return `<div class="app-fill">${deviceScreenHTML(true)}</div>`;
  const dev = DEVICES[S.plat][S.form];
  return `<div class="studio" data-plat="${S.plat}">
    <div class="studio-bar">
      <span class="studio-brand">${MK}<b>Xurface Discern</b><small>web preview</small></span>
      <div class="seg" role="group" aria-label="Environment">
        ${Object.entries(ENVS).map(([k,e])=>`<button data-env="${k}" aria-pressed="${S.env===k}">${e.label}</button>`).join("")}
      </div>
      <span class="grow"></span>
      <label>Platform</label>
      <select class="studio-select" data-ctl="plat">${Object.entries(DEVICES).map(([k,d])=>`<option value="${k}" ${S.plat===k?"selected":""}>${d.label}</option>`).join("")}</select>
      <select class="studio-select" data-ctl="form">${["phone","tablet","laptop"].map(f=>`<option value="${f}" ${S.form===f?"selected":""}>${DEVICES[S.plat][f].name}</option>`).join("")}</select>
      <button class="studio-select" data-ctl="fullscreen">Fullscreen</button>
    </div>
    <div class="stage"><div class="stage-scale"><div class="device ${S.form}" id="device">
      <div class="cam"><div class="${dev.cam==='notch'?'notch':dev.cam==='hole'?'hole':''}"></div></div>
      <div class="screen" id="screen">${deviceScreenHTML(false)}</div>
      ${S.form==='laptop'?'<div class="notch-base"></div>':''}
    </div></div></div>
  </div>`;
}
function deviceScreenHTML(){ return `<div class="app" id="app-root"></div>`; }

function appHTML(){
  const wide = S.form!=="phone";
  const pending = S.intents.length;
  return `<div class="safe-top"></div>
  <div class="topbar">${MK}<span class="title"><b>Discern</b></span><span class="spacer"></span>
    <button class="iconbtn" data-nav="inbox" aria-label="Discernment">${I.bell}${pending?'<span class="badge-dot"></span>':''}</button>
  </div>
  <div class="body">
    ${wide?`<nav class="rail">${NAV.map(([v,l,ic])=>`<a href="#" data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${l}</span>${v==="inbox"&&pending?` <span class="chip risk" style="--sev-color:var(--hi);--sev-bg:var(--hi-bg);margin-left:auto">${pending}</span>`:''}</a>`).join("")}</nav>`:''}
    <div class="screen-wrap"><div class="wrap">${screenHTML()}</div></div>
  </div>
  ${wide?'':`<nav class="tabbar">${NAV.map(([v,l,ic])=>`<button data-nav="${v}" ${S.view===v?'aria-current="page"':''}>${ic}<span>${l}</span></button>`).join("")}</nav>`}
  <div id="overlay"></div>`;
  }

function screenHTML(){
  switch(S.view){
    case "inbox": return inboxHTML();
    case "activity": return activityHTML();
    case "solutions": return solutionsHTML();
    case "examples": return examplesHTML();
    case "settings": return settingsHTML();
    default: return inboxHTML();
  }
}
function inboxHTML(){
  const head = `<div><span class="eyebrow">On your behalf</span><h1 class="scr">Discern</h1><p class="sub">${S.intents.length?`${S.intents.length} action${S.intents.length>1?"s":""} need your judgement.`:"You are all caught up."}</p></div>`;
  if (!S.intents.length) return head + `<div class="empty">${MK}<div>Nothing is waiting.</div><div style="font-size:.84rem;margin-top:6px">Run an example to see agents ask for your discernment.</div><button class="runbtn" data-nav="examples" style="margin-top:14px">See examples</button></div>`;
  return head + S.intents.map(cardHTML).join("");
}
function cardHTML(it){
  const rows = Object.entries(it.details||{}).slice(0,4).map(([k,v])=>{
    const editable = typeof v==="number"||typeof v==="string";
    return `<div class="row"><span class="k">${esc(k)}</span>${editable?`<input data-edit="${it.id}" data-key="${esc(k)}" value="${esc(v)}"/>`:`<span class="v">${esc(Array.isArray(v)?v.join(", "):v)}</span>`}</div>`;
  }).join("");
  const risks = Object.entries(it.risk).map(([c,s])=>`<span class="chip risk" style="--sev-color:${sevColor(s)};--sev-bg:${sevBg(s)}">${CATS[c].label} ${s}</span>`).join("");
  return `<article class="card" style="--sev-color:${sevColor(it.severity)};--sev-bg:${sevBg(it.severity)}" data-card="${it.id}">
    <div class="hd"><span class="logo">${solLogo()}</span><div class="who"><div class="sol">${esc(it.solName)}</div><div class="agent">${esc(it.agent)}</div></div><span class="sev">${it.severity}</span></div>
    <div class="act"><b>${esc(prettyCap(it.capability))}</b></div>
    <div class="why">${risks}</div>
    <ul class="reasons">${it.reasons.slice(0,3).map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
    ${rows?`<div class="details">${rows}</div>`:''}
    <div class="actions">
      <button class="btn btn-deny" data-decide="deny" data-id="${it.id}">Deny</button>
      <button class="btn btn-approve" data-decide="approve" data-id="${it.id}">Approve</button>
    </div>
  </article>`;
}
function prettyCap(cap){ return cap.replace(/[._]/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }

function activityHTML(){
  const head = `<div><span class="eyebrow">Every action, logged</span><h1 class="scr">Activity</h1><p class="sub">A signed, traceable record of what agents did on your behalf.</p></div>`;
  if (!S.timeline.length) return head + `<div class="empty">${I.activity}<div>No activity yet.</div></div>`;
  return head + `<div class="tl">` + S.timeline.slice(0,60).map(it=>{
    const icon = it.state==="denied"?I.x:it.state==="allowed"?I.check:I.check;
    return `<div class="row"><span class="ic" style="--sev-color:${sevColor(it.severity)};--sev-bg:${sevBg(it.severity)}">${icon}</span>
      <div class="m"><div class="t">${esc(prettyCap(it.capability))}</div><div class="s">${esc(it.solName)} · ${esc(it.agent)} · ${timeAgo(it.decidedAt||it.at)}</div><div class="hash">#${it.hash}</div></div>
      <span class="st st-${it.state}">${it.state}</span></div>`;
  }).join("") + `</div>`;
}

function solutionsHTML(){
  if (S.selectedSol) return solDetailHTML(S.solutions[S.selectedSol]);
  const head = `<div><span class="eyebrow">Acting for you</span><h1 class="scr">Solutions</h1><p class="sub">Set how much each may do without asking, or pause it.</p></div>`;
  return head + Object.values(S.solutions).map(s=>`<button class="solrow" data-sol="${s.uid}" style="text-align:left;width:100%">
    <span class="logo card-logo">${solLogo()}</span>
    <div class="m"><div class="n">${esc(s.name)}</div><div class="d">${Object.keys(s.agents).length} agents · ${Object.values(s.agents).reduce((n,a)=>n+a.abilities.length,0)} abilities</div></div>
    <span class="status-pill status-${s.status}">${s.status}</span>${I.chevron}</button>`).join("");
}
function solDetailHTML(s){
  return `<div><button class="chip" data-back="1">&larr; Solutions</button></div>
  <div style="display:flex;align-items:center;gap:12px;margin-top:6px"><span class="logo card-logo" style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#6ea3d6,#2f5c8c);color:#fff;display:grid;place-items:center">${solLogo()}</span>
    <div><div style="font-weight:700;font-size:1.2rem">${esc(s.name)}</div><div class="sub">Discernment appetite</div></div></div>
  <div class="panel appetite">
    ${CAT_KEYS.map(c=>{ const cur = s.appetite[c]||DEFAULT_APPETITE[c]; return `<div class="apcat"><div class="lab"><div class="n">${CATS[c].label}</div><div class="maps">${CATS[c].maps}</div></div>
      <div class="levels" data-appetite="${s.uid}" data-cat="${c}">${SEVS.map(l=>`<button class="l-${l}" data-level="${l}" aria-pressed="${cur===l}">${l[0]}</button>`).join("")}</div></div>`; }).join("")}
  </div>
  <div class="panel"><div style="font-weight:650">Kill switch</div><p class="sub" style="margin:0">Pause blocks every agent in this solution; they get a 403 until you resume.</p>
    <button class="big-cta" data-toggle-sol="${s.uid}" style="background:${s.status==='active'?'var(--hi)':'var(--xur)'}">${s.status==='active'?'Pause this solution':'Resume this solution'}</button></div>
  <div class="panel"><div style="font-weight:650;margin-bottom:2px">Agents & abilities</div>
    ${Object.values(s.agents).map(a=>`<div class="list-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div style="font-weight:600">${esc(a.display_name)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${a.abilities.map(ab=>`<span class="chip" style="--sev-color:${sevColor(ab.severity)}">${esc(ab.key)} <b style="color:${sevColor(ab.severity)};font-family:var(--mono);font-size:.62rem">${ab.severity}</b></span>`).join("")}</div></div>`).join("")}</div>`;
}

function examplesHTML(){
  const head = `<div><span class="eyebrow">See it work</span><h1 class="scr">Examples</h1><p class="sub">Run a real Agentic Solution. Routine work is logged; the moments that matter arrive here for you to decide.</p></div>`;
  return head + `<div class="exgrid">` + EXAMPLES.map(ex=>`<div class="excard">
    <span class="logo card-logo">${solLogo()}</span>
    <div class="m"><div class="n">${esc(ex.name)}</div><p class="d">${esc(ex.desc)}</p>
      <div class="tags">${ex.tags.map(t=>`<span class="chip">${esc(t)}</span>`).join("")}</div></div>
    <button class="runbtn" data-run="${ex.id}" ${running?"disabled":""}>${running?"Running":"Run"}</button>
  </div>`).join("") + `</div>` + (S.env!=="demo"?`<p class="sub" style="text-align:center">Examples run in <b>Demo</b>. In Test/Live, your real solutions produce the cards.</p>`:"");
}

function settingsHTML(){
  const e = ENVS[S.env];
  return `<div><span class="eyebrow">You</span><h1 class="scr">Settings</h1></div>
  <div class="panel"><div class="list-row"><span class="k">Signed in as</span><span class="v">${esc(S.user?.name||"You")}</span></div>
    <div class="list-row"><span class="k">Email</span><span class="v">${esc(S.user?.email||"")}</span></div>
    <div class="list-row"><span class="k">Passkey</span><span class="v" style="color:var(--lo)">Registered</span></div></div>
  <div class="panel"><div style="font-weight:650">Environment</div><p class="sub" style="margin:0">Build and test in <b>Test</b> before you roll out to <b>Live</b>. Demo is a self-contained playground.</p>
    <div class="seg" style="align-self:flex-start;background:var(--surface-2)">${Object.entries(ENVS).map(([k,x])=>`<button data-env="${k}" aria-pressed="${S.env===k}" style="color:${S.env===k?'#fff':'var(--muted)'};${S.env===k?'background:var(--xur)':''};padding:7px 12px;border:0;border-radius:8px;font-weight:600;font-size:.8rem">${x.label}</button>`).join("")}</div>
    ${e.base?`<div class="hash">${esc(e.base)} · x-xurface-env: ${e.hdr}</div>`:'<div class="hash">local mock (no network)</div>'}</div>
  <div class="panel"><div style="font-weight:650">Devices</div><div class="list-row"><span class="k">This device</span><span class="v">${DEVICES[S.plat][S.form].name}</span></div></div>
  <div class="panel"><button class="big-cta" data-signout="1" style="background:var(--surface-2);color:var(--no);border:1px solid var(--line)">Sign out</button></div>
  <p class="sub" style="text-align:center;font-family:var(--serif);font-style:italic">Beyond human in the loop. Human on the go.</p>`;
}

function signInHTML(){
  return `<div class="safe-top"></div><div class="signin">
    ${MK}
    <div><h1>Xurface Discern</h1><p class="motto">Beyond human in the loop. Human on the go.</p></div>
    <div class="field"><label for="nm">Name</label><input id="nm" placeholder="Ada Lovelace" value="${esc(S.user?.name||"")}"/></div>
    <div class="field"><label for="em">Email or phone</label><input id="em" placeholder="you@company.com" value="${esc(S.user?.email||"")}"/></div>
    <button class="big-cta" data-signin="1">Continue with a passkey</button>
    <div class="passkey-note">${I.shield}<span>No passwords. Your passkey never leaves your device.</span></div>
  </div>`;
}

/* ---------------- overlays ---------------- */
function toast(it){
  const ov = document.getElementById("overlay"); if (!ov) return;
  const el = document.createElement("div"); el.className="toast";
  el.innerHTML = `<span class="logo card-logo">${solLogo()}</span><div class="m"><div class="t">${esc(it.solName)} needs your discernment</div><div class="s">${esc(it.agent)}: ${esc(prettyCap(it.capability))} (${it.severity})</div></div>`;
  el.addEventListener("click",()=>{ S.view="inbox"; render(); });
  ov.appendChild(el);
  setTimeout(()=>{ el.style.transition="opacity .3s"; el.style.opacity="0"; setTimeout(()=>el.remove(),300); }, 2600);
}
function biometricSheet(onConfirm){
  const ov = document.getElementById("overlay"); if (!ov) return;
  const scrim = document.createElement("div"); scrim.className="sheet-scrim";
  scrim.innerHTML = `<div class="sheet"><div class="face">${I.face}</div><h3>Confirm with Face ID</h3><p>This is a SEVERE action. Approving it needs a biometric.</p>
    <button class="big-cta" data-bio="ok">Confirm</button><button class="big-cta" data-bio="cancel" style="background:transparent;color:var(--muted);border:1px solid var(--line);margin-top:8px">Cancel</button></div>`;
  scrim.addEventListener("click",e=>{
    const b = e.target.closest("[data-bio]"); if (!b && e.target!==scrim) return;
    scrim.remove(); if (b && b.dataset.bio==="ok") onConfirm();
  });
  ov.appendChild(scrim);
}

/* ---------------- device sizing ---------------- */
function applyDevice(){
  if (S.fullscreen) return;
  const dev = DEVICES[S.plat][S.form];
  const device = document.getElementById("device"); const app = document.getElementById("app-root");
  if (!device) return;
  device.style.setProperty("--w", dev.w+"px"); device.style.setProperty("--h", dev.h+"px");
  if (app) app.classList.toggle("wide", S.form!=="phone");
  requestAnimationFrame(()=>{
    const stage = device.closest(".stage"); const scaleEl = device.closest(".stage-scale");
    if (!stage||!scaleEl) return;
    scaleEl.style.setProperty("--scale",1);
    const r = device.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    const sc = Math.min((sr.width-48)/r.width, (sr.height-48)/r.height, 1);
    scaleEl.style.setProperty("--scale", sc>0?sc:1);
  });
}
window.addEventListener("resize", ()=>applyDevice());

/* ---------------- events ---------------- */
function wire(){
  const root = document.getElementById("root");
  root.onclick = async (e)=>{
    const t = e.target;
    const nav = t.closest("[data-nav]"); if (nav){ e.preventDefault(); S.view=nav.dataset.nav; S.selectedSol=null; save(); render(); return; }
    const env = t.closest("[data-env]"); if (env){ setEnv(env.dataset.env); return; }
    const ctl = t.closest("[data-ctl]"); if (ctl && ctl.dataset.ctl==="fullscreen"){ S.fullscreen=!S.fullscreen; save(); render(); return; }
    const run = t.closest("[data-run]"); if (run){ const ex = EXAMPLES.find(x=>x.id===run.dataset.run); if (ex){ S.view="inbox"; runExample(ex);} return; }
    const dec = t.closest("[data-decide]"); if (dec){ handleDecide(dec.dataset.id, dec.dataset.decide); return; }
    const sol = t.closest("[data-sol]"); if (sol){ S.selectedSol=sol.dataset.sol; render(); return; }
    if (t.closest("[data-back]")){ S.selectedSol=null; render(); return; }
    const lvl = t.closest("[data-level]"); if (lvl){ const box=lvl.closest("[data-appetite]"); S.solutions[box.dataset.appetite].appetite[box.dataset.cat]=lvl.dataset.level; save(); render(); return; }
    const tog = t.closest("[data-toggle-sol]"); if (tog){ const s=S.solutions[tog.dataset.toggleSol]; s.status = s.status==="active"?"paused":"active"; save(); render(); return; }
    if (t.closest("[data-signin]")){ doSignIn(); return; }
    if (t.closest("[data-signout]")){ S.signedIn=false; save(); render(); return; }
  };
  root.onchange = (e)=>{
    const ctl = e.target.closest("[data-ctl]"); if (!ctl) return;
    if (ctl.dataset.ctl==="plat"){ S.plat=e.target.value; }
    if (ctl.dataset.ctl==="form"){ S.form=e.target.value; }
    save(); render();
  };
}
function handleDecide(id, decision){
  const it = S.intents.find(x=>x.id===id); if (!it) return;
  // gather edits
  const edits = {}; document.querySelectorAll(`[data-edit="${id}"]`).forEach(inp=>{
    const orig = it.details[inp.dataset.key];
    let val = inp.value; if (typeof orig==="number") val = Number(val);
    if (String(orig)!==String(val)) edits[inp.dataset.key]=val;
  });
  const finish = ()=>{ decideIntent(id, decision, Object.keys(edits).length?edits:null); render(); };
  if (decision==="approve" && it.severity==="SEVERE"){ biometricSheet(finish); return; }
  finish();
}
function setEnv(k){
  S.env = k; save();
  if (k!=="demo") probeEnv(k);
  render();
}
async function probeEnv(k){
  // In a hosted/native build this reaches real Horizon (the x-xurface-env header
  // selects the isolated test or live environment). In the web preview the CSP
  // blocks it; we fail quietly and stay usable.
  try{ await fetch(ENVS[k].base+"/healthz",{mode:"cors",headers:{"x-xurface-env":ENVS[k].hdr}}); }catch{}
}
function doSignIn(){
  const nm = (document.getElementById("nm")||{}).value || "You";
  const em = (document.getElementById("em")||{}).value || "you@company.com";
  S.user = {name:nm, email:em}; S.signedIn = true; S.view="inbox";
  if (!S.timeline.length && !S.intents.length){ /* leave empty; user runs examples */ }
  save(); render();
}

/* fullscreen fill style injected */
const fillCss = document.createElement("style");
fillCss.textContent = ".app-fill{position:fixed;inset:0;background:var(--bg)}.app-fill .app{position:absolute;inset:0}.card-logo{background:linear-gradient(135deg,#6ea3d6,#2f5c8c);color:#fff}.mk-w{}";
document.head.appendChild(fillCss);

/* open in a realistic working state: two cards waiting, some activity logged */
function seedDemo(){
  evaluate("battlemate","intel-scout","sources.fetch",{sources:5});
  evaluate("battlemate","analyst","metrics.compute",{});
  evaluate("freeleap","cv-smith","cv.update",{version:4});
  evaluate("freeleap","applicant","job.apply",{company:"Lumen Labs",rate_usd_day:780,match:0.92});
  evaluate("battlemate","courier","report.broadcast",{recipients:3,channels:["email","whatsapp"],subject:"Morning brief"});
}
if (!S.__seeded && !S.intents.length && !S.timeline.length){ seedDemo(); S.__seeded=true; save(); }

render();
