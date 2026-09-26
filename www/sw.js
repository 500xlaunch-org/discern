/* Xurface Discern - service worker.
 *
 * Two jobs:
 *   1. Receive the push. A web app is a real notification target: when an agent
 *      stops and asks, the question reaches the person even with the tab closed.
 *   2. Keep the app openable offline. The shell is cached on install and served
 *      from cache when the network is gone, so a dead link shows the app with
 *      its last known content, never the browser's dinosaur.
 *
 * API calls are never cached: a stale answer about what an agent may do is
 * worse than no answer. The app handles that itself, from its own store.
 */
/* eslint-env serviceworker */
"use strict";

const VERSION = "discern-v10";
const SHELL = ["./", "./index.html", "./styles.css", "./i18n.js", "./phone.js", "./marks.js", "./net.js", "./app.js", "./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/v1/") || url.pathname === "/healthz") return;  // never cache the truth

  // Network first, cache as the offline fallback.
  //
  // This was stale-while-revalidate, which serves the cached copy and refreshes
  // behind it. That is fine for pictures and wrong for code: every deploy
  // reached people one load late, so a fixed screen still looked broken to
  // whoever reported it. Correct beats instant for a shell this small.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    } catch {
      return (await caches.match(req, { ignoreSearch: true }))
          || (await caches.match("./index.html", { ignoreSearch: true }));
    }
  })());
});

/* ---- push: the whole point of the service worker ---- */

/* The notification is the one part of the app that renders outside the app, so
 * it cannot reach the dictionary. The page tells the worker which language the
 * person chose, and it is kept in a cache entry so a cold start still knows.
 * navigator.language is the fallback when nobody has told us yet. */
const NOTIF = {
  en:{ title:"An agent needs your call", review:"Review", later:"Later" },
  zh:{ title:"有智能体需要你的判断", review:"查看", later:"稍后" },
  hi:{ title:"एक एजेंट को आपके निर्णय की ज़रूरत है", review:"देखें", later:"बाद में" },
  es:{ title:"Un agente necesita tu decisión", review:"Revisar", later:"Más tarde" },
  fr:{ title:"Un agent attend votre décision", review:"Examiner", later:"Plus tard" },
  ar:{ title:"وكيل ينتظر قرارك", review:"مراجعة", later:"لاحقًا" },
  pt:{ title:"Um agente precisa da sua decisão", review:"Revisar", later:"Depois" },
  ru:{ title:"Агент ждёт вашего решения", review:"Посмотреть", later:"Позже" },
  ja:{ title:"エージェントがあなたの判断を待っています", review:"確認", later:"あとで" },
  de:{ title:"Ein Agent wartet auf Ihre Entscheidung", review:"Ansehen", later:"Später" },
};
let LANG = null;
const LANG_KEY = "./__lang";

async function lang() {
  if (LANG) return LANG;
  try {
    const c = await caches.open(VERSION);
    const hit = await c.match(LANG_KEY);
    if (hit) LANG = (await hit.text()).slice(0, 2);
  } catch {}
  if (!LANG) LANG = String(self.navigator.language || "en").slice(0, 2);
  return NOTIF[LANG] ? LANG : "en";
}
const words = async () => NOTIF[await lang()] || NOTIF.en;

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "lang" && d.lang) {
    LANG = String(d.lang).slice(0, 2);
    e.waitUntil(caches.open(VERSION).then((c) => c.put(LANG_KEY, new Response(LANG))));
  }
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const severe = d.severity === "SEVERE" || d.severity === "HIGH";
  e.waitUntil((async () => {
  const w = await words();
  return self.registration.showNotification(d.title || w.title, {
    body: d.body || "",
    tag: d.intentId || "xurface",          // one card, one notification
    renotify: true,
    requireInteraction: severe,            // a severe ask should not slide away
    data: { url: d.url || "./", intentId: d.intentId },
    badge: "./icons/badge.png",
    icon: "./icons/icon-192.png",
    vibrate: severe ? [40, 60, 40] : [30],
    actions: d.intentId && d.intentId !== "test"
      ? [{ action: "open", title: w.review }, { action: "dismiss", title: w.later }] : [],
  });
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const target = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes("/app")) {
        c.postMessage({ type: "open-intent", intentId: e.notification.data && e.notification.data.intentId });
        return c.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});

/* The browser can retire a subscription on its own; ask the page to re-register. */
self.addEventListener("pushsubscriptionchange", (e) => {
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) c.postMessage({ type: "resubscribe" });
  })());
});
