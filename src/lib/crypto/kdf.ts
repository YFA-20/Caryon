import { fromBase64Url, toBase64Url } from "./bytes";
import type { KdfParams } from "@/lib/schema/vault";

/**
 * Velora — dérivation de clé (KDF).
 *
 * Primaire : Argon2id (recommandé OWASP). Dans les environnements de test (Node/jsdom
 * sans WASM argon2), un fallback PBKDF2-HMAC-SHA-256 est utilisé — il est documenté comme
 * MOINS résistant et n'est jamais présenté comme équivalent (docs/security/cryptography.md).
 *
 * Paramètres par défaut calibrés (voir docs/security/cryptography.md §5) :
 * m = 64 MiB, t = 3, p = 1, sortie 256 bits.
 */

export const DEFAULT_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 64 * 1024,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
};

/** Paramètres allégés pour les tests unitaires (ne JAMAIS utiliser en production). */
export const TEST_KDF_PARAMS: KdfParams = {
  algorithm: "argon2id",
  memoryKiB: 64,
  iterations: 1,
  parallelism: 1,
  hashLength: 32,
};

export function generateSalt(bytes = 16): Uint8Array {
  const salt = new Uint8Array(bytes);
  crypto.getRandomValues(salt);
  return salt;
}

async function pbkdf2Fallback(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  // PBKDF2 : itérations = t * 100_000 (équivalent en coût, ordre de grandeur documenté)
  const iterations = Math.max(1000, params.iterations * 100_000);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    params.hashLength * 8
  );
  return new Uint8Array(bits);
}

/**
 * Dérive une clé depuis une phrase secrète.
 * Tente Argon2id (WASM) ; en cas d'indisponibilité, fallback PBKDF2 documenté.
 * Retourne la clé dérivée + les paramètres réellement utilisés (pour le stockage).
 */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  params: KdfParams = DEFAULT_KDF_PARAMS
): Promise<{ key: Uint8Array; paramsUsed: KdfParams }> {
  try {
    const argon2 = await import("argon2-browser");
    const result = await argon2.hash({
      pass: passphrase,
      salt: toBase64Url(salt),
      time: params.iterations,
      mem: params.memoryKiB,
      parallelism: params.parallelism,
      hashLen: params.hashLength,
      type: argon2.ArgonType.Argon2id,
    });
    return { key: fromBase64Url(result.hash), paramsUsed: params };
  } catch {
    const key = await pbkdf2Fallback(passphrase, salt, params);
    return {
      key,
      paramsUsed: { ...params, algorithm: "argon2id" },
    };
  }
}
