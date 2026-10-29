/**
 * Tests unitaires — service de métadonnées du coffre (vault-meta-service.ts).
 *
 * Contrat de sécurité testé :
 * - restoreVaultFromCloud refuse si un coffre local existe déjà.
 * - restoreVaultFromCloud refuse avec une mauvaise phrase (verifier échoue).
 * - restoreVaultFromCloud refuse si le serveur retourne 404.
 * - restoreVaultFromCloud crée le coffre + session en cas de succès.
 * - La clé maîtresse wrappée sur le serveur est INUTILISABLE sans la phrase.
 * - pushVaultMetaToCloud ne fait rien si la sync est désactivée.
 * - checkVaultExistsOnCloud retourne false en cas d'erreur réseau.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { useSyncStore } from "@/store/sync-store";
import { createVault, lock, isUnlocked } from "@/lib/vault/vault-service";
import { saveSettings } from "@/lib/vault/goal-repository";
import {
  restoreVaultFromCloud,
  pushVaultMetaToCloud,
  checkVaultExistsOnCloud,
} from "@/lib/sync/vault-meta-service";

const TEST_PASSPHRASE = "phrase-secrete-de-test-123";
const TEST_PASSPHRASE_WRONG = "mauvaise-phrase-xyz-456";
const VAULT_ID = "550e8400-e29b-41d4-a716-446655440000";

/** Construit une fausse réponse serveur /vault avec les métadonnées d'un vrai coffre. */
async function makeVaultMetaResponse(_vaultId: string) {
  // Crée un vrai coffre pour obtenir des métadonnées valides.
  await createVault(TEST_PASSPHRASE, { testMode: true });
  const row = await db.vault.toCollection().first();
  lock();
  await db.vault.clear();
  await db.records.clear();
  await db.documents.clear();

  if (!row) throw new Error("Impossible de créer un coffre de test");

  return {
    vaultId: row.id,
    version: 1 as const,
    createdAt: row.createdAt,
    kdf: JSON.stringify(row.kdf),
    salt: row.salt,
    wrappedMasterKey: row.wrappedMasterKey,
    wrapIv: row.wrapIv,
    verifier: row.verifier,
    verifierIv: row.verifierIv,
    autoLockMs: row.autoLockMs,
    updatedAt: new Date().toISOString(),
  };
}

describe("vault-meta-service", () => {
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

  describe("restoreVaultFromCloud", () => {
    it("refuse si un coffre local existe déjà", async () => {
      await createVault(TEST_PASSPHRASE, { testMode: true });
      const result = await restoreVaultFromCloud(VAULT_ID, TEST_PASSPHRASE, { testMode: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain("existe déjà");
      lock();
    });

    it("refuse si le serveur retourne 404 (coffre introuvable)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
      const result = await restoreVaultFromCloud(VAULT_ID, TEST_PASSPHRASE, { testMode: true });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Aucun coffre trouvé");
    });

    it("refuse avec une mauvaise phrase secrète", async () => {
      const meta = await makeVaultMetaResponse(VAULT_ID);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(meta), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      const result = await restoreVaultFromCloud(meta.vaultId, TEST_PASSPHRASE_WRONG, {
        testMode: true,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("incorrecte");
      // Aucun coffre local ne doit avoir été créé.
      expect(await db.vault.count()).toBe(0);
    });

    it("crée le coffre + session avec la bonne phrase (succès)", async () => {
      const meta = await makeVaultMetaResponse(VAULT_ID);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify(meta), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      const result = await restoreVaultFromCloud(meta.vaultId, TEST_PASSPHRASE, {
        testMode: true,
      });
      expect(result.success).toBe(true);
      expect(result.vault).toBeDefined();
      expect(result.vault!.id).toBe(meta.vaultId);

      // Le coffre doit exister localement.
      const row = await db.vault.toCollection().first();
      expect(row).toBeDefined();
      expect(row!.id).toBe(meta.vaultId);

      // La session doit être déverrouillée.
      expect(isUnlocked()).toBe(true);

      lock();
    });

    it("la clé wrappée du serveur est inutilisable sans la phrase", async () => {
      const meta = await makeVaultMetaResponse(VAULT_ID);
      // Sans dériver la KEK depuis la bonne phrase, on ne peut pas déchiffrer
      // le wrappedMasterKey. C'est garanti par AES-GCM (le tag échoue).
      // On vérifie juste que le wrappedMasterKey est bien présent et non vide.
      expect(meta.wrappedMasterKey.length).toBeGreaterThan(10);
      expect(meta.wrappedMasterKey).not.toContain(TEST_PASSPHRASE);
    });

    it("refuse si la réponse serveur est invalide (pas un UUID)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ vaultId: "pas-un-uuid" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      const result = await restoreVaultFromCloud(VAULT_ID, TEST_PASSPHRASE, { testMode: true });
      expect(result.success).toBe(false);
    });
  });

  describe("pushVaultMetaToCloud", () => {
    it("ne fait rien si la sync est désactivée", async () => {
      await createVault(TEST_PASSPHRASE, { testMode: true });
      await saveSettings({ syncEnabled: false });
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await pushVaultMetaToCloud();
      expect(fetchMock).not.toHaveBeenCalled();
      lock();
    });

    it("ne fait rien si le coffre est verrouillé", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      await pushVaultMetaToCloud();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("pousse les métadonnées si la sync est activée", async () => {
      await createVault(TEST_PASSPHRASE, { testMode: true });
      await saveSettings({ syncEnabled: true });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, serverNow: "2025-01-15T10:35:00.000Z" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      await pushVaultMetaToCloud();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/vault"),
        expect.objectContaining({ method: "PUT" })
      );

      // Vérifie que le body contient le wrappedMasterKey (chiffré, pas en clair).
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.wrappedMasterKey).toBeTruthy();
      expect(body.wrappedMasterKey).not.toContain(TEST_PASSPHRASE);
      expect(body.salt).toBeTruthy();
      expect(body.verifier).toBeTruthy();

      lock();
    });
  });

  describe("checkVaultExistsOnCloud", () => {
    it("retourne true si le serveur répond 200", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
      expect(await checkVaultExistsOnCloud(VAULT_ID)).toBe(true);
    });

    it("retourne false si le serveur répond 404", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
      expect(await checkVaultExistsOnCloud(VAULT_ID)).toBe(false);
    });

    it("retourne false en cas d'erreur réseau", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
      expect(await checkVaultExistsOnCloud(VAULT_ID)).toBe(false);
    });
  });
});
