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

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Dégradé gracieux : l'app reste utilisable sans cache SW.
    });
  }, []);

  return null;
}
