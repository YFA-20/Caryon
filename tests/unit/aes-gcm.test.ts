import { describe, expect, it } from "vitest";
import {
  decryptText,
  encryptText,
  exportAesKey,
  generateAesKey,
  generateNonce,
  importAesKey,
  NONCE_BYTES,
} from "@/lib/crypto/aes-gcm";
import { fromBase64Url } from "@/lib/crypto/bytes";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

describe("AES-256-GCM (Web Crypto)", () => {
  it("chiffre puis déchiffre un texte (aller-retour)", async () => {
    const key = await generateAesKey();
    const record = await encryptText(key, "Candidature chez Exemple — données sensibles");
    expect(record.v).toBe(1);
    expect(record.alg).toBe("AES-256-GCM");
    const plain = await decryptText(key, record);
    expect(plain).toBe("Candidature chez Exemple — données sensibles");
  });

  it("le ciphertext ne contient pas le texte en clair", async () => {
    const key = await generateAesKey();
    const secret = "mot-de-passe-super-secret-velora";
    const record = await encryptText(key, secret);
    expect(record.ct).not.toContain(secret);
    expect(fromBase64Url(record.ct).length).toBeGreaterThan(0);
  });

  it("génère des nonces uniques (jamais de réutilisation)", async () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const nonce = generateNonce();
      expect(nonce.length).toBe(NONCE_BYTES);
      const hex = Array.from(nonce)
        .map((b) => b.toString(16))
        .join("");
      expect(nonces.has(hex)).toBe(false);
      nonces.add(hex);
    }
  });

  it("produit des chiffrements différents pour un même texte (nonce aléatoire)", async () => {
    const key = await generateAesKey();
    const a = await encryptText(key, "même texte");
    const b = await encryptText(key, "même texte");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
    // mais les deux déchiffrent vers le même texte
    expect(await decryptText(key, a)).toBe("même texte");
    expect(await decryptText(key, b)).toBe("même texte");
  });

  it("détecte toute modification du ciphertext (intégrité GCM)", async () => {
    const key = await generateAesKey();
    const record = await encryptText(key, "données intègres");
    const tampered: EncryptedRecord = { ...record, ct: record.ct.slice(0, -4) + "AAAA" };
    await expect(decryptText(key, tampered)).rejects.toThrow(/authentification GCM invalide/);
  });

  it("détecte une modification du nonce", async () => {
    const key = await generateAesKey();
    const record = await encryptText(key, "données");
    const tampered: EncryptedRecord = { ...record, iv: record.iv.slice(0, -2) + "zz" };
    await expect(decryptText(key, tampered)).rejects.toThrow();
  });

  it("échoue avec une mauvaise clé", async () => {
    const key = await generateAesKey();
    const otherKey = await generateAesKey();
    const record = await encryptText(key, "secret");
    await expect(decryptText(otherKey, record)).rejects.toThrow();
  });

  it("rejette un format invalide", async () => {
    const key = await generateAesKey();
    await expect(
      decryptText(key, { v: 99, alg: "AES-256-GCM", iv: "x", ct: "y", aad: "z" } as never)
    ).rejects.toThrow(/invalide/);
  });

  it("importe/exporte une clé 256 bits", async () => {
    const key = await generateAesKey(true);
    const raw = await exportAesKey(key);
    expect(raw.length).toBe(32);
    const reimported = await importAesKey(raw);
    const record = await encryptText(key, "test round-trip clé");
    expect(await decryptText(reimported, record)).toBe("test round-trip clé");
  });

  it("authentifie les métadonnées (AAD)", async () => {
    const key = await generateAesKey();
    const record = await encryptText(key, "payload", {
      aad: { recordType: "application", id: "abc" },
    });
    expect(await decryptText(key, record)).toBe("payload");
  });
});
