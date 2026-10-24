/**
 * Tests — vault-store : persistance de lastActivityAt dans sessionStorage.
 *
 * Vérifie que :
 * - touchActivity() persiste dans sessionStorage
 * - Le store lit sessionStorage au chargement (simulé via re-création)
 * - sessionStorage indisponible → fallback silencieux
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "velora:lastActivityAt";

describe("vault-store — persistance sessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  it("touchActivity persiste lastActivityAt dans sessionStorage", async () => {
    const { useVaultStore } = await import("@/store/vault-store");
    const before = Date.now();
    useVaultStore.getState().touchActivity();
    const after = Date.now();

    const stored = sessionStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const ts = Number.parseInt(stored!, 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("touchActivity met à jour lastActivityAt dans le store", async () => {
    const { useVaultStore } = await import("@/store/vault-store");
    const before = useVaultStore.getState().lastActivityAt;
    // Attendre 10ms pour avoir un timestamp différent
    await new Promise((r) => setTimeout(r, 10));
    useVaultStore.getState().touchActivity();
    const after = useVaultStore.getState().lastActivityAt;
    expect(after).toBeGreaterThan(before);
  });

  it("le store lit lastActivityAt depuis sessionStorage au chargement", async () => {
    // Pré-remplir sessionStorage avec un timestamp connu
    const knownTs = Date.now() - 5000; // il y a 5 secondes
    sessionStorage.setItem(STORAGE_KEY, String(knownTs));

    // Re-créer le module pour simuler un rechargement de page
    vi.resetModules();
    const { useVaultStore } = await import("@/store/vault-store");

    expect(useVaultStore.getState().lastActivityAt).toBe(knownTs);
  });

  it("fallback sur Date.now() si sessionStorage est vide", async () => {
    sessionStorage.removeItem(STORAGE_KEY);
    vi.resetModules();
    const { useVaultStore } = await import("@/store/vault-store");
    const before = Date.now();
    const ts = useVaultStore.getState().lastActivityAt;
    const after = Date.now();
    expect(ts).toBeGreaterThanOrEqual(before - 100); // marge pour le temps d'import
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("fallback silencieux si sessionStorage lève une exception", async () => {
    // Simuler sessionStorage indisponible (mode privé Safari ancien, etc.)
    const originalGet = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });

    vi.resetModules();
    const { useVaultStore } = await import("@/store/vault-store");
    // Ne doit pas throw — fallback sur Date.now()
    expect(useVaultStore.getState().lastActivityAt).toBeGreaterThan(0);

    Storage.prototype.getItem = originalGet;
  });

  it("touchActivity ne throw pas si sessionStorage est indisponible", async () => {
    const { useVaultStore } = await import("@/store/vault-store");
    const originalSet = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error("QuotaExceededError");
    });

    // Ne doit pas throw
    expect(() => useVaultStore.getState().touchActivity()).not.toThrow();
    // Le store en mémoire est quand même mis à jour
    expect(useVaultStore.getState().lastActivityAt).toBeGreaterThan(0);

    Storage.prototype.setItem = originalSet;
  });

  it("plusieurs touchActivity successifs écrasent la valeur dans sessionStorage", async () => {
    const { useVaultStore } = await import("@/store/vault-store");
    useVaultStore.getState().touchActivity();
    await new Promise((r) => setTimeout(r, 10));
    useVaultStore.getState().touchActivity();

    const stored = Number.parseInt(sessionStorage.getItem(STORAGE_KEY)!, 10);
    expect(stored).toBe(useVaultStore.getState().lastActivityAt);
  });
});
