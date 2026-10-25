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
        reg.update().catch(() => {});

        // Désinscrire l'ancien SW s'il existe et ne gérait pas les navigations.
        // Le SW v3 ne gère plus que les assets statiques.
        // Si un ancien SW (v1/v2) est actif, on le remplace.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              // Nouveau SW actif, anciens caches nettoyés par le handler "activate"
            }
          });
        });
      })
      .catch(() => {
        // Dégradé gracieux : l'app reste utilisable sans cache SW.
      });

    // Nettoyage proactif : désinscrire les anciens SW qui pourraient
    // encore intercepter les navigations HTML (cause d'écrans vierges).
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        // On garde le SW actuel, mais on s'assure qu'il est à jour
        reg.update().catch(() => {});
      }
    });
  }, []);

  return null;
}
