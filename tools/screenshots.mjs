/* Play store screenshots, captured from the real running app.
 *
 *   node tools/screenshots.mjs [horizonBase] [outDir]
 *
 * Play wants phone screenshots between 9:16 and 16:9, 320 to 3840 px. Chrome
 * clamps a window to 500 CSS px wide, so a 9:16 phone viewport cannot be had
 * from --window-size. Instead we render the app inside an iframe of exactly
 * 540x960 pinned to the top left of a harness page and capture at 2x, which
 * gives a true 1080x1920 with a real 540px layout context rather than an
 * upscaled small one.
 *
 * The harness is written into the served app directory so the iframe is same
 * origin, then removed.
 */
import { execFile } from "node:child_process";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { promisify } from "node:util";
import { join } from "node:path";

const run = promisify(execFile);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = process.argv[2] ?? "http://localhost:8899";
const OUT = process.argv[3] ?? "play/screenshots";
const APPDIR = process.argv[4] ?? "../horizon-platform/app";   // where the app is served from
// The page has to be served locally so the harness iframe is same origin, but it
// can talk to any Horizon. Pointing it at production keeps the real hostname out
// of the Settings screenshot, where "localhost" would otherwise be on display.
const API = process.env.API ?? BASE;
// SHOTS=5-settings re-captures one screen without redoing all five.
const ONLY = (process.env.SHOTS ?? "").split(",").filter(Boolean);

const W = 540, H = 960, SCALE = 2;          // -> 1080x1920

// Two people, because one screen only exists before you connect and another
// only after. A real pre-consent permission label needs an unconnected user.
const CONNECTED = "ada@example.com";
const NEWCOMER = "preview@example.com";

/** Seed both users against the live test environment and learn the real uids. */
async function seed() {
  const ENV = process.env.ENV ?? "live";   // a consumer sees live, with no environment chip
  const H0 = { "content-type": "application/json", "x-xurface-env": ENV };
  const BASE = API;   // seed against whichever Horizon the app will talk to
  const post = async (p, b, tk) => (await fetch(BASE + p, { method: "POST", headers: { ...H0,
    ...(tk ? { authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify(b ?? {}) })).json();
  const get = async (p, tk) => (await fetch(BASE + p, { headers: { ...H0, authorization: `Bearer ${tk}` } })).json();

  const a = await post("/v1/user/login", { email: CONNECTED, name: "Ada" });
  const cat = await get("/v1/user/solutions/search?q=", a.token);
  for (const s of cat.solutions) await post(`/v1/user/solutions/${s.uid}/connect`, {}, a.token);
  const mine = await get("/v1/user/solutions", a.token);

  await post("/v1/user/login", { email: NEWCOMER, name: "Sam" });   // connects nothing
  const byName = (n) => (cat.solutions.find((s) => s.name === n) ?? cat.solutions[0]).uid;
  return { review: byName("BattleMate"), detail: (mine.solutions[0] ?? {}).uid ?? byName("BattleMate") };
}

const uids = await seed();

/** Each shot: which person, and where it lands them. */
const SHOTS = [
  { id: "1-discern",  user: CONNECTED, q: "view=inbox" },
  { id: "2-label",    user: NEWCOMER,  q: `review=${uids.review}` },     // the permission label
  { id: "3-appetite", user: CONNECTED, q: `solution=${uids.detail}` },
  { id: "4-activity", user: CONNECTED, q: "view=activity" },
  { id: "5-settings", user: CONNECTED, q: "view=settings" },
];

const LANGS = (process.env.LANGS ?? "en").split(",");

const harness = (url) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#0E1116;overflow:hidden}
iframe{position:fixed;top:0;left:0;width:${W}px;height:${H}px;border:0}</style>
<iframe src="${url}"></iframe>`;

async function shot(file, url) {
  const name = `_shot_${Math.random().toString(36).slice(2, 8)}.html`;
  writeFileSync(join(APPDIR, name), harness(url));
  try {
    await run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
      `--force-device-scale-factor=${SCALE}`, "--virtual-time-budget=7000",
      "--window-size=1200,1000", `--screenshot=${file}`, `${BASE}/app/${name}`],
      { timeout: 90000 }).catch(() => {});
  } finally { rmSync(join(APPDIR, name), { force: true }); }
}

mkdirSync(OUT, { recursive: true });
const { execSync } = await import("node:child_process");

for (const lang of LANGS) {
  const dir = join(OUT, lang);
  mkdirSync(dir, { recursive: true });
  for (const s of SHOTS.filter((x) => !ONLY.length || ONLY.includes(x.id))) {
    const raw = join(dir, `${s.id}.raw.png`);
    const url = `${BASE}/app/?env=${process.env.ENV ?? "live"}&api=${encodeURIComponent(API)}&email=${encodeURIComponent(s.user)}&lang=${lang}&${s.q}`;
    await shot(raw, url);
    // crop the iframe region out of the harness capture
    execSync(`python3 -c "
from PIL import Image
im = Image.open('${raw}').crop((0,0,${W*SCALE},${H*SCALE}))
im.convert('RGB').save('${join(dir, s.id + '.png')}')
"`);
    rmSync(raw, { force: true });
    process.stdout.write(`  ${lang}/${s.id}.png\n`);
  }
}
console.log(`\n${LANGS.length * SHOTS.length} screenshots in ${OUT}`);
