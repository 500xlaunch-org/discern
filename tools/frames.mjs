/* Turn raw app captures into store screenshots people actually stop on.
 *
 *   node tools/frames.mjs            # all locales
 *   LANGS=en,ar node tools/frames.mjs
 *
 * A bare screenshot tells someone what the app looks like. A framed one with a
 * headline tells them why they should care, and the store grid gives you about
 * a second to do that.
 *
 * One browser per locale, not per screenshot: the five frames are laid out as a
 * strip and sliced apart afterwards, which is five times fewer launches.
 *
 * Rendered in a browser rather than drawn with Pillow, because Pillow here has
 * no raqm: Arabic would come out as disconnected letterforms and Devanagari
 * would lose its conjuncts. A browser shapes every script correctly, handles
 * right to left, and already has the brand fonts.
 *
 * Reads  play/screenshots/<lang>/*.png  and  play/captions.i18n.json
 * Writes play/framed/<lang>/*.png at 1080x1920
 */
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const run = promisify(execFile);
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "play/screenshots");
const OUT = join(ROOT, "play/framed");

// Chrome will not open a window narrower than 500 CSS px, so the page is
// designed at half size and captured at 2x to land exactly on 1080x1920.
const W = 540, H = 960, SCALE = 2;

const LOCALE = { en: "en-US", zh: "zh-CN", hi: "hi-IN", es: "es-ES", fr: "fr-FR",
                 ar: "ar", pt: "pt-BR", ru: "ru-RU", ja: "ja-JP", de: "de-DE" };
const RTL = new Set(["ar"]);

const captions = JSON.parse(readFileSync(join(ROOT, "play/captions.i18n.json"), "utf8"));

const sheet = (cards, lang, dir) => `<!doctype html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@600;700&family=Noto+Sans+Arabic:wght@700&family=Noto+Sans+Devanagari:wght@700&family=Noto+Sans+SC:wght@700&family=Noto+Sans+JP:wght@700&display=swap">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;height:${H}px;overflow:hidden}
  body{width:${W * cards.length}px;display:flex;flex-direction:row}
  .frame{
    width:${W}px;height:${H}px;flex:none;display:flex;flex-direction:column;align-items:center;
    background:
      radial-gradient(120% 70% at 50% -10%, #4C82BC 0%, rgba(76,130,188,0) 60%),
      linear-gradient(168deg, #3B6EA3 0%, #234668 42%, #10161F 100%);
    font-family:"IBM Plex Sans","Noto Sans Arabic","Noto Sans Devanagari",
                "Noto Sans SC","Noto Sans JP",system-ui,sans-serif;
  }
  .cap{
    padding:46px 38px 0;margin:0;text-align:center;
    font-size:29px;line-height:1.24;font-weight:700;letter-spacing:-.012em;
    color:#fff;text-wrap:balance;
    text-shadow:0 1px 14px rgba(0,0,0,.30);
    max-width:100%;
  }
  /* CJK sets tighter and needs no negative tracking */
  html[lang="zh-CN"] .cap, html[lang="ja-JP"] .cap{letter-spacing:0;font-size:31px}
  html[dir="rtl"] .cap{letter-spacing:0}
  .rule{width:54px;height:3px;border-radius:2px;background:rgba(255,255,255,.55);margin:18px 0 0}
  .shotwrap{
    margin-top:26px;width:434px;flex:none;
    border-radius:27px;overflow:hidden;
    border:1px solid rgba(255,255,255,.16);
    box-shadow:0 26px 64px rgba(0,0,0,.50), 0 2px 8px rgba(0,0,0,.30);
  }
  .shotwrap img{display:block;width:100%;height:auto}
</style></head>
<body>${cards.map((c) => `
  <div class="frame">
    <p class="cap">${c.caption}</p>
    <div class="rule"></div>
    <div class="shotwrap"><img src="${c.shot}"></div>
  </div>`).join("")}
</body></html>`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

const langs = (process.env.LANGS ?? Object.keys(LOCALE).join(",")).split(",");
let made = 0;

for (const lang of langs) {
  const from = join(SRC, lang);
  if (!existsSync(from)) { console.log(`  ${lang}: no captures, skipped`); continue; }
  const to = join(OUT, lang);
  mkdirSync(to, { recursive: true });

  const caps = captions[LOCALE[lang]] ?? captions["en-US"];
  const shots = readdirSync(from).filter((f) => f.endsWith(".png")).sort();
  const cards = shots.map((f, i) => ({ shot: f, caption: esc(caps[i] ?? "") }));

  const html = join(from, "_sheet.html");
  const strip = join(from, "_sheet.png");
  writeFileSync(html, sheet(cards, LOCALE[lang], RTL.has(lang) ? "rtl" : "ltr"));
  try {
    await run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars",
      `--force-device-scale-factor=${SCALE}`, "--virtual-time-budget=9000",
      `--window-size=${W * cards.length},${H}`, `--screenshot=${strip}`, `file://${html}`],
      { timeout: 180000 }).catch(() => {});
    // slice the strip back into one file per screenshot
    await run("python3", ["-c", `
from PIL import Image
im = Image.open("${strip}")
names = ${JSON.stringify(shots)}
w = ${W * SCALE}
for i, n in enumerate(names):
    im.crop((i*w, 0, (i+1)*w, ${H * SCALE})).convert("RGB").save("${to}/" + n)
`]);
  } finally { rmSync(html, { force: true }); rmSync(strip, { force: true }); }
  made += shots.length;
  console.log(`  ${lang}: ${shots.length} framed`);
}
console.log(`\n${made} store screenshots in play/framed`);
