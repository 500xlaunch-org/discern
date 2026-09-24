/* Discern - telling an email from a phone number, and making the phone part
 * pleasant.
 *
 * One field, because asking someone to pick "email or phone" before typing is a
 * question they should not have to answer: what they type says which it is.
 *
 * Country names are not stored. Intl.DisplayNames gives them in whatever
 * language the app is in, so this file only holds the ISO code and the dial
 * code, and the flag is derived from the code itself.
 *
 * This is not libphonenumber. It checks the shape (E.164: up to 15 digits, a
 * plausible national length, and a real dial code) rather than whether a number
 * is actually assigned. That is the right trade for a sign in field: it catches
 * typing mistakes without rejecting a valid number it has never heard of.
 */
"use strict";
(function () {

// iso:dial, one entry per line to stay readable in a diff
const RAW = `
AD:376 AE:971 AF:93 AG:1268 AI:1264 AL:355 AM:374 AO:244 AR:54 AS:1684 AT:43 AU:61 AW:297 AZ:994
BA:387 BB:1246 BD:880 BE:32 BF:226 BG:359 BH:973 BI:257 BJ:229 BM:1441 BN:673 BO:591 BR:55 BS:1242
BT:975 BW:267 BY:375 BZ:501 CA:1 CD:243 CF:236 CG:242 CH:41 CI:225 CK:682 CL:56 CM:237 CN:86 CO:57
CR:506 CU:53 CV:238 CW:599 CY:357 CZ:420 DE:49 DJ:253 DK:45 DM:1767 DO:1809 DZ:213 EC:593 EE:372
EG:20 ER:291 ES:34 ET:251 FI:358 FJ:679 FK:500 FM:691 FO:298 FR:33 GA:241 GB:44 GD:1473 GE:995
GF:594 GG:44 GH:233 GI:350 GL:299 GM:220 GN:224 GP:590 GQ:240 GR:30 GT:502 GU:1671 GW:245 GY:592
HK:852 HN:504 HR:385 HT:509 HU:36 ID:62 IE:353 IL:972 IM:44 IN:91 IQ:964 IR:98 IS:354 IT:39 JE:44
JM:1876 JO:962 JP:81 KE:254 KG:996 KH:855 KI:686 KM:269 KN:1869 KP:850 KR:82 KW:965 KY:1345 KZ:7
LA:856 LB:961 LC:1758 LI:423 LK:94 LR:231 LS:266 LT:370 LU:352 LV:371 LY:218 MA:212 MC:377 MD:373
ME:382 MG:261 MH:692 MK:389 ML:223 MM:95 MN:976 MO:853 MP:1670 MQ:596 MR:222 MS:1664 MT:356 MU:230
MV:960 MW:265 MX:52 MY:60 MZ:258 NA:264 NC:687 NE:227 NG:234 NI:505 NL:31 NO:47 NP:977 NR:674
NU:683 NZ:64 OM:968 PA:507 PE:51 PF:689 PG:675 PH:63 PK:92 PL:48 PM:508 PR:1787 PS:970 PT:351
PW:680 PY:595 QA:974 RE:262 RO:40 RS:381 RU:7 RW:250 SA:966 SB:677 SC:248 SD:249 SE:46 SG:65
SI:386 SK:421 SL:232 SM:378 SN:221 SO:252 SR:597 SS:211 ST:239 SV:503 SX:1721 SY:963 SZ:268
TC:1649 TD:235 TG:228 TH:66 TJ:992 TL:670 TM:993 TN:216 TO:676 TR:90 TT:1868 TV:688 TW:886 TZ:255
UA:380 UG:256 US:1 UY:598 UZ:998 VA:39 VC:1784 VE:58 VG:1284 VI:1340 VN:84 VU:678 WS:685 YE:967
YT:262 ZA:27 ZM:260 ZW:263
`;

const COUNTRIES = RAW.trim().split(/\s+/).map((pair) => {
  const [iso, dial] = pair.split(":");
  return { iso, dial };
});
const BY_ISO = Object.fromEntries(COUNTRIES.map((c) => [c.iso, c]));

/** Several countries share a dial code. When a pasted number cannot tell them
 * apart, pick the one most people mean; the picker corrects it in one tap. */
const SHARED = { "1":"US", "7":"RU", "39":"IT", "44":"GB", "47":"NO", "61":"AU",
                 "262":"RE", "590":"GP", "596":"MQ", "599":"CW" };

/** Where a national number plausibly starts and stops, for the places most
 * people sign up from. Everywhere else falls back to the E.164 range, which
 * still catches a missing digit or a pasted essay. */
const LENGTHS = {
  US:[10,10], CA:[10,10], GB:[9,10], FR:[9,9], DE:[10,11], ES:[9,9], IT:[9,10], PT:[9,9],
  NL:[9,9], BE:[8,9], CH:[9,9], AT:[10,11], SE:[7,9], NO:[8,8], DK:[8,8], FI:[9,10],
  IE:[9,9], PL:[9,9], RO:[9,9], CZ:[9,9], GR:[10,10], RU:[10,10], UA:[9,9], TR:[10,10],
  IN:[10,10], PK:[10,10], BD:[10,10], CN:[11,11], JP:[10,10], KR:[9,10], ID:[9,12],
  PH:[10,10], VN:[9,10], TH:[9,9], MY:[9,10], SG:[8,8], HK:[8,8], TW:[9,9],
  AU:[9,9], NZ:[8,10], ZA:[9,9], NG:[10,10], KE:[9,9], GH:[9,9], EG:[10,10], MA:[9,9],
  DZ:[9,9], TN:[8,8], BR:[10,11], MX:[10,10], AR:[10,10], CL:[9,9], CO:[10,10], PE:[9,9],
  AE:[9,9], SA:[9,9], IL:[9,9], QA:[8,8], KW:[8,8],
};

const digits = (s) => String(s || "").replace(/\D+/g, "");

/** A flag from the country code: two regional indicator letters. */
const flag = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));

/** Country names in the reader's language, from the platform. */
function name(iso, lang) {
  try { return new Intl.DisplayNames([lang || "en"], { type: "region" }).of(iso) || iso; }
  catch { return iso; }
}

/** Where this person probably is. The region on their locale is the only
 * signal available without asking or calling anything, and it is usually
 * right; when it is not, the picker is one tap away. */
function detect() {
  const tags = [...(navigator.languages || []), navigator.language || ""];
  for (const tag of tags) {
    const m = /-([A-Z]{2})(?:$|-)/.exec(String(tag));
    if (m && BY_ISO[m[1]]) return m[1];
  }
  // a language with no region still narrows it down
  const byLang = { en:"US", fr:"FR", de:"DE", es:"ES", pt:"BR", ru:"RU", ja:"JP", zh:"CN", hi:"IN", ar:"AE" };
  const base = String(navigator.language || "en").slice(0, 2);
  return BY_ISO[byLang[base]] ? byLang[base] : "US";
}

/** Which kind of thing is this? Decided from what has been typed so far, so the
 * field can change shape while someone is still typing. */
function kindOf(raw) {
  const v = String(raw || "").trim();
  if (!v) return "empty";
  if (v.includes("@")) return "email";
  // a leading + or nothing but digits and separators reads as a number
  if (/^\+/.test(v)) return "phone";
  if (/^[\d\s().-]+$/.test(v)) return "phone";
  return "email";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmail = (v) => EMAIL.test(String(v || "").trim());

/** Group the national part so it is readable while being typed. Not carrier
 * accurate grouping, just a rhythm the eye can follow. */
function group(national, iso) {
  const d = digits(national);
  if (!d) return "";
  if (iso === "US" || iso === "CA") {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)} ${d.slice(3)}`;
    return `${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,10)}`;
  }
  if (iso === "FR") return d.replace(/(\d{1,2})(?=(\d{2})+$)/g, "$1 ");
  return d.replace(/(.{1,3})(?=(.{3})+$)/g, "$1 ");
}

/** E.164, which is what gets stored and sent. */
const e164 = (iso, national) => `+${(BY_ISO[iso] || {}).dial || ""}${digits(national)}`;

function validPhone(iso, national) {
  const c = BY_ISO[iso];
  if (!c) return false;
  const n = digits(national);
  const total = c.dial.length + n.length;
  if (total < 8 || total > 15) return false;          // the E.164 range
  const span = LENGTHS[iso];
  if (span) return n.length >= span[0] && n.length <= span[1];
  return n.length >= 4;
}

/** Someone pasting a full international number should not have to strip it. */
function splitPasted(raw) {
  const v = String(raw || "").trim();
  if (!/^\+/.test(v)) return null;
  const d = digits(v);
  // longest dial code wins, so +1 does not swallow +1268
  const matches = COUNTRIES.filter((c) => d.startsWith(c.dial));
  if (!matches.length) return null;
  const longest = Math.max(...matches.map((c) => c.dial.length));
  const best = matches.filter((c) => c.dial.length === longest);
  const dial = best[0].dial;
  const iso = best.length > 1 ? (SHARED[dial] || best[0].iso) : best[0].iso;
  return { iso, national: d.slice(dial.length) };
}

window.Phone = { COUNTRIES, BY_ISO, flag, name, detect, kindOf, validEmail,
                 validPhone, group, e164, digits, splitPasted };

})();
