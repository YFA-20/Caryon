import { z } from "zod";

/**
 * Velora — format versionné d'un enregistrement chiffré (AES-256-GCM).
 * Voir docs/security/cryptography.md §4.
 */

export const encryptedRecordSchema = z.object({
  /** Version du format de sérialisation. */
  v: z.literal(1),
  /** Algorithme — actuellement seul AES-256-GCM est supporté. */
  alg: z.literal("AES-256-GCM"),
  /** Nonce 96 bits, base64url — unique par opération de chiffrement. */
  iv: z.string().min(1),
  /** Ciphertext + tag GCM (128 bits), base64url. */
  ct: z.string().min(1),
  /** Métadonnées authentifiées (AAD), base64url. */
  aad: z.string().min(1),
});

export type EncryptedRecord = z.infer<typeof encryptedRecordSchema>;

export const ENCRYPTED_RECORD_VERSION = 1 as const;
