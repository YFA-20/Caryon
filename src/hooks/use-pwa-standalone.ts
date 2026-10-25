"use client";

import { useEffect, useState } from "react";

/**
 * Velora — détecte si l'app tourne en mode PWA standalone.
 *
 * Quand l'utilisateur a installé la PWA ("Ajouter à l'écran d'accueil"),
 * le navigateur passe en `display-mode: standalone` (ou `fullscreen`,
 * `minimal-ui` sur certains OS). Dans ce mode, il n'y a plus de barre
 * d'adresse navigateur — l'app ressemble à une vraie app native.
 *
 * Ce hook écoute le media query `(display-mode: standalone)` et aussi
 * les événements `appinstalled` / changements de display-mode.
 *
 * Utilisé pour afficher une icône "app installée" dans le header.
 */
export function usePwaStandalone(): boolean {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    // Vérifie les différents display-modes (standalone = installé)
    const modes = ["standalone", "fullscreen", "minimal-ui"];
    const checkStandalone = () => {
      const isAny = modes.some((mode) => window.matchMedia(`(display-mode: ${mode})`).matches);
      // iOS Safari : navigator.standalone (propriétaire, non standard)
      const isIosStandalone =
        "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(isAny || isIosStandalone);
    };

    checkStandalone();

    // Écoute les changements de display-mode
    const mediaLists = modes.map((mode) => window.matchMedia(`(display-mode: ${mode})`));
    for (const mql of mediaLists) {
      mql.addEventListener("change", checkStandalone);
    }

    // Écoute l'événement appinstalled (quand l'utilisateur installe la PWA)
    window.addEventListener("appinstalled", checkStandalone);

    return () => {
      for (const mql of mediaLists) {
        mql.removeEventListener("change", checkStandalone);
      }
      window.removeEventListener("appinstalled", checkStandalone);
    };
  }, []);

  return isStandalone;
}
