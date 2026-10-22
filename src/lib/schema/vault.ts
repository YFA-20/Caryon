import { z } from "zod";

/**
 * Velora — schéma de données : Vault (métadonnées du coffre-fort).
 * Le coffre ne contient JAMAIS la phrase secrète ni la clé maîtresse en clair.
 * `wrappedMasterKey` + `verifier` permettent de valider la phrase sans stocker de dérivé.
 */

export const kdfParamsSchema = z.object({
  algorithm: z.literal("argon2id"),
  memoryKiB: z.number().int().positive(),
  iterations: z.number().int().positive(),
  parallelism: z.number().int().positive(),
  hashLength: z.number().int().positive(),
});

export const vaultSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive().default(1),
  createdAt: z.string().datetime(),
  kdf: kdfParamsSchema,
  /** Sel aléatoire (128 bits) encodé base64url — stocké en clair par conception. */
  salt: z.string().min(1),
  /** Clé maîtresse chiffrée (wrapped) par la KEK dérivée de la phrase. */
  wrappedMasterKey: z.string().min(1),
  /** Nonce utilisé pour l'enveloppement de la clé maîtresse. */
  wrapIv: z.string().min(1),
  /** Challenge AEAD : permet de vérifier la phrase sans stocker de dérivé réutilisable. */
  verifier: z.string().min(1),
  verifierIv: z.string().min(1),
  /** Nombre d'itérations auto-lock (ms). */
  autoLockMs: z
    .number()
    .int()
    .positive()
    .default(15 * 60 * 1000),
});

export type Vault = z.infer<typeof vaultSchema>;
export type KdfParams = z.infer<typeof kdfParamsSchema>;

export const VAULT_SCHEMA_VERSION = 1;
