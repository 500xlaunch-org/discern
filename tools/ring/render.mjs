#!/usr/bin/env node
/* Render Discern's ring (arc.js) into the files the apps and the web use, one
 * per severity (low, medium, high, severe):
 *   sounds/discern_<sev>.wav       Android, res/raw (tools/native.py copies it)
 *   sounds/discern_<sev>.caf       iPhone, in the app bundle (tools/native.py)
 *   www/sounds/discern_<sev>.m4a   the web app, about 30 KB each
 *   node tools/ring/render.mjs     (macOS: afconvert makes the .caf and .m4a) */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "sounds"), WEB = join(HERE, "..", "..", "www", "sounds");
const server = createServer((req, res) => {
  const f = join(HERE, new URL(req.url, "http://x").pathname.slice(1) || "render.html");
  let body; try { body = readFileSync(f); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "text/html" }); res.end(body);
}).listen(0);
await new Promise((r) => server.on("listening", r));
const url = `http://127.0.0.1:${server.address().port}/render.html`;
// asynchronously: this process serves the page the browser is rendering from
const { stdout: out } = await promisify(execFile)("node", [join(HERE, "..", "look.mjs"), join(HERE, ".render.png"), "return await renderAll();", `--url=${url}`],
  { maxBuffer: 64 * 1024 * 1024 });
server.close();
const json = out.split("\n").find((l) => l.startsWith("{"));
if (!json) { console.error(out.slice(0, 2000)); process.exit(1); }
mkdirSync(OUT, { recursive: true }); mkdirSync(WEB, { recursive: true });
for (const [sev, { b64, seconds }] of Object.entries(JSON.parse(json))) {
  const f = join(OUT, `discern_${sev.toLowerCase()}.wav`);
  writeFileSync(f, Buffer.from(b64, "base64"));
  const name = `discern_${sev.toLowerCase()}`;
  await promisify(execFile)("afconvert", ["-f", "caff", "-d", "ima4", f, join(OUT, name + ".caf")]);
  await promisify(execFile)("afconvert", ["-f", "m4af", "-d", "aac", "-b", "96000", f, join(WEB, name + ".m4a")]);
  console.log(`${name}  ${seconds} s`);
}
