"use client";

import { useEffect, useRef } from "react";
import { useVaultStore } from "@/store/vault-store";
import { lock, isUnlocked } from "@/lib/vault/vault-service";

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
 * Sécurité : le timer est réinitialisé à chaque interaction. Le verrouillage
 * appelle `lock()` (efface la session en mémoire) puis recharge la page pour
 * revenir au portail de déverrouillage.
 */
export function useAutoLock() {
  const { status, autoLockMs, touchActivity } = useVaultStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== "unlocked") return;
    if (autoLockMs <= 0) return; // 0 = désactivé

    function scheduleLock() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (isUnlocked()) {
          lock();
          window.location.reload();
        }
      }, autoLockMs);
    }

    function handleActivity() {
      touchActivity();
      scheduleLock();
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }
    scheduleLock();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, autoLockMs, touchActivity]);
}
