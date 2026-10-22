/**
 * Velora — Service Worker (offline-first, cache maîtrisé).
 *
 * Stratégie :
 * - App shell (HTML, assets buildés) : cache-first, avec mise à jour en arrière-plan.
 * - Navigation : network-first avec fallback sur le cache (offline).
 * - Le SW ne met jamais en cache de données utilisateur (IndexedDB géré séparément).
 *
 * Sécurité : périmètre limité à 'self', aucune évaluation dynamique de code.
 */

const CACHE_VERSION = "velora-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Manifest et SW : toujours frais
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Navigations : network-first, fallback cache (offline)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/index.html")))
    );
    return;
  }

  // Assets statiques : cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
