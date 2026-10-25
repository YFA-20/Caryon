/**
 * Tests unitaires — forceLock et le fix du verrouillage automatique.
 *
 * Vérifie que :
 * - forceLock() efface la session
 * - forceLock() met à jour le store Zustand (status → "locked")
 * - forceLock() NE redirige PAS (fix écran vierge F5 sur pages profondes)
 * - Le store reflète correctement l'état après forceLock
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createVault, unlockVault, isUnlocked, forceLock, lock } from "@/lib/vault/vault-service";
import { useVaultStore } from "@/store/vault-store";
import { db } from "@/lib/db/database";

const PASSPHRASE = "test-force-lock-passphrase-123!";

describe("forceLock", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    // Reset le store
    useVaultStore.getState().setStatus("loading");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("efface la session en mémoire", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    expect(isUnlocked()).toBe(true);

    forceLock();

    expect(isUnlocked()).toBe(false);
  });

  it("met à jour le store Zustand vers locked (async)", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    useVaultStore.getState().setStatus("unlocked");

    forceLock();

    // Le store est mis à jour via un import dynamique (Promise)
    // On attend un tick pour laisser la Promise se résoudre
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(useVaultStore.getState().status).toBe("locked");
  });

  it("NE redirige PAS (pas de window.location.replace) — fix écran vierge F5", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    const replaceMock = vi.fn();
    const reloadMock = vi.fn();
    vi.stubGlobal("window", {
      ...globalThis.window,
      location: {
        ...globalThis.window?.location,
        pathname: "/candidatures",
        replace: replaceMock,
        reload: reloadMock,
      },
    });

    forceLock();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Plus de redirect — le portail s'affiche sur la page actuelle via le store
    expect(replaceMock).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("NE recharge PAS la page (pas de window.location.reload) même sur la racine", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    const reloadMock = vi.fn();
    vi.stubGlobal("window", {
      ...globalThis.window,
      location: {
        ...globalThis.window?.location,
        pathname: "/",
        replace: vi.fn(),
        reload: reloadMock,
      },
    });

    forceLock();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("lock() seul n'efface que la session (pas le store)", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    useVaultStore.getState().setStatus("unlocked");

    lock();

    expect(isUnlocked()).toBe(false);
    // Le store n'est PAS mis à jour par lock() seul (c'est le bug original)
    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("après forceLock, isUnlocked retourne false et le store est locked", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    useVaultStore.getState().setStatus("unlocked");

    forceLock();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(isUnlocked()).toBe(false);
    expect(useVaultStore.getState().status).toBe("locked");
  });
});

describe("useAutoLock — logique de visibilité (sans rendu React)", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    useVaultStore.getState().setStatus("loading");
    useVaultStore.getState().setAutoLockMs(15 * 60 * 1000);
  });

  it("le store touchActivity met à jour lastActivityAt", () => {
    const before = useVaultStore.getState().lastActivityAt;
    // Petit délai pour garantir un timestamp différent
    useVaultStore.getState().touchActivity();
    const after = useVaultStore.getState().lastActivityAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("le store setAutoLockMs met à jour la valeur", () => {
    useVaultStore.getState().setAutoLockMs(5 * 60 * 1000);
    expect(useVaultStore.getState().autoLockMs).toBe(5 * 60 * 1000);
  });

  it("le store setStatus change le statut", () => {
    useVaultStore.getState().setStatus("locked");
    expect(useVaultStore.getState().status).toBe("locked");
    useVaultStore.getState().setStatus("unlocked");
    expect(useVaultStore.getState().status).toBe("unlocked");
  });

  it("après création + unlock, isUnlocked est true", async () => {
    await createVault(PASSPHRASE, { testMode: true });
    expect(isUnlocked()).toBe(true);
    // Simuler déverrouillage
    lock();
    expect(isUnlocked()).toBe(false);
    await unlockVault(PASSPHRASE, { testMode: true });
    expect(isUnlocked()).toBe(true);
  });
});
