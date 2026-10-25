"use client";

import { useEffect } from "react";

/**
 * Velora — désinscription du Service Worker (fix écrans vierges F5).
 *
 * Le Service Worker interceptait les navigations HTML et causait des
 * écrans vierges après F5 sur les pages profondes (/candidatures,
 * /calendrier, etc.) à cause de conflits entre le cache SW, le cache
 * navigateur et les chunks JS référencés par le HTML.
 *
 * SOLUTION RADICALE : supprimer complètement le SW.
 * - L'app reste une PWA (manifest, icônes, installable via le navigateur)
 * - Les pages HTML passent directement : navigateur → Cloudflare
 * - Cache-Control: no-cache force la revalidation du HTML
 * - Les assets statiques (/_next/static/*) restent en cache navigateur
 *   (Cache-Control: immutable, max-age=1an, noms hashés)
 *
 * Ce composant désinscrit les anciens SW encore actifs chez les
 * utilisateurs (v1, v2, v3) et nettoie les caches associés.
 */
export function SwUnregister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Désinscrire tous les Service Workers enregistrés
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const reg of registrations) {
          reg.unregister().catch(() => {
            // Ignore — le SW sera supprimé au prochain rechargement
          });
        }
      })
      .catch(() => {
        // Ignore
      });

    // Nettoyer les caches créés par les anciens SW (velora-v1, v2, v3)
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            if (key.startsWith("velora-")) {
              caches.delete(key).catch(() => {});
            }
          }
        })
        .catch(() => {
          // Ignore
        });
    }
  }, []);

  return null;
}
