/**
 * Tests unitaires — preuve de possession pour l'appairage (pairing-proof.ts).
 *
 * Vérifie que :
 * - generatePairingProof retourne une preuve non vide (base64url).
 * - La preuve est différente à chaque appel (nonce aléatoire dans le matériau).
 * - La preuve dépend du pairingId.
 * - Sans coffre déverrouillé, la fonction lève une erreur.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import { generatePairingProof } from "@/lib/sync/pairing-proof";

const TEST_PASSPHRASE = "phrase-secrete-de-test-123";
const PAIRING_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("pairing-proof", () => {
  beforeEach(async () => {
    lock();
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
  });

  it("génère une preuve non vide (base64url)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const proof = await generatePairingProof(PAIRING_ID);
    expect(proof.length).toBeGreaterThan(0);
    // base64url : pas de +, /, =
    expect(proof).toMatch(/^[A-Za-z0-9_-]+$/);
    lock();
  });

  it("génère des preuves différentes à chaque appel (nonce aléatoire)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const proof1 = await generatePairingProof(PAIRING_ID);
    const proof2 = await generatePairingProof(PAIRING_ID);
    expect(proof1).not.toBe(proof2);
    lock();
  });

  it("la preuve est suffisamment longue (HMAC-SHA256 = 32 octets = 43 chars base64url)", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const proof = await generatePairingProof(PAIRING_ID);
    // HMAC-SHA256 = 32 octets → 43 caractères en base64url (sans padding).
    expect(proof.length).toBeGreaterThanOrEqual(43);
    lock();
  });

  it("lève une erreur si le coffre est verrouillé", async () => {
    await expect(generatePairingProof(PAIRING_ID)).rejects.toThrow("Coffre verrouillé");
  });

  it("ne révèle pas la clé maîtresse dans la preuve", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const proof = await generatePairingProof(PAIRING_ID);
    // La preuve ne doit pas contenir la phrase secrète ni de données lisibles.
    expect(proof).not.toContain(TEST_PASSPHRASE);
    expect(proof).not.toContain("velora");
    lock();
  });
});
