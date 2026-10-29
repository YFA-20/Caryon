"use client";

/**
 * Velora — hook de synchronisation automatique (Phase 3).
 *
 * Déclenche une sync complète (push + pull) :
 * - Au démarrage (si la sync est activée et le coffre déverrouillé).
 * - Périodiquement (toutes les 5 minutes) quand l'onglet est visible.
 * - Quand l'onglet redevient visible (visibilitychange).
 * - Quand la fenêtre reprend le focus (focus).
 *
 * SÉCURITÉ : ce hook ne fait que déclencher `syncNow()` du service de sync.
 * Il ne transmet aucune donnée en clair — tout passe par le chiffrement
 * AES-256-GCM existant. Si la sync est désactivée, le hook ne fait rien.
 *
 * Anti-rebond : une sync ne peut pas se chevaucher (flag `syncing`).
 * Intervalle minimum entre deux syncs : 30 secondes.
 */
import { useEffect, useRef, useCallback } from "react";
import { useSyncStore } from "@/store/sync-store";
import { useVaultStore } from "@/store/vault-store";
import { isSyncReady, syncNow } from "@/lib/sync/sync-service";

/** Intervalle de sync périodique (5 minutes). */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Délai minimum entre deux syncs (30 secondes). */
const MIN_SYNC_INTERVAL_MS = 30 * 1000;

export function useAutoSync() {
  const { status: vaultStatus } = useVaultStore();
  const { enabled: syncEnabled, status: syncStatus } = useSyncStore();
  const lastSyncRef = useRef<number>(0);
  const syncingRef = useRef(false);

  const triggerSync = useCallback(async () => {
    // Anti-rebond : pas de sync si une autre est en cours.
    if (syncingRef.current) return;
    // Délai minimum entre deux syncs.
    const now = Date.now();
    if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;

    syncingRef.current = true;
    try {
      const ready = await isSyncReady();
      if (!ready) return;
      // Pousse les métadonnées du coffre (pour la restauration multi-appareils).
      // Erreur silencieuse : c'est un bonus, pas un requis.
      const { pushVaultMetaToCloud } = await import("@/lib/sync/vault-meta-service");
      await pushVaultMetaToCloud();
      await syncNow();
      lastSyncRef.current = Date.now();
    } catch (err) {
      // Erreur silencieuse — le statut est déjà mis à jour dans le store.
      console.error("[auto-sync] Erreur:", err);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  // Sync au démarrage (quand le coffre est déverrouillé et la sync activée).
  useEffect(() => {
    if (vaultStatus === "unlocked" && syncEnabled) {
      // Petit délai pour laisser l'app se charger.
      const timer = setTimeout(() => {
        triggerSync();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [vaultStatus, syncEnabled, triggerSync]);

  // Sync périodique (toutes les 5 minutes quand l'onglet est visible).
  useEffect(() => {
    if (vaultStatus !== "unlocked" || !syncEnabled) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    }, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [vaultStatus, syncEnabled, triggerSync]);

  // Sync quand l'onglet redevient visible.
  useEffect(() => {
    if (vaultStatus !== "unlocked" || !syncEnabled) return;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        triggerSync();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [vaultStatus, syncEnabled, triggerSync]);

  // Sync quand la fenêtre reprend le focus.
  useEffect(() => {
    if (vaultStatus !== "unlocked" || !syncEnabled) return;
    function handleFocus() {
      triggerSync();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [vaultStatus, syncEnabled, triggerSync]);

  // Ne sync PAS si une sync est déjà en cours (évite les boucles).
  useEffect(() => {
    if (syncStatus === "syncing") {
      syncingRef.current = true;
    }
  }, [syncStatus]);

  return { triggerSync };
}
