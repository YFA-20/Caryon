/**
 * Velora — tests du service de coffre-fort.
 *
 * Vérifie :
 * - Création du coffre (métadonnées, pas de phrase stockée).
 * - Déverrouillage avec bonne/mauvaise phrase.
 * - Chiffrement/déchiffrement round-trip.
 * - Verrouillage.
 * - Persistance IndexedDB (via fake-indexeddb).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import {
  createVault,
  unlockVault,
  vaultExists,
  isUnlocked,
  lock,
  encryptRecord,
  decryptRecord,
} from "@/lib/vault/vault-service";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

async function resetDb() {
  await db.vault.clear();
  await db.records.clear();
  lock();
}

describe("vault-service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("crée un coffre et le marque comme existant", async () => {
    expect(await vaultExists()).toBe(false);
    const vault = await createVault(TEST_PASSPHRASE, { testMode: true });
    expect(vault.id).toBeTruthy();
    expect(vault.salt).toBeTruthy();
    expect(vault.wrappedMasterKey).toBeTruthy();
    expect(vault.verifier).toBeTruthy();
    expect(await vaultExists()).toBe(true);
    expect(isUnlocked()).toBe(true);
  });

  it("refuse une phrase trop courte", async () => {
    await expect(createVault("court", { testMode: true })).rejects.toThrow(
      /au moins 12 caractères/
    );
  });

  it("refuse de créer un second coffre", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    await expect(createVault(TEST_PASSPHRASE, { testMode: true })).rejects.toThrow(/existe déjà/);
  });

  it("ne stocke jamais la phrase secrète en clair", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const row = await db.vault.toCollection().first();
    expect(row).toBeTruthy();
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain(TEST_PASSPHRASE);
  });

  it("déverrouille avec la bonne phrase après verrouillage", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    lock();
    expect(isUnlocked()).toBe(false);

    const vault = await unlockVault(TEST_PASSPHRASE, { testMode: true });
    expect(vault.id).toBeTruthy();
    expect(isUnlocked()).toBe(true);
  });

  it("rejette une mauvaise phrase", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    lock();
    await expect(unlockVault("mauvaise-phrase-xyz-456", { testMode: true })).rejects.toThrow(
      /incorrecte/
    );
    expect(isUnlocked()).toBe(false);
  });

  it("chiffre et déchiffre un enregistrement (round-trip)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const data = { hello: "world", n: 42, nested: { a: [1, 2, 3] } };
    const encrypted = await encryptRecord(data, { collection: "test" });
    expect(encrypted.alg).toBe("AES-256-GCM");
    expect(encrypted.ct).not.toContain("world");

    const decrypted = await decryptRecord<typeof data>(encrypted);
    expect(decrypted).toEqual(data);
  });

  it("détecte une modification du ciphertext (AEAD)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const encrypted = await encryptRecord({ secret: "données sensibles" });
    // Modifie le ciphertext
    const tampered = {
      ...encrypted,
      ct: encrypted.ct.slice(0, -4) + "AAAA",
    };
    await expect(decryptRecord(tampered)).rejects.toThrow(/authentification|invalide/);
  });

  it("refuse de chiffrer quand le coffre est verrouillé", async () => {
    await expect(encryptRecord({ x: 1 })).rejects.toThrow(/verrouillé/);
  });

  it("génère des nonces uniques à chaque chiffrement", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const a = await encryptRecord({ x: 1 });
    const b = await encryptRecord({ x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});
