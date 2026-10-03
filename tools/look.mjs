#!/usr/bin/env node
/* Look at one screen of the app, the way a phone shows it, and say what broke.
 *
 *   node tools/look.mjs <out.png> [script.js | "inline js"] [--wide] [--full]
 *
 * Drives Chrome over its debugging protocol rather than --screenshot, so the
 * page is emulated at phone width (no 500px window floor), the script runs to
 * completion before the picture is taken, and every console error and thrown
 * exception is printed. A screenshot that silently shows the sign-in page
 * instead of the screen asked for is how a broken view goes unnoticed.
 *
 * The script runs inside the page after the demo sign-in, as an async body
 * with S, render, Backend and friends in scope. Return a string to print it.
 */
import { spawn } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join, dirname, extname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WWW = join(HERE, "..", "www");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--") && !a.includes("=")));
const [out, step = ""] = args.filter((a) => !a.startsWith("--"));
// --w=360 for a small Android phone
if (!out) { console.error("usage: look.mjs <out.png> [script] [--wide] [--full] [--signedout]"); process.exit(2); }
const body = existsSync(step) ? readFileSync(step, "utf8") : step;
const wArg = args.find((a) => /^--w=\d+$/.test(a));
const W = wArg ? Number(wArg.slice(4)) : flags.has("--wide") ? 1280 : 412, H = flags.has("--wide") ? 820 : 900;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
  const p = join(WWW, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(WWW) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
}).listen(0);
const port = await new Promise((r) => server.on("listening", () => r(server.address().port)));

const profile = mkdtempSync(join(tmpdir(), "look-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0",
  `--user-data-dir=${profile}`, "--hide-scrollbars", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
const wsUrl = await new Promise((res, rej) => {
  let buf = "";
  chrome.stderr.on("data", (d) => { buf += d; const m = /ws:\/\/[^\s]+/.exec(buf); if (m) res(m[0]); });
  setTimeout(() => rej(new Error("chrome did not start")), 15000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0; const waiting = new Map(), problems = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); return; }
  if (m.method === "Runtime.exceptionThrown") problems.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    problems.push("console.error: " + m.params.args.map((a) => a.value ?? a.description).join(" "));
});
const send = (method, params = {}, sessionId) => new Promise((r) => { const id = ++seq; waiting.set(id, r); ws.send(JSON.stringify({ id, method, params, sessionId })); });

const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId } } = await send("Target.attachToTarget", { targetId, flatten: true });
const s = (m, p) => send(m, p, sessionId);
await s("Runtime.enable"); await s("Page.enable");
await s("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: !flags.has("--wide") });
if (!flags.has("--wide")) await s("Emulation.setTouchEmulationEnabled", { enabled: true });
// --url=... looks at any page (the Horizon console, Line), not the app
const urlArg = args.find((a) => a.startsWith("--url="));
await s("Page.navigate", { url: urlArg ? urlArg.slice(6) : `http://127.0.0.1:${port}/index.html` });
await new Promise((r) => setTimeout(r, 1500));

const signin = flags.has("--signedout") || urlArg ? "" : `await Backend.login("ada@example.com"); await Backend.refresh(); S.ready = true;`;
const r = await s("Runtime.evaluate", { awaitPromise: true, returnByValue: true,
  expression: `(async () => { ${signin} const __r = await (async () => { ${body} })(); return __r; })()` });
if (r.result?.exceptionDetails) problems.push("step failed: " + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
else if (r.result?.result?.value !== undefined) console.log(r.result.result.value);
await new Promise((r2) => setTimeout(r2, 900));

let clip;
if (flags.has("--full")) {
  const m = await s("Runtime.evaluate", { returnByValue: true, expression: `(() => { const w = document.querySelector(".screen-wrap"); return w && w.scrollHeight > innerHeight ? w.scrollHeight + 40 : document.documentElement.scrollHeight; })()` });
  const h = Math.min(6000, Math.max(H, m.result.result.value));
  await s("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: 2, mobile: !flags.has("--wide") });
  await new Promise((r2) => setTimeout(r2, 500));
}
const shot = await s("Page.captureScreenshot", { format: "png", ...(clip ? { clip } : {}) });
writeFileSync(out, Buffer.from(shot.result.data, "base64"));
console.log(problems.length ? problems.join("\n") : "no errors");
ws.close(); chrome.kill("SIGKILL"); server.close();
rmSync(profile, { recursive: true, force: true });
