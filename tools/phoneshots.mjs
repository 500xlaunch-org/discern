/* What the app actually looks like on a phone.
 *
 *   node tools/phoneshots.mjs [outDir] [port]
 *
 * Chrome will not make a window narrower than 500 CSS px, so asking it for 412
 * silently lays the page out at 500 and crops it, which looks exactly like an
 * overflow bug and sends you hunting for one. The app is framed in an iframe of
 * exactly 412px instead and captured at 2x, which gives a true phone layout.
 *
 * The harness is written into the served directory so the iframe is same
 * origin, and removed afterwards. It drives the app through its own code: the
 * app's bindings are const at module scope, so they are reached with eval in
 * the frame rather than as window properties.
 *
 * A fresh browser profile per shot, because the service worker will otherwise
 * serve the files from the run before and you will spend an hour wondering why
 * your change did nothing.
 */
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const WWW = join(HERE, "..", "www");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] ?? join(HERE, "..", "shots");
const PORT = Number(process.argv[3] ?? 5173);
const W = 412, H = 900;

/** Every screen worth looking at, and how to get to it. */
const VIEWS = [
  ["access", "the way in, not signed in"],
  ["inbox", "what is waiting"],
  ["focus", "one decision, on its own"],
  ["pull", "the inbox, mid pull to refresh"],
  ["activity", "what you decided"],
  ["solutions", "what is connected"],
  ["vault", "what your agents may reach"],
  ["vaultadd", "adding a wifi password, shown"],
  ["credask", "an agent asking for the office wifi"],
  ["holding", "approving something high, mid hold"],
  ["settings", "everything else"],
];

const harness = (view) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#15181c}iframe{width:${W}px;height:${H}px;border:0;display:block}</style>
<iframe id="f" src="/index.html"></iframe>
<script>
  const want = ${JSON.stringify(view)};
  const f = document.getElementById("f");
  f.onload = () => setTimeout(() => {
    if (want === "access") return;
    f.contentWindow.eval(\`(async () => {
      try {
        await Backend.login("ada@example.com");
        await Backend.refresh();
        const want = \${JSON.stringify(want)};
        if (want === "activity") {
          const ids = S.intents.map((x) => x.id), how = ["approve", "deny", "approve", "reflect"];
          for (let i = 0; i < ids.length; i++) await Backend.decide(ids[i], how[i % how.length]);
          await Backend.refresh();
        }
        if (want === "holding") {
          // a real press on the real button, through the real listeners, caught mid hold
          const g = agentGroups(S.intents)[0];
          S.view = "inbox"; S.focus = g ? { key: g.key, at: 0 } : null; S.ready = true; render();
          const b = document.querySelector("[data-hold]");
          b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
          return;
        }
        if (want === "credask") {
          // a request as Horizon sends it, through the real sheet; the vault is
          // stood in for because creating one does not finish under headless Chrome
          const it = { id: "int_demo_cred", kind: "credential_request", state: "pending", severity: "SEVERE",
            risk: { data: "SEVERE", system: "SEVERE" }, capability: "credential.wifi", agent: "Joiner",
            solution: S.solutions[0], solutionUid: (S.solutions[0] || {}).uid, release_key: "x", createdAt: Date.now(),
            credential: { type: "wifi", name: "the office wifi", reason: "Join the office wifi to print your boarding pass",
                          purpose: "join the office wifi" } };
          S.intents = [it].concat(S.intents);
          window.Vault = Object.assign({}, window.Vault, { state: { exists: true, unlocked: true },
            purposeKey: (x) => String(x || "").toLowerCase().replace(/\\s+/g, " ").trim() });
          S.vault.items = [{ id: "vit_1", kind: "wifi", label: "Office", hint: "5 GHz", grants: [] },
                           { id: "vit_2", kind: "wifi", label: "Home-5G", hint: "", grants: [] }];
          S.view = "inbox"; S.ready = true; openCredAsk(it.id); S.cred.chosen = "vit_1"; S.ask = it.id; render();
          return;
        }
        if (want === "vaultadd") {
          // creating a vault does not finish under headless Chrome, and its own
          // tests cover that; this is about how the form looks, so draw just it
          S.view = "vault"; S.ready = true; render();
          document.querySelector(".screen-wrap .wrap").innerHTML =
            '<div class="scrhead"><h1>Vault</h1></div><section class="panel vpanel">' + vaultFormHTML("wifi") + "</section>";
          document.getElementById("vf_network").value = "Home-5G";
          const pw = document.getElementById("vf_password");
          pw.value = "correct horse battery";
          document.querySelector("[data-veye]").click();   // through the real handler
          return;
        }
        if (want === "pull") {
          // a real gesture, through the real listeners: down from the top of the inbox
          S.view = "inbox"; S.ready = true; render();
          const sc = document.querySelector(".screen-wrap");
          const at = (y) => new Touch({ identifier: 1, target: sc, clientX: 200, clientY: y });
          sc.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [at(200)] }));
          for (const y of [230, 280, 330, 370])
            sc.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [at(y)] }));
          return;
        }
        if (want === "focus") {
          // the one by one walk, as the group button starts it
          const g = agentGroups(S.intents)[0];
          S.view = "inbox"; S.focus = g ? { key: g.key, at: 0 } : null;
        }
        else S.view = want;
        S.ready = true;
        render();
      } catch (e) { document.title = "ERR " + e.message; }
    })()\`);
  }, 1800);
</script>`;

async function shot(view, file, profile) {
  rmSync(profile, { recursive: true, force: true });
  try {
    await run(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
      "--force-device-scale-factor=2", "--touch-events=enabled", `--window-size=${W},${H}`, "--hide-scrollbars",
      "--virtual-time-budget=5000", `--screenshot=${file}`,
      `http://127.0.0.1:${PORT}/_shot.html`],
      { timeout: 25000, killSignal: "SIGKILL" });
  } catch { /* the shot is written before Chrome stops settling */ }
  return existsSync(file);
}

if (!existsSync(CHROME)) {
  console.error("Chrome is not where this expects it:", CHROME);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const server = spawn("python3", ["-m", "http.server", String(PORT), "--directory", WWW],
  { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 1200));

try {
  for (const [view, what] of VIEWS) {
    writeFileSync(join(WWW, "_shot.html"), harness(view));
    const file = join(OUT, `${view}.png`);
    const ok = await shot(view, file, join(OUT, `.profile-${view}`));
    console.log(`${ok ? "ok  " : "FAIL"} ${view.padEnd(10)} ${what}`);
    rmSync(join(OUT, `.profile-${view}`), { recursive: true, force: true });
  }
} finally {
  rmSync(join(WWW, "_shot.html"), { force: true });
  server.kill();
}
console.log("\nshots in", OUT);
