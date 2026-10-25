"use client";

import { useEffect } from "react";

/**
 * Velora — enregistre le service worker (offline-first).
 * Composant client isolé ; aucun effet de bord au rendu serveur.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Force la mise à jour du SW si une nouvelle version est disponible.
        // Cela garantit que les utilisateurs ont toujours le dernier SW
        // (et donc la bonne stratégie de cache) après un déploiement.
        reg.update().catch(() => {});

        // Écoute les mises à jour du SW
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // Quand le nouveau SW est actif, on peut notifier l'utilisateur
            // (optionnel — ici on laisse le navigateur gérer)
            if (newWorker.state === "activated") {
              // Le nouveau SW est actif, les anciens caches sont nettoyés
              // automatiquement par le handler "activate" dans sw.js
            }
          });
        });
      })
      .catch(() => {
        // Dégradé gracieux : l'app reste utilisable sans cache SW.
      });
  }, []);

  return null;
}
