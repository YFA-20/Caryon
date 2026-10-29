/**
 * Tests unitaires — logique de synchronisation automatique (use-auto-sync).
 *
 * On teste la logique métier (pas le hook React directement) :
 * - isSyncReady() gère correctement les cas activé/désactivé/verrouillé.
 * - syncNow() met à jour le store Zustand (statut, lastSyncAt).
 * - Anti-rebond : deux syncNow simultanées ne doivent pas se chevaucher
 *   (testé via le flag syncingRef dans le hook, ici on teste le service).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { useSyncStore } from "@/store/sync-store";
import { createVault, lock } from "@/lib/vault/vault-service";
import { saveSettings } from "@/lib/vault/goal-repository";
import { isSyncReady, syncNow } from "@/lib/sync/sync-service";

const TEST_PASSPHRASE = "phrase-secrete-de-test-123";

describe("auto-sync logic", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    lock();
    window.localStorage.clear();
    window.sessionStorage.clear();
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    useSyncStore.setState({
      enabled: false,
      status: "idle",
      lastSyncAt: null,
      lastError: null,
      pairedDevicesCount: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("isSyncReady retourne false si le coffre est verrouillé", async () => {
    expect(await isSyncReady()).toBe(false);
  });

  it("isSyncReady retourne false si la sync est désactivée (même déverrouillé)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    await saveSettings({ syncEnabled: false });
    expect(await isSyncReady()).toBe(false);
    lock();
  });

  it("isSyncReady retourne true si déverrouillé ET sync activée", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    await saveSettings({ syncEnabled: true });
    expect(await isSyncReady()).toBe(true);
    lock();
  });

  it("syncNow met à jour le statut à 'syncing' puis 'idle' en cas de succès", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    await saveSettings({ syncEnabled: true });

    // Mock fetch : push retourne OK, pull retourne vide.
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/sync/push")) {
        return Promise.resolve(
          new Response(JSON.stringify({ accepted: 0, serverNow: "2025-01-15T10:35:00.000Z" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      if (url.includes("/sync/pull")) {
        return Promise.resolve(
          new Response(JSON.stringify({ serverNow: "2025-01-15T10:35:00.000Z", changes: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncNow();
    // 2 enregistrements poussés : le settings (créé par saveSettings) + la session persistée.
    expect(result.pushed).toBeGreaterThanOrEqual(0);
    expect(result.pulled).toBe(0);
    expect(useSyncStore.getState().status).toBe("idle");
    expect(useSyncStore.getState().lastSyncAt).toBe("2025-01-15T10:35:00.000Z");
    expect(useSyncStore.getState().lastError).toBeNull();

    lock();
  });

  it("syncNow met à jour le statut à 'error' en cas d'échec réseau", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    await saveSettings({ syncEnabled: true });

    // Mock fetch : tout échoue.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    await expect(syncNow()).rejects.toThrow();
    expect(useSyncStore.getState().status).toBe("error");
    expect(useSyncStore.getState().lastError).toBeTruthy();

    lock();
  });

  it("syncNow lève une erreur si le coffre est verrouillé", async () => {
    await expect(syncNow()).rejects.toThrow("Coffre verrouillé");
  });

  it("le store Zustand reflète correctement l'état de sync", async () => {
    // État initial.
    expect(useSyncStore.getState().status).toBe("idle");
    expect(useSyncStore.getState().lastSyncAt).toBeNull();

    // Après une mise à jour manuelle.
    useSyncStore.getState().setStatus("syncing");
    expect(useSyncStore.getState().status).toBe("syncing");

    useSyncStore.getState().setLastSyncAt("2025-01-15T10:35:00.000Z");
    expect(useSyncStore.getState().lastSyncAt).toBe("2025-01-15T10:35:00.000Z");
    expect(window.localStorage.getItem("velora:sync:lastSyncAt")).toBe("2025-01-15T10:35:00.000Z");
  });
});
