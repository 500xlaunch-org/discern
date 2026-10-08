#!/usr/bin/env node
/* The pictures pushes carry, one per severity, into www/push/sev-<severity>.jpg (macOS: sips makes the JPEG, about 50 KB).
 *   node tools/push-art/render.mjs */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "www", "push");
const server = createServer((req, res) => {
  let body; try { body = readFileSync(join(HERE, "render.html")); } catch { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": "text/html" }); res.end(body);
}).listen(0);
await new Promise((r) => server.on("listening", r));
const { stdout } = await promisify(execFile)("node", [join(HERE, "..", "look.mjs"), join(HERE, ".render.png"), "return renderAll();",
  `--url=http://127.0.0.1:${server.address().port}/render.html`], { maxBuffer: 64 * 1024 * 1024 });
server.close();
const json = stdout.split("\n").find((l) => l.startsWith("{"));
mkdirSync(OUT, { recursive: true });
for (const [sev, url] of Object.entries(JSON.parse(json))) {
  const f = join(OUT, `sev-${sev.toLowerCase()}.png`), jpg = f.replace(/\.png$/, ".jpg");
  writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
  await promisify(execFile)("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "--resampleWidth", "1000", f, "--out", jpg]);
  (await import("node:fs")).unlinkSync(f);
  console.log(jpg);
}
