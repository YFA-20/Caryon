"use client";

import { useEffect, useRef } from "react";
import { useVaultStore } from "@/store/vault-store";
import { forceLock, isUnlocked } from "@/lib/vault/vault-service";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
];

/**
 * Velora — verrouillage automatique après inactivité.
 *
 * Surveille l'activité utilisateur (pointer, clavier, scroll, touch) et
 * verrouille le coffre si aucune activité pendant `autoLockMs`.
 *
 * SÉCURITÉ RENFORCÉE (fix page blanche) :
 * - Utilise `forceLock()` qui synchronise le store Zustand + redirige proprement.
 * - Détecte le retour au premier plan (`visibilitychange`) : si le délai
 *   d'inactivité est dépassé pendant que l'onglet était en arrière-plan
 *   (timers throttlés par le navigateur), verrouille immédiatement.
 * - Le timer est réinitialisé à chaque interaction.
 */
export function useAutoLock() {
  const { status, autoLockMs, lastActivityAt, touchActivity } = useVaultStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "unlocked") return;
    if (autoLockMs <= 0) return; // 0 = désactivé

    function doLock() {
      if (isUnlocked()) {
        forceLock();
      }
    }

    function scheduleLock() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doLock, autoLockMs);
    }

    function handleActivity() {
      touchActivity();
      scheduleLock();
    }

    // Détection du retour au premier plan : les navigateurs throttlent
    // les timers en arrière-plan. Si l'utilisateur revient après le délai,
    // on verrouille immédiatement au lieu d'attendre le timer (qui peut
    // ne pas encore avoir été exécuté).
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isUnlocked()) {
        const elapsed = Date.now() - lastActivityAt;
        if (elapsed >= autoLockMs) {
          doLock();
        } else {
          // Reprogramme le timer pour le temps restant
          scheduleLock();
        }
      }
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    scheduleLock();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // lastActivityAt change à chaque interaction, on veut le relire
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoLockMs, touchActivity]);
}
