/**
 * Velora — Service Worker (assets statiques uniquement).
 *
 * STRATÉGIE SIMPLIFIÉE (v3) :
 * - Le SW ne gère PLUS les navigations HTML (pas d'interception).
 *   Les pages HTML passent directement par le navigateur → Cloudflare.
 *   Le header "Cache-Control: no-cache" force la revalidation.
 * - Le SW ne gère QUE les assets statiques immutables (/_next/static/*).
 *   Ces fichiers ont un hash dans leur nom → cache-first est sûr.
 * - Le SW ne met JAMAIS en cache de données utilisateur.
 *
 * POURQUOI : L'interception des navigations HTML causait des écrans vierges
 * après F5 sur les pages profondes (conflit entre le cache SW, le cache
 * navigateur, et les chunks JS référencés par le HTML).
 *
 * L'app reste une PWA (manifest, icônes, installable) et fonctionne
 * hors ligne pour les assets déjà chargés, mais les pages HTML
 * nécessitent une connexion (ou le cache navigateur HTTP).
 */

const CACHE_VERSION = "velora-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

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
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".ico")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // NE PAS intercepter les navigations HTML — laisser le navigateur gérer.
  // C'est la correction clé pour les écrans vierges après F5.
  if (request.mode === "navigate" || request.destination === "document") {
    return; // Pas de event.respondWith() → le navigateur fait la requête normalement
  }

  // manifest et sw.js : toujours frais
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/sw.js") {
    event.respondWith(fetch(request));
    return;
  }

  // Assets statiques immutables : cache-first (sûr car noms hashés)
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

  // Tout le reste (HTML, etc.) : réseau par défaut, pas d'interception
  // (pas de event.respondWith())
});
