#!/usr/bin/env node
/* Use the app the way a thumb does, and see what happened.
 *
 *   node tools/touch.mjs <steps.json> <outdir> [--w=412]
 *
 * Phone-sized Chrome with touch on, the app served from www/ as on a phone
 * (not the web build, so the vault is there), signed in to the demo. Each step
 * is one of:
 *   { "eval": "js" }              run in the page (awaited); its value is printed
 *   { "tap": "css selector" }     a real touch on the middle of the element
 *   { "hold": "css", "ms": 900 }  a finger kept down
 *   { "type": "css", "text": "" } focus the field and type, key by key
 *   { "wait": 500 }
 *   { "shot": "name" }            a screenshot, <outdir>/<n>-<name>.png
 * A tap on something that is not there, or is covered by something else, is
 * reported as such: that is exactly what a dead button looks like.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WWW = join(HERE, "..", "www");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const [stepsFile, outDir] = args.filter((a) => !a.startsWith("--"));
const wArg = args.find((a) => /^--w=\d+$/.test(a));
const W = wArg ? Number(wArg.slice(4)) : 412, H = 900;
const steps = JSON.parse(readFileSync(stepsFile, "utf8"));
mkdirSync(outDir, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const p = join(WWW, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(WWW) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(0);
const port = await new Promise((r) => server.on("listening", () => r(server.address().port)));
const profile = mkdtempSync(join(tmpdir(), "touch-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((res, rej) => {
  let buf = ""; chrome.stderr.on("data", (d) => { buf += d; const m = /ws:\/\/[^\s]+/.exec(buf); if (m) res(m[0]); });
  setTimeout(() => rej(new Error("chrome did not start")), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const waiting = new Map(), problems = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") problems.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") problems.push("console.error: " + m.params.args.map((a) => a.value ?? a.description).join(" "));
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await s("Runtime.enable"); await s("Page.enable");
await s("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await s("Page.navigate", { url: `http://127.0.0.1:${port}/index.html?nosplash=1` });
const evaluate = async (expr) => {
  const r = await s("Runtime.evaluate", { awaitPromise: true, returnByValue: true, expression: `(async () => { ${expr} })()` });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
  return r.result?.result?.value;
};
await evaluate(`for (let i = 0; i < 100 && typeof Backend === "undefined"; i++) await new Promise((r) => setTimeout(r, 100));
  // demo data, whatever the page decided about the network on its own
  S.mode = "demo"; Local.seed(); await Backend.login("ada@example.com"); await Backend.refresh(); S.ready = true; render();`);
await sleep(600);

// where a thumb lands on an element, and what is actually under that point
async function aim(sel) {
  return evaluate(`const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return { missing: true };
    el.scrollIntoView({ block: "center" }); await new Promise((r) => setTimeout(r, 250));
    const b = el.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, w: Math.round(b.width), h: Math.round(b.height), disabled: !!el.disabled,
      covered: top && top !== el && !el.contains(top) ? (top.className || top.tagName) + "" : null };`);
}
let n = 0;
for (const st of steps) {
  try {
    if (st.eval) { const v = await evaluate(st.eval); if (v !== undefined) console.log("eval:", JSON.stringify(v)); }
    else if (st.wait) await sleep(st.wait);
    else if (st.tap || st.hold) {
      const sel = st.tap || st.hold, a = await aim(sel);
      if (a.missing) { console.log(`tap ${sel}: NOT ON SCREEN`); continue; }
      console.log(`tap ${sel}: ${a.w}x${a.h}px${a.disabled ? " DISABLED" : ""}${a.covered ? " COVERED by " + a.covered : ""}`);
      const pt = [{ x: a.x, y: a.y, radiusX: 8, radiusY: 8, force: 1, id: 1 }];
      await s("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
      await sleep(st.hold ? (st.ms || 900) + 150 : 60);
      await s("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(350);
    } else if (st.type) {
      await evaluate(`const el = document.querySelector(${JSON.stringify(st.type)}); el.focus();`);
      for (const ch of st.text) await s("Input.dispatchKeyEvent", { type: "keyDown", text: ch, key: ch });
      await sleep(150);
    } else if (st.shot) {
      const shot = await s("Page.captureScreenshot", { format: "png" });
      const f = join(outDir, `${String(++n).padStart(2, "0")}-${st.shot}.png`);
      writeFileSync(f, Buffer.from(shot.result.data, "base64")); console.log("shot:", f);
    }
  } catch (e) { console.log("step failed:", JSON.stringify(st).slice(0, 80), String(e.message).split("\n")[0]); }
}
console.log(problems.length ? problems.join("\n") : "no errors");
ws.close(); chrome.kill("SIGKILL"); server.close();
try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* Chrome still letting go */ }
