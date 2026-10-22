/**
 * Velora — Service Worker (offline-first, cache maîtrisé).
 *
 * Stratégie :
 * - HTML (navigations) : network-first, fallback cache → l'utilisateur a toujours
 *   la dernière version en ligne, et l'app reste utilisable hors ligne.
 * - Assets statiques (_next/static, fonts, icons) : cache-first avec versioning
 *   (les noms de fichiers contiennent un hash de contenu, donc immutables).
 * - manifest.webmanifest et sw.js : toujours frais (network-first).
 * - Le SW ne met JAMAIS en cache de données utilisateur (IndexedDB géré séparément).
 *
 * Sécurité : périmètre limité à 'self', aucune évaluation dynamique de code,
 * nettoyage proactif des anciens caches à l'activation.
 */

const CACHE_VERSION = "velora-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".css")
  );
}

function isNavigation(request) {
  return request.mode === "navigate" || request.destination === "document";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // manifest et SW : toujours frais
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js") {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Navigations (HTML) : network-first, fallback cache
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(HTML_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match("/index.html") || caches.match("/"))
        )
    );
    return;
  }

  // Assets statiques : cache-first (noms hashés = immutables)
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Tout le reste : network par défaut
  event.respondWith(fetch(request));
});
