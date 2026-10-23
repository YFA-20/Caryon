import { z } from "zod";

/**
 * Velora — schéma de données : sauvegarde chiffrée (archive portable).
 *
 * Format versionné : un objet JSON contenant :
 * - métadonnées (version du format, date d'export, nombre d'enregistrements)
 * - le snapshot du coffre (VaultRow) — permet la restauration sur un NOUVEL appareil
 * - le payload chiffré (AES-256-GCM) contenant TOUTES les données métier
 *
 * Sécurité : le payload est chiffré avec la clé maîtresse du coffre d'origine.
 * Le snapshot du coffre (wrappedMasterKey, verifier, sel, KDF) est en clair dans
 * l'archive mais la clé maîtresse reste wrappée par la KEK dérivée de la phrase
 * secrète — sans la phrase, l'archive reste illisible.
 *
 * L'archive exportée est un fichier .velora (JSON).
 */

export const backupFormatVersion = 1 as const;

/** Snapshot du coffre (VaultRow) inclus pour la restauration sur un nouvel appareil. */
export const backupVaultSnapshotSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  kdf: z.object({
    algorithm: z.literal("argon2id"),
    memoryKiB: z.number().int().positive(),
    iterations: z.number().int().positive(),
    parallelism: z.number().int().positive(),
    hashLength: z.number().int().positive(),
  }),
  salt: z.string().min(1),
  wrappedMasterKey: z.string().min(1),
  wrapIv: z.string().min(1),
  verifier: z.string().min(1),
  verifierIv: z.string().min(1),
  autoLockMs: z.number().int().positive(),
});

export const backupManifestSchema = z.object({
  format: z.literal("velora-backup"),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  appVersion: z.string().max(20),
  /** Nombre d'enregistrements inclus (pour information). */
  recordCount: z.number().int().nonnegative(),
  /** Checksum SHA-256 du payload chiffré (hex). */
  checksum: z.string().length(64),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;
export type BackupVaultSnapshot = z.infer<typeof backupVaultSnapshotSchema>;

export interface BackupArchive {
  manifest: BackupManifest;
  /** Snapshot du coffre d'origine (permet la restauration sur un nouvel appareil). */
  vault: BackupVaultSnapshot;
  /** EncryptedRecord contenant toutes les données métier sérialisées. */
  payload: {
    v: 1;
    alg: "AES-256-GCM";
    iv: string;
    ct: string;
    aad: string;
  };
}
