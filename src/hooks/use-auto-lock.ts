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
 * SÉCURITÉ RENFORCÉE (fix page blanche + fix timer + fix F5/refresh) :
 * - Utilise `forceLock()` qui synchronise le store Zustand + redirige proprement.
 * - Détecte le retour au premier plan (`visibilitychange`) : si le délai
 *   d'inactivité est dépassé pendant que l'onglet était en arrière-plan
 *   (timers throttlés par le navigateur), verrouille immédiatement.
 * - Lit `lastActivityAt` via `getState()` pour avoir la valeur à jour
 *   (évite les stale closures sur le state Zustand).
 * - Au démarrage (status passe à "unlocked"), réinitialise `lastActivityAt`
 *   via `touchActivity()` pour ne pas hériter d'un timestamp ancien
 *   (ex: après un F5, sessionStorage peut contenir une valeur d'avant le refresh).
 * - `lastActivityAt` est persisté dans `sessionStorage` (voir vault-store.ts)
 *   pour survivre au F5 sans réinitialiser le timer.
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

    // Au démarrage du hook (déverrouillage), réinitialise le timer
    // pour ne pas hériter d'un lastActivityAt ancien (ex: après F5,
    // sessionStorage peut contenir une valeur d'avant le refresh).
    // Le VaultGate appelle aussi touchActivity() au déverrouillage,
    // mais on le fait ici pour être sûr (évite le verrouillage immédiat
    // si un visibilitychange se déclenche juste après le montage).
    touchActivity();
    scheduleLock();

    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, autoLockMs]);
}
