/**
 * Velora — service du coffre-fort (vault).
 *
 * Responsabilités :
 * - Créer un coffre (génération clé maîtresse, dérivation KEK, wrapping, verifier).
 * - Déverrouiller (dériver la KEK, unwrapper la clé maîtresse, vérifier).
 * - Verrouiller (effacer les références en mémoire).
 * - Chiffrer/déchiffrer des enregistrements métier.
 *
 * SÉCURITÉ :
 * - La phrase secrète n'est JAMAIS stockée.
 * - La clé maîtresse n'est JAMAIS stockée en clair (wrappée par la KEK).
 * - La clé maîtresse déverrouillée ne vit qu'en mémoire (CryptoKey non extractible).
 * - Le verrouillage efface les références (best-effort, pas de garantie GC).
 * - PERSISTANCE F5 : la clé maîtresse est chiffrée par une clé de session
 *   aléatoire stockée dans sessionStorage (effacée à la fermeture de l'onglet).
 *   Le ciphertext est dans IndexedDB. Sans la clé de session (sessionStorage),
 *   le ciphertext est inutilisable. Voir session-persistence.ts.
 */
import { db, type VaultRow } from "@/lib/db/database";
import { deriveKey, generateSalt, DEFAULT_KDF_PARAMS, TEST_KDF_PARAMS } from "@/lib/crypto/kdf";
import { importAesKey, encryptBytes, decryptBytes, generateNonce } from "@/lib/crypto/aes-gcm";
import { toBase64Url, fromBase64Url } from "@/lib/crypto/bytes";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";
import type { Vault } from "@/lib/schema/vault";
import {
  persistSession,
  tryRestoreSession,
  clearPersistedSession,
  hasPersistedSession,
} from "@/lib/vault/session-persistence";

export interface VaultSession {
  vault: Vault;
  masterKey: CryptoKey;
}

/** Contexte de session en mémoire (jamais persisté). */
let session: VaultSession | null = null;

export function isUnlocked(): boolean {
  return session !== null;
}

export function getSession(): VaultSession | null {
  return session;
}

/**
 * Efface la session (verrouillage). Best-effort : le GC JS n'est pas déterministe.
 * Efface aussi la session persistée (sessionStorage + IndexedDB).
 */
export function lock(): void {
  session = null;
  void clearPersistedSession();
}

/**
 * Verrouillage forcé avec synchronisation du store UI.
 *
 * Appelé par l'auto-lock, le bouton de verrouillage manuel, et le guard
 * de visibilité. Efface la session en mémoire ET met à jour le store
 * Zustand pour que l'interface bascule immédiatement sur le portail de
 * déverrouillage (pas de page blanche).
 *
 * SÉCURITÉ : on NE redirige PLUS vers « / ». Le portail de déverrouillage
 * s'affiche sur la page actuelle grâce au store Zustand. Cela évite l'écran
 * vierge causé par window.location.replace() pendant l'hydratation React.
 * Les données en clair ne sont jamais dans le DOM quand verrouillé car
 * VaultGate ne rend pas les enfants tant que status !== "unlocked".
 */
export function forceLock(): void {
  session = null;
  void clearPersistedSession();
  // Synchronise le store Zustand (import dynamique pour éviter la dépendance circulaire)
  if (typeof window !== "undefined") {
    import("@/store/vault-store").then(({ useVaultStore }) => {
      useVaultStore.getState().setStatus("locked");
    });
  }
}

async function wrapMasterKey(
  kek: Uint8Array,
  rawMasterKey: Uint8Array
): Promise<{ wrapped: string; iv: string }> {
  const kekKey = await importAesKey(kek);
  const iv = generateNonce();
  const aad = new TextEncoder().encode(JSON.stringify({ purpose: "wrap-master-key" }));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
    kekKey,
    rawMasterKey as BufferSource
  );
  return { wrapped: toBase64Url(new Uint8Array(ct)), iv: toBase64Url(iv) };
}

async function unwrapMasterKey(
  kek: Uint8Array,
  wrapped: string,
  ivB64: string
): Promise<CryptoKey> {
  const kekKey = await importAesKey(kek);
  const iv = fromBase64Url(ivB64);
  const ct = fromBase64Url(wrapped);
  const aad = new TextEncoder().encode(JSON.stringify({ purpose: "wrap-master-key" }));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
    kekKey,
    ct as BufferSource
  );
  return importAesKey(new Uint8Array(raw));
}

/**
 * Unwrappe la clé maître et retourne les octets bruts (pour persistance).
 * À utiliser UNIQUEMENT pour persistSession, jamais pour stockage en clair.
 */
async function unwrapMasterKeyRaw(
  kek: Uint8Array,
  wrapped: string,
  ivB64: string
): Promise<Uint8Array> {
  const kekKey = await importAesKey(kek);
  const iv = fromBase64Url(ivB64);
  const ct = fromBase64Url(wrapped);
  const aad = new TextEncoder().encode(JSON.stringify({ purpose: "wrap-master-key" }));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
    kekKey,
    ct as BufferSource
  );
  return new Uint8Array(raw);
}

async function createVerifier(kek: Uint8Array): Promise<{ verifier: string; iv: string }> {
  const kekKey = await importAesKey(kek);
  const iv = generateNonce();
  const aad = new TextEncoder().encode(JSON.stringify({ purpose: "passphrase-verifier" }));
  const marker = new TextEncoder().encode("velora-vault-verifier-v1");
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
    kekKey,
    marker as BufferSource
  );
  return { verifier: toBase64Url(new Uint8Array(ct)), iv: toBase64Url(iv) };
}

async function verifyPassphrase(
  kek: Uint8Array,
  verifier: string,
  ivB64: string
): Promise<boolean> {
  try {
    const kekKey = await importAesKey(kek);
    const iv = fromBase64Url(ivB64);
    const ct = fromBase64Url(verifier);
    const aad = new TextEncoder().encode(JSON.stringify({ purpose: "passphrase-verifier" }));
    const raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource },
      kekKey,
      ct as BufferSource
    );
    const marker = new TextDecoder().decode(raw);
    return marker === "velora-vault-verifier-v1";
  } catch {
    return false;
  }
}

export async function vaultExists(): Promise<boolean> {
  const count = await db.vault.count();
  return count > 0;
}

export async function createVault(
  passphrase: string,
  options: { autoLockMs?: number; testMode?: boolean } = {}
): Promise<Vault> {
  if (await vaultExists()) {
    throw new Error("Un coffre existe déjà sur cet appareil");
  }
  if (passphrase.length < 12) {
    throw new Error("La phrase secrète doit contenir au moins 12 caractères");
  }

  const kdfParams = options.testMode ? TEST_KDF_PARAMS : DEFAULT_KDF_PARAMS;
  const salt = generateSalt(16);
  const { key: kek } = await deriveKey(passphrase, salt, kdfParams);

  // Génère la clé maîtresse brute (32 octets aléatoires), la wrappe,
  // puis l'importe comme NON-extractible pour la session.
  const rawMasterKey = crypto.getRandomValues(new Uint8Array(32));
  const { wrapped, iv } = await wrapMasterKey(kek, rawMasterKey);
  const masterKey = await importAesKey(rawMasterKey);
  const { verifier, iv: verifierIv } = await createVerifier(kek);

  const vault: Vault = {
    id: crypto.randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    kdf: kdfParams,
    salt: toBase64Url(salt),
    wrappedMasterKey: wrapped,
    wrapIv: iv,
    verifier,
    verifierIv,
    autoLockMs: options.autoLockMs ?? 15 * 60 * 1000,
  };

  const row: VaultRow = {
    id: vault.id,
    version: vault.version,
    createdAt: vault.createdAt,
    kdf: vault.kdf,
    salt: vault.salt,
    wrappedMasterKey: vault.wrappedMasterKey,
    wrapIv: vault.wrapIv,
    verifier: vault.verifier,
    verifierIv: vault.verifierIv,
    autoLockMs: vault.autoLockMs,
  };
  await db.vault.add(row);

  session = { vault, masterKey };
  // Persiste la session pour survivre au F5 (chiffrée par sessionStorage)
  await persistSession(rawMasterKey);
  return vault;
}

export async function unlockVault(
  passphrase: string,
  options: { testMode?: boolean } = {}
): Promise<Vault> {
  const row = await db.vault.toCollection().first();
  if (!row) {
    throw new Error("Aucun coffre trouvé sur cet appareil");
  }

  const salt = fromBase64Url(row.salt);
  const kdfParams = options.testMode
    ? { ...row.kdf, memoryKiB: Math.min(row.kdf.memoryKiB, 64), iterations: 1 }
    : row.kdf;
  const { key: kek } = await deriveKey(passphrase, salt, kdfParams);

  const ok = await verifyPassphrase(kek, row.verifier, row.verifierIv);
  if (!ok) {
    throw new Error("Phrase secrète incorrecte");
  }

  const masterKey = await unwrapMasterKey(kek, row.wrappedMasterKey, row.wrapIv);

  const vault: Vault = {
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    kdf: row.kdf,
    salt: row.salt,
    wrappedMasterKey: row.wrappedMasterKey,
    wrapIv: row.wrapIv,
    verifier: row.verifier,
    verifierIv: row.verifierIv,
    autoLockMs: row.autoLockMs,
  };

  session = { vault, masterKey };

  // Persiste la session pour survivre au F5.
  // Pour cela, on a besoin de la clé maître brute. On la déchiffre à nouveau
  // depuis le wrapped (l'opération est rapide, ~1ms avec AES-GCM).
  const rawMasterKey = await unwrapMasterKeyRaw(kek, row.wrappedMasterKey, row.wrapIv);
  await persistSession(rawMasterKey);

  return vault;
}

/**
 * Tente de restaurer la session après un F5 / refresh.
 * Si une session persistée existe (sessionStorage + IndexedDB),
 * déchiffre la clé maître et restaure la session en mémoire.
 * Retourne true si la restauration a réussi.
 *
 * SÉCURITÉ : la clé de session est dans sessionStorage (effacée à la fermeture
 * de l'onglet). Si elle n'existe plus, la restauration échoue silencieusement
 * et l'utilisateur doit se déverrouiller avec sa phrase secrète.
 */
export async function tryRestoreSessionFromDisk(): Promise<boolean> {
  const rawMasterKey = await tryRestoreSession();
  if (!rawMasterKey) return false;

  const row = await db.vault.toCollection().first();
  if (!row) return false;

  const masterKey = await importAesKey(rawMasterKey);
  const vault: Vault = {
    id: row.id,
    version: row.version,
    createdAt: row.createdAt,
    kdf: row.kdf,
    salt: row.salt,
    wrappedMasterKey: row.wrappedMasterKey,
    wrapIv: row.wrapIv,
    verifier: row.verifier,
    verifierIv: row.verifierIv,
    autoLockMs: row.autoLockMs,
  };

  session = { vault, masterKey };
  return true;
}

export { hasPersistedSession };

/**
 * Restaure une session en mémoire depuis un coffre restauré depuis le cloud.
 * Utilisé par vault-meta-service (restauration multi-appareils) : le coffre
 * est déjà créé dans IndexedDB, il faut juste remettre la session en mémoire.
 *
 * SÉCURITÉ : identique à unlockVault — la clé maître est importée non-extractible,
 * la session est persistée (chiffrée par sessionStorage) pour survivre au F5.
 */
export async function setSessionForRestore(
  vault: Vault,
  masterKey: CryptoKey,
  rawMasterKey: Uint8Array
): Promise<void> {
  session = { vault, masterKey };
  await persistSession(rawMasterKey);
  // Synchronise le store Zustand.
  if (typeof window !== "undefined") {
    const { useVaultStore } = await import("@/store/vault-store");
    useVaultStore.getState().setStatus("unlocked");
    useVaultStore.getState().setAutoLockMs(vault.autoLockMs);
  }
}

export async function encryptRecord(
  data: unknown,
  aad: Record<string, string | number> = {}
): Promise<EncryptedRecord> {
  if (!session) throw new Error("Coffre verrouillé");
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  return encryptBytes(session.masterKey, plaintext, { aad });
}

export async function decryptRecord<T>(record: EncryptedRecord): Promise<T> {
  if (!session) throw new Error("Coffre verrouillé");
  const bytes = await decryptBytes(session.masterKey, record);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
