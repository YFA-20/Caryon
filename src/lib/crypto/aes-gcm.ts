import { fromBase64Url, toBase64Url } from "./bytes";
import {
  ENCRYPTED_RECORD_VERSION,
  encryptedRecordSchema,
  type EncryptedRecord,
} from "@/lib/schema/encrypted-record";

/**
 * Velora — chiffrement AES-256-GCM (Web Crypto).
 *
 * Règles absolues (docs/security/cryptography.md) :
 * - nonce 96 bits aléatoire, UNIQUE par opération de chiffrement ;
 * - AAD = métadonnées authentifiées ;
 * - format versionné (v1) ;
 * - toute modification du ciphertext invalide le tag GCM → rejet.
 */

export const AES_GCM_ALG = "AES-GCM" as const;
export const NONCE_BYTES = 12; // 96 bits, recommandé pour GCM
export const KEY_BYTES = 32; // 256 bits

function subtle(): SubtleCrypto {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API indisponible dans cet environnement");
  }
  return crypto.subtle;
}

/** Génère une clé AES-256 aléatoire (non extractible par défaut). */
export async function generateAesKey(extractable = false): Promise<CryptoKey> {
  return subtle().generateKey({ name: AES_GCM_ALG, length: 256 }, extractable, [
    "encrypt",
    "decrypt",
  ]);
}

/** Génère un nonce aléatoire de 96 bits. */
export function generateNonce(): Uint8Array {
  const nonce = new Uint8Array(NONCE_BYTES);
  crypto.getRandomValues(nonce);
  return nonce;
}

/** Importe une clé brute 256 bits (ex : clé maîtresse déballée). */
export async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== KEY_BYTES) {
    throw new Error(`Clé AES invalide : ${raw.length} octets (32 attendus)`);
  }
  return subtle().importKey("raw", raw as BufferSource, { name: AES_GCM_ALG }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Exporte une clé brute (utilisé uniquement pour l'enveloppement, jamais pour le stockage). */
export async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await subtle().exportKey("raw", key);
  return new Uint8Array(raw);
}

export interface EncryptOptions {
  /** Métadonnées authentifiées (AAD) — sérialisées en JSON puis encodées. */
  aad?: Record<string, string | number>;
}

/**
 * Chiffre `plaintext` (octets) avec AES-256-GCM.
 * Retourne un EncryptedRecord versionné (base64url).
 */
export async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  options: EncryptOptions = {}
): Promise<EncryptedRecord> {
  const iv = generateNonce();
  const aadText = new TextEncoder().encode(JSON.stringify(options.aad ?? {}));
  const ciphertext = await subtle().encrypt(
    { name: AES_GCM_ALG, iv: iv as BufferSource, additionalData: aadText as BufferSource },
    key,
    plaintext as BufferSource
  );
  return {
    v: ENCRYPTED_RECORD_VERSION,
    alg: "AES-256-GCM",
    iv: toBase64Url(iv),
    ct: toBase64Url(new Uint8Array(ciphertext)),
    aad: toBase64Url(aadText),
  };
}

/**
 * Déchiffre un EncryptedRecord. Lève une erreur si le tag GCM est invalide
 * (modification détectée) ou si le format est incorrect.
 */
export async function decryptBytes(key: CryptoKey, record: EncryptedRecord): Promise<Uint8Array> {
  const parsed = encryptedRecordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error("Enregistrement chiffré invalide (format)");
  }
  const iv = fromBase64Url(record.iv);
  const ct = fromBase64Url(record.ct);
  const aad = fromBase64Url(record.aad);
  if (iv.length !== NONCE_BYTES) {
    throw new Error("Nonce invalide (longueur)");
  }
  try {
    const plaintext = await subtle().decrypt(
      { name: AES_GCM_ALG, iv: iv as BufferSource, additionalData: aad as BufferSource },
      key,
      ct as BufferSource
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error(
      "Échec du déchiffrement : authentification GCM invalide (données modifiées ou mauvaise clé)"
    );
  }
}

/** Chiffre une chaîne UTF-8. */
export async function encryptText(
  key: CryptoKey,
  text: string,
  options: EncryptOptions = {}
): Promise<EncryptedRecord> {
  return encryptBytes(key, new TextEncoder().encode(text), options);
}

/** Déchiffre en chaîne UTF-8. */
export async function decryptText(key: CryptoKey, record: EncryptedRecord): Promise<string> {
  const bytes = await decryptBytes(key, record);
  return new TextDecoder().decode(bytes);
}
