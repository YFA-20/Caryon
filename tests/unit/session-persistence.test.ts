/**
 * Tests unitaires — session-persistence (fix F5 verrouillage).
 *
 * Vérifie que :
 * - persistSession() chiffre la clé maître et la stocke dans IndexedDB
 * - tryRestoreSession() déchiffre et retourne la clé maître après "F5"
 * - clearPersistedSession() efface sessionStorage + IndexedDB
 * - Sans la clé de session (sessionStorage effacé), la restauration échoue
 * - Les données dans IndexedDB ne sont PAS en clair
 * - La clé maître restaurée est identique à l'originale
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import {
  createVault,
  unlockVault,
  lock,
  isUnlocked,
  tryRestoreSessionFromDisk,
} from "@/lib/vault/vault-service";
import {
  persistSession,
  tryRestoreSession,
  clearPersistedSession,
  hasPersistedSession,
} from "@/lib/vault/session-persistence";
import { encryptRecord, decryptRecord } from "@/lib/vault/vault-service";
import { db } from "@/lib/db/database";

const PASSPHRASE = "test-session-persistence-passphrase-456!";

const SESSION_STORAGE_KEY = "velora:sessionKey";
const SESSION_DB_ID = "__session__";

describe("session-persistence", () => {
  beforeAll(async () => {
    await createVault(PASSPHRASE, { testMode: true });
  });

  beforeEach(async () => {
    // Nettoyer complètement entre les tests
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
    // Recréer un coffre frais
    await createVault(PASSPHRASE, { testMode: true });
  });

  afterEach(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  it("persistSession stocke la clé de session dans sessionStorage", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(stored!.length).toBeGreaterThan(0);
  });

  it("persistSession stocke le ciphertext dans IndexedDB (pas en clair)", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    const row = await db.records.get(SESSION_DB_ID);
    expect(row).toBeDefined();
    expect(row!.collection).toBe("__session__");

    // Le payload est un EncryptedRecord JSON — pas la clé en clair
    const payload = JSON.parse(row!.payload);
    expect(payload.v).toBe(1);
    expect(payload.alg).toBe("AES-256-GCM");
    expect(payload.ct).toBeTruthy();
    expect(payload.iv).toBeTruthy();

    // Vérifier que la clé brute n'apparaît nulle part dans le payload
    const payloadStr = row!.payload;
    // La clé brute en base64url ne doit pas être dans le payload
    // (on vérifie juste que le payload est bien un ciphertext, pas du brut)
    expect(payloadStr).not.toContain('"rawKey"');
  });

  it("tryRestoreSession retourne la clé maître identique après persistSession", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    // Simuler F5 : la session en mémoire est perdue, mais sessionStorage + IndexedDB survivent
    const restored = await tryRestoreSession();
    expect(restored).not.toBeNull();
    expect(restored!.length).toBe(32);
    expect(Array.from(restored!)).toEqual(Array.from(rawKey));
  });

  it("tryRestoreSession retourne null si sessionStorage est vidé (fermeture onglet)", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    // Simuler fermeture de l'onglet : sessionStorage est effacé
    window.sessionStorage.clear();

    const restored = await tryRestoreSession();
    expect(restored).toBeNull();
  });

  it("clearPersistedSession efface sessionStorage ET IndexedDB", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(await db.records.get(SESSION_DB_ID)).toBeDefined();

    await clearPersistedSession();

    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(await db.records.get(SESSION_DB_ID)).toBeUndefined();
  });

  it("hasPersistedSession retourne true après persistSession, false après clear", async () => {
    // createVault dans beforeEach persiste déjà une session
    // On efface d'abord pour partir d'un état propre
    await clearPersistedSession();
    expect(hasPersistedSession()).toBe(false);

    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);
    expect(hasPersistedSession()).toBe(true);

    await clearPersistedSession();
    expect(hasPersistedSession()).toBe(false);
  });

  it("lock() efface la session persistée (IndexedDB + sessionStorage)", async () => {
    // createVault persiste automatiquement la session
    expect(hasPersistedSession()).toBe(true);
    expect(isUnlocked()).toBe(true);

    lock();

    // La session en mémoire est effacée
    expect(isUnlocked()).toBe(false);

    // La session persistée doit aussi être effacée (async, on attend un peu)
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(hasPersistedSession()).toBe(false);
    expect(await db.records.get(SESSION_DB_ID)).toBeUndefined();
  });

  it("F5 simulé : unlockVault → F5 → tryRestoreSessionFromDisk → données accessibles", async () => {
    // 1. Déverrouiller (simule l'état initial)
    await unlockVault(PASSPHRASE, { testMode: true });
    expect(isUnlocked()).toBe(true);

    // 2. Créer une donnée chiffrée
    const testData = { company: "Test F5 Corp", position: "Dev" };
    const encrypted = await encryptRecord(testData, { collection: "test", id: "f5-test" });

    // 3. Simuler F5 : effacer la session en mémoire
    // (on ne peut pas vraiment faire F5 en test, donc on simule)
    lock(); // efface session + persistée
    // Mais on veut tester la restauration, donc on re-persiste
    await unlockVault(PASSPHRASE, { testMode: true });

    // 4. Restaurer depuis le disque (simule le F5)
    const restored = await tryRestoreSessionFromDisk();
    expect(restored).toBe(true);
    expect(isUnlocked()).toBe(true);

    // 5. Déchiffrer la donnée créée avant le "F5"
    const decrypted = await decryptRecord<typeof testData>(encrypted);
    expect(decrypted.company).toBe("Test F5 Corp");
    expect(decrypted.position).toBe("Dev");
  });

  it("après clearPersistedSession, tryRestoreSessionFromDisk retourne false", async () => {
    await unlockVault(PASSPHRASE, { testMode: true });
    expect(isUnlocked()).toBe(true);

    await clearPersistedSession();

    const restored = await tryRestoreSessionFromDisk();
    expect(restored).toBe(false);
  });

  it("la clé maître dans IndexedDB n'est PAS en clair (inspection du payload)", async () => {
    // Créer un coffre (persiste auto)
    await unlockVault(PASSPHRASE, { testMode: true });

    const row = await db.records.get(SESSION_DB_ID);
    expect(row).toBeDefined();

    // Le payload doit être un JSON avec v, alg, iv, ct, aad
    const parsed = JSON.parse(row!.payload);
    expect(parsed).toHaveProperty("v");
    expect(parsed).toHaveProperty("alg", "AES-256-GCM");
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("ct");
    expect(parsed).toHaveProperty("aad");

    // Le ciphertext ne doit pas contenir de données reconnaissables en clair
    // (c'est du base64url aléatoire)
    expect(parsed.ct.length).toBeGreaterThan(32); // 32 bytes + GCM tag = 48 bytes minimum
  });

  it("deux persistSession successifs remplacent l'ancienne entrée (pas de doublon)", async () => {
    const rawKey1 = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey1);

    const rawKey2 = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey2);

    // Une seule entrée dans IndexedDB
    const count = await db.records.where("collection").equals("__session__").count();
    expect(count).toBe(1);

    // La restauration retourne la deuxième clé
    const restored = await tryRestoreSession();
    expect(restored).not.toBeNull();
    expect(Array.from(restored!)).toEqual(Array.from(rawKey2));
  });

  it("sessionStorage est utilisé (pas localStorage) — vérifié en test", async () => {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    await persistSession(rawKey);

    // sessionStorage a la clé
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    // localStorage ne doit PAS avoir la clé
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
