"use client";

import { useEffect } from "react";
import { useVaultStore } from "@/store/vault-store";
import { checkAndNotify } from "@/lib/notifications/notification-service";

const CHECK_INTERVAL_MS = 60 * 1000; // Toutes les minutes

/**
 * Velora — ordonnanceur de notifications locales.
 *
 * Toutes les minutes (tant que le coffre est déverrouillé), vérifie les
 * événements à venir dans l'heure et envoie une notification locale pour
 * chacun, une seule fois. Les notifications ne fonctionnent que si
 * l'onglet est ouvert — c'est un comportement dégradé documenté.
 */
export function useNotificationScheduler() {
  const status = useVaultStore((s) => s.status);

  useEffect(() => {
    if (status !== "unlocked") return;

    // Vérification immédiate au déverrouillage
    checkAndNotify().catch(() => {
      /* permission non accordée ou erreur silencieuse */
    });

    const interval = setInterval(() => {
      checkAndNotify().catch(() => {
        /* idem */
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status]);
}
