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

const VERSION = "discern-v3";
const SHELL = ["./", "./index.html", "./styles.css", "./i18n.js", "./net.js", "./app.js", "./manifest.webmanifest"];

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

  // stale-while-revalidate for the shell: instant open, fresh next time
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => {
      if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
      return res;
    }).catch(() => null);
    return cached || (await net) || caches.match("./index.html", { ignoreSearch: true });
  })());
});

/* ---- push: the whole point of the service worker ---- */

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Xurface Discern", body: e.data ? e.data.text() : "" }; }
  const severe = d.severity === "SEVERE" || d.severity === "HIGH";
  e.waitUntil(self.registration.showNotification(d.title || "An agent needs your discernment", {
    body: d.body || "",
    tag: d.intentId || "xurface",          // one card, one notification
    renotify: true,
    requireInteraction: severe,            // a severe ask should not slide away
    data: { url: d.url || "./", intentId: d.intentId },
    badge: "./icons/badge.png",
    icon: "./icons/icon-192.png",
    vibrate: severe ? [40, 60, 40] : [30],
    actions: d.intentId && d.intentId !== "test"
      ? [{ action: "open", title: "Review" }, { action: "dismiss", title: "Later" }] : [],
  }));
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
