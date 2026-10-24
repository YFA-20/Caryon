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
 * SÉCURITÉ RENFORCÉE (fix page blanche + fix timer) :
 * - Utilise `forceLock()` qui synchronise le store Zustand + redirige proprement.
 * - Détecte le retour au premier plan (`visibilitychange`) : si le délai
 *   d'inactivité est dépassé pendant que l'onglet était en arrière-plan
 *   (timers throttlés par le navigateur), verrouille immédiatement.
 * - Lit `lastActivityAt` via `getState()` pour avoir la valeur à jour
 *   (évite les stale closures sur le state Zustand).
 * - Au démarrage (status passe à "unlocked"), réinitialise le timer
 *   proprement pour ne pas hériter d'un lastActivityAt ancien.
 */
export function useAutoLock() {
  const { status, autoLockMs, touchActivity } = useVaultStore();
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
    // on verrouille immédiatement au lieu d'attendre le timer.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && isUnlocked()) {
        // Lit lastActivityAt via getState() pour avoir la valeur à jour
        const currentLastActivity = useVaultStore.getState().lastActivityAt;
        const elapsed = Date.now() - currentLastActivity;
        if (elapsed >= autoLockMs) {
          doLock();
        } else {
          // Reprogramme le timer pour le temps restant
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(doLock, autoLockMs - elapsed);
        }
      }
    }

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Au démarrage du hook (déverrouillage), s'assurer que le timer
    // démarre depuis maintenant, pas depuis un lastActivityAt ancien.
    // Le VaultGate appelle touchActivity() au déverrouillage, mais on
    // reprogramme le timer ici pour être sûr.
    scheduleLock();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, autoLockMs, touchActivity]);
}
