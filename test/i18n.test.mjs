/* A person is being asked to allow or refuse something an agent wants to do
 * with their money, their name or their work. If half that screen falls back to
 * English, it is not informed consent. So the dictionary is checked the way the
 * app uses it: every key, every language, every plural form the locale needs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(here, "..", "www", "i18n.js"), "utf8");

function load(search = "", languages = ["en"]) {
  const ctx = { location: { search }, navigator: { languages }, document: { documentElement: {} },
    Intl, JSON, console, URLSearchParams };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx.window.I18N;
}

const I = load();
const BASE = Object.keys(I.DICT.en);
const PLURAL = /\.(zero|one|two|few|many|other)$/;
const SINGLE = BASE.filter((k) => !PLURAL.test(k));
const PLURAL_ROOTS = [...new Set(BASE.filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, "")))];

test("every language carries every non-plural key", () => {
  const gaps = [];
  for (const { code } of I.LANGS) {
    const d = I.DICT[code];
    assert.ok(d, `no dictionary for ${code}`);
    for (const k of SINGLE) if (!d[k]) gaps.push(`${code}:${k}`);
  }
  assert.deepEqual(gaps, [], `untranslated keys would fall back to English: ${gaps.slice(0, 8).join(", ")}`);
});

test("every language supplies the plural forms its own grammar requires", () => {
  // Russian needs one/few/many, Arabic needs six, Japanese needs one. Ask Intl
  // which categories the locale actually uses rather than guessing.
  const gaps = [];
  for (const { code } of I.LANGS) {
    const cats = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
    for (const root of PLURAL_ROOTS) {
      for (const c of cats) {
        if (!I.DICT[code][`${root}.${c}`] && !I.DICT[code][`${root}.other`]) gaps.push(`${code}:${root}.${c}`);
      }
    }
  }
  assert.deepEqual(gaps, [], `missing plural forms: ${gaps.slice(0, 8).join(", ")}`);
});

test("no language leaves a placeholder unfilled or invents a new one", () => {
  const holes = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(",");
  const bad = [];
  for (const { code } of I.LANGS) {
    if (code === "en") continue;
    for (const k of Object.keys(I.DICT[code])) {
      // a locale may carry plural forms English has no use for (Arabic dual,
      // Russian few/many), and a form may spell the number out instead of
      // interpolating it, so plural variants are exempt from both checks
      if (PLURAL.test(k)) continue;
      const en = I.DICT.en[k];
      if (!en) { bad.push(`${code}:${k} is not an English key`); continue; }
      if (holes(en) !== holes(I.DICT[code][k])) bad.push(`${code}:${k} expected ${holes(en)} got ${holes(I.DICT[code][k])}`);
    }
  }
  assert.deepEqual(bad, [], bad.slice(0, 6).join(" | "));
});

test("plurals resolve through Intl, not through an if(n===1)", () => {
  I.setLang("ru");
  const one = I.tn("sol.agents", 1), few = I.tn("sol.agents", 3), many = I.tn("sol.agents", 7);
  assert.notEqual(one, few); assert.notEqual(few, many);
  I.setLang("ar");
  assert.notEqual(I.tn("inbox.sub", 2), I.tn("inbox.sub", 11), "Arabic dual is not Arabic plural");
  I.setLang("ja");
  const skeleton = (s) => s.replace(/\d+/g, "#");
  assert.equal(skeleton(I.tn("sol.agents", 1)), skeleton(I.tn("sol.agents", 5)), "Japanese has one form");
});

test("Arabic is marked right to left and nothing else is", () => {
  for (const { code } of I.LANGS) {
    I.setLang(code);
    assert.equal(I.isRTL(), code === "ar", `${code} direction`);
  }
});

test("language selection: the URL wins, then the saved choice, then the browser", () => {
  assert.equal(load("?lang=ja", ["fr"]).pickLang("de"), "ja", "the URL wins");
  assert.equal(load("", ["fr"]).pickLang("de"), "de", "then the saved choice");
  assert.equal(load("", ["fr-CA", "en"]).pickLang(null), "fr", "then the browser, matching on the base tag");
  assert.equal(load("", ["cy"]).pickLang(null), "en", "an unsupported language falls back to English");
  assert.equal(load("?lang=klingon", ["fr"]).pickLang(null), "fr", "a nonsense override is ignored");
});

test("the reason an action needs discernment is phrased locally, not passed through", () => {
  I.setLang("de");
  const entry = { severity: "HIGH", risk: { financial: "HIGH" }, discernment: "auto" };
  const why = I.tWhy(entry, { financial: "LOW" }, ["Financial scored HIGH, above your LOW appetite"]);
  assert.match(why[0], /Finanzen/, "the category is translated");
  assert.ok(!why[0].includes("Financial"), "the English server string is not shown");

  // SEVERE and a developer's always-ask both have their own sentence
  I.setLang("fr");
  assert.match(I.tWhy({ severity: "SEVERE", risk: {} }, {})[0], /jamais/);
  assert.match(I.tWhy({ severity: "LOW", risk: {}, discernment: "always" }, {})[0], /développeur/);

  // within appetite, with no server string to fall back on
  assert.match(I.tWhy({ severity: "LOW", risk: { data: "LOW" } }, { data: "MEDIUM" })[0], /marge/);
});

test("a missing key shows itself rather than rendering empty", () => {
  I.setLang("en");
  assert.equal(I.t("no.such.key"), "no.such.key");
});

/* Punctuation nobody types.
 *
 * Long dashes, the single character ellipsis and the interpunct are the marks
 * that make copy read as machine written. They creep back in every time a
 * string is added, so the dictionary and the views that hardcode text are
 * checked rather than trusted.
 */
const TELLS = {
  "em dash":        "—",
  "en dash":        "–",
  "figure dash":    "‒",
  "horizontal bar": "―",
  "minus sign":     "−",
  "ellipsis":       "…",
  "middle dot":     "·",
  "bullet":         "•",
  "left quote":     "“",
  "right quote":    "”",
};

test("no machine punctuation anywhere in the dictionary", () => {
  const found = [];
  for (const { code } of I.LANGS) {
    for (const [key, value] of Object.entries(I.DICT[code])) {
      for (const [name, ch] of Object.entries(TELLS)) {
        if (String(value).includes(ch)) found.push(`${code}:${key} has a ${name}`);
      }
    }
  }
  assert.deepEqual(found, [], found.slice(0, 8).join(" | "));
});

test("no machine punctuation in the views that hardcode text", () => {
  const found = [];
  for (const f of ["app.js", "index.html", "privacy.html", "manifest.webmanifest"]) {
    const src = readFileSync(join(here, "..", "www", f), "utf8");
    for (const [name, ch] of Object.entries(TELLS)) {
      if (src.includes(ch)) found.push(`www/${f} has a ${name}`);
    }
  }
  assert.deepEqual(found, [], found.join(" | "));
});

test("the store listing and captions read the same way", () => {
  const found = [];
  for (const f of ["listing.i18n.json", "captions.i18n.json"]) {
    const src = readFileSync(join(here, "..", "play", f), "utf8");
    for (const [name, ch] of Object.entries(TELLS)) {
      if (src.includes(ch)) found.push(`play/${f} has a ${name}`);
    }
  }
  assert.deepEqual(found, [], found.join(" | "));
});
