/* Discern - a face for every solution and every agent.
 *
 * Nothing here is fetched. A logo that arrives over the network is a logo that
 * is missing when the network is, and this app is meant to work on a train. So
 * both are drawn from what we already know: the solution's icon keyword, and
 * the agent's name.
 *
 * Colour is derived from the name rather than chosen, so the same agent is the
 * same colour on every device and in every language, and a solution nobody
 * anticipated still gets something distinct.
 */
"use strict";
(function () {

/* Hand drawn glyphs, one per icon keyword a solution can declare. Anything
 * unrecognised falls back to a neutral mark rather than a broken image. */
const GLYPH = {
  chart:`<path d="M4 19V9M9.3 19V4.6M14.7 19v-8.2M20 19v-5.4"/>`,
  briefcase:`<rect x="3" y="7.6" width="18" height="12" rx="2.2"/><path d="M8.4 7.6V5.8a2 2 0 0 1 2-2h3.2a2 2 0 0 1 2 2v1.8"/><path d="M3 12.6h18"/>`,
  code:`<path d="M8.6 7.4 4 12l4.6 4.6M15.4 7.4 20 12l-4.6 4.6M13.4 4.4l-2.8 15.2"/>`,
  coin:`<ellipse cx="12" cy="7" rx="7.4" ry="3.2"/><path d="M4.6 7v10c0 1.77 3.31 3.2 7.4 3.2s7.4-1.43 7.4-3.2V7"/><path d="M4.6 12c0 1.77 3.31 3.2 7.4 3.2s7.4-1.43 7.4-3.2"/>`,
  shield:`<path d="M12 3.2 19.6 6v6c0 4.7-3.3 7.6-7.6 8.6C7.7 19.6 4.4 16.7 4.4 12V6z"/>`,
  bot:`<rect x="4" y="7.6" width="16" height="12" rx="3"/><path d="M12 7.6V4.4M8.8 13h.01M15.2 13h.01M9.4 16.6h5.2"/>`,
  pen:`<path d="M4 20l1-4.2L16.2 4.6a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z"/><path d="M14.6 6.2l3.2 3.2"/>`,
  globe:`<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.4 2.8 2.4 14 0 16.8M12 3.6c-2.4 2.8-2.4 14 0 16.8"/>`,
};

/* Deliberately muted: these sit beside severity colours, which must stay the
 * loudest thing on the card. */
const PALETTE = [
  ["#3B6EA3","#1E3A57"], ["#4E7C59","#25402C"], ["#8A5A3B","#4A2F1F"],
  ["#6A4E8F","#362848"], ["#3F7E86","#1F4146"], ["#8A4B62","#472633"],
  ["#5C6B8A","#2E3648"], ["#7A6A34","#3E361A"],
];

const hash = (s) => {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) >>> 0;
  return h;
};
const pair = (seed) => PALETTE[hash(seed) % PALETTE.length];

/** A solution's mark: its declared glyph on its own colour. */
function solution(sol, size) {
  const key = (sol && (sol.icon || sol.slug)) || "";
  const g = GLYPH[key] || GLYPH.bot;
  const [a, b] = pair((sol && (sol.slug || sol.name)) || key);
  const px = size || 40;
  return `<span class="mark" style="--a:${a};--b:${b};--px:${px}px" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
         stroke-linecap="round" stroke-linejoin="round">${g}</svg></span>`;
}

/** An agent's face: the first letter of its name and the last, the first
 * capital and the last lower, on a colour of its own. Two letters read as a
 * person at a glance where one reads as a label. */
function initials(name) {
  const clean = String(name || "").replace(/[^\p{L}\p{N}]/gu, "");
  if (!clean) return "Ag";
  const first = clean[0].toUpperCase();
  const last = clean.length > 1 ? clean[clean.length - 1].toLowerCase() : "";
  return first + last;
}

function agent(name, size) {
  const [a, b] = pair(name || "agent");
  const px = size || 34;
  return `<span class="mark avatar" style="--a:${a};--b:${b};--px:${px}px" aria-hidden="true">
    <span class="avtx">${initials(name)}</span></span>`;
}

window.Marks = { solution, agent, initials, GLYPH };

})();
