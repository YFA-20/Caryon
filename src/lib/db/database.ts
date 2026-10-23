import Dexie, { type Table } from "dexie";

/**
 * Velora — base de données IndexedDB (Dexie.js).
 *
 * SÉCURITÉ : cette base ne contient JAMAIS de données en clair.
 * - `vault` : métadonnées du coffre (sel, KDF params, clé maîtresse wrappée, verifier).
 * - `records` : enregistrements métier chiffrés (EncryptedRecord AES-256-GCM).
 * - `documents` : contenus binaires chiffrés (EncryptedRecord AES-256-GCM).
 * Les données en clair n'existent qu'en mémoire (session) après déverrouillage.
 */

export interface VaultRow {
  id: string;
  version: number;
  createdAt: string;
  kdf: {
    algorithm: "argon2id";
    memoryKiB: number;
    iterations: number;
    parallelism: number;
    hashLength: number;
  };
  salt: string;
  wrappedMasterKey: string;
  wrapIv: string;
  verifier: string;
  verifierIv: string;
  autoLockMs: number;
}

export interface EncryptedRow {
  id: string;
  collection: string;
  /** EncryptedRecord sérialisé en JSON (v, alg, iv, ct, aad). */
  payload: string;
  /** Métadonnées non sensibles pour l'indexation. */
  meta?: string;
  updatedAt: string;
}

export interface DocumentRow {
  id: string;
  /** Métadonnées du document (chiffrées). */
  meta: string;
  /** Contenu binaire chiffré (EncryptedRecord sérialisé). */
  content: string;
  /** Version actuelle. */
  version: number;
  updatedAt: string;
}

export class VeloraDB extends Dexie {
  vault!: Table<VaultRow, string>;
  records!: Table<EncryptedRow, string>;
  documents!: Table<DocumentRow, string>;

  constructor() {
    super("velora");
    this.version(1).stores({
      vault: "id",
      records: "id, collection, updatedAt",
    });
    this.version(2).stores({
      vault: "id",
      records: "id, collection, updatedAt",
      documents: "id, updatedAt",
    });
  }
}

export const db = new VeloraDB();
