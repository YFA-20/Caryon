/**
 * Velora — service de sauvegarde/restauration chiffrée.
 *
 * Export : sérialise TOUTES les données métier (applications, documents, événements),
 * les chiffre avec la clé maîtresse, et produit une archive portable (.velora).
 * L'archive inclut un snapshot du coffre (wrappedMasterKey, verifier, sel, KDF) :
 * la clé maîtresse reste wrappée par la KEK dérivée de la phrase secrète, donc
 * l'archive est illisible sans la phrase — y compris pour un tiers.
 *
 * Import (même appareil, mode replace/merge) : déchiffre et restaure les données.
 * Import (nouvel appareil, aucun coffre) : restaure d'abord le coffre depuis le
 * snapshot, l'utilisateur déverrouille ensuite avec sa phrase secrète.
 *
 * Format versionné (v1) pour compatibilité future.
 * Intégrité : checksum SHA-256 du payload chiffré.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord, getSession } from "./vault-service";
import { listApplications } from "./application-repository";
import { listDocuments, getDocumentContent } from "./document-repository";
import { listEvents } from "./calendar-repository";
import {
  backupManifestSchema,
  backupVaultSnapshotSchema,
  backupFormatVersion,
  type BackupArchive,
  type BackupManifest,
  type BackupVaultSnapshot,
} from "@/lib/schema/backup";

interface BackupData {
  applications: unknown[];
  documents: Array<{
    meta: unknown;
    content: number[];
  }>;
  events: unknown[];
}

async function sha256Hex(data: string): Promise<string> {
  const bytes = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Exporte toutes les données + le snapshot du coffre dans une archive chiffrée.
 */
export async function exportBackup(): Promise<BackupArchive> {
  const session = getSession();
  if (!session) throw new Error("Coffre verrouillé");

  // Snapshot du coffre (métadonnées non sensibles + clé wrappée)
  const vaultRow = await db.vault.toCollection().first();
  if (!vaultRow) throw new Error("Coffre introuvable");
  const vaultSnapshot: BackupVaultSnapshot = backupVaultSnapshotSchema.parse({
    id: vaultRow.id,
    version: vaultRow.version,
    createdAt: vaultRow.createdAt,
    kdf: vaultRow.kdf,
    salt: vaultRow.salt,
    wrappedMasterKey: vaultRow.wrappedMasterKey,
    wrapIv: vaultRow.wrapIv,
    verifier: vaultRow.verifier,
    verifierIv: vaultRow.verifierIv,
    autoLockMs: vaultRow.autoLockMs,
  });

  // Collecte des données
  const applications = await listApplications();
  const documentsMeta = await listDocuments();
  const documents = [];
  for (const doc of documentsMeta) {
    const content = await getDocumentContent(doc.id);
    if (content) {
      documents.push({
        meta: doc,
        content: Array.from(content),
      });
    }
  }
  const events = await listEvents();

  const data: BackupData = {
    applications,
    documents,
    events,
  };

  // Chiffrement du payload complet
  const encrypted = await encryptRecord(data, { purpose: "backup" });
  const payloadJson = JSON.stringify(encrypted);

  // Checksum du payload chiffré (intégrité)
  const checksum = await sha256Hex(payloadJson);

  const manifest: BackupManifest = {
    format: "velora-backup",
    version: backupFormatVersion,
    exportedAt: new Date().toISOString(),
    appVersion: "0.1.0",
    recordCount: applications.length + documents.length + events.length,
    checksum,
  };

  backupManifestSchema.parse(manifest);

  return {
    manifest,
    vault: vaultSnapshot,
    payload: encrypted,
  };
}

/**
 * Sérialise l'archive en chaîne JSON (pour téléchargement en .velora).
 */
export function serializeBackup(archive: BackupArchive): string {
  return JSON.stringify(archive, null, 2);
}

/**
 * Parse une archive depuis une chaîne JSON. Valide le manifest et le snapshot.
 */
export function parseBackup(json: string): BackupArchive {
  const parsed = JSON.parse(json) as BackupArchive;
  backupManifestSchema.parse(parsed.manifest);
  backupVaultSnapshotSchema.parse(parsed.vault);
  if (!parsed.payload || parsed.payload.v !== 1 || parsed.payload.alg !== "AES-256-GCM") {
    throw new Error("Format de payload non supporté");
  }
  return parsed;
}

/**
 * Restaure le coffre depuis le snapshot d'une archive.
 * À n'appeler que si AUCUN coffre n'existe sur l'appareil (nouvel appareil).
 * L'utilisateur devra ensuite déverrouiller avec sa phrase secrète.
 */
export async function restoreVaultFromBackup(archive: BackupArchive): Promise<void> {
  const existing = await db.vault.count();
  if (existing > 0) {
    throw new Error(
      "Un coffre existe déjà sur cet appareil. Supprimez-le ou utilisez la restauration de données."
    );
  }
  const snapshot = backupVaultSnapshotSchema.parse(archive.vault);
  await db.vault.add({
    id: snapshot.id,
    version: snapshot.version,
    createdAt: snapshot.createdAt,
    kdf: snapshot.kdf,
    salt: snapshot.salt,
    wrappedMasterKey: snapshot.wrappedMasterKey,
    wrapIv: snapshot.wrapIv,
    verifier: snapshot.verifier,
    verifierIv: snapshot.verifierIv,
    autoLockMs: snapshot.autoLockMs,
  });
}

/**
 * Vérifie l'intégrité de l'archive (checksum SHA-256 du payload).
 * Lève une erreur si le checksum ne correspond pas.
 */
export async function verifyBackupIntegrity(archive: BackupArchive): Promise<void> {
  const payloadJson = JSON.stringify(archive.payload);
  const checksum = await sha256Hex(payloadJson);
  if (checksum !== archive.manifest.checksum) {
    throw new Error(
      "Intégrité compromise : le checksum ne correspond pas. L'archive est peut-être corrompue ou modifiée."
    );
  }
}

/**
 * Importe une archive chiffrée et restaure les données (coffre déjà déverrouillé).
 * @param archive L'archive parsée
 * @param mode "replace" (écrase tout) ou "merge" (ajoute, écrase les doublons par id)
 */
export async function importBackup(
  archive: BackupArchive,
  mode: "replace" | "merge" = "replace"
): Promise<{ imported: number; skipped: number }> {
  const session = getSession();
  if (!session) throw new Error("Coffre verrouillé");

  await verifyBackupIntegrity(archive);

  // Déchiffrement
  const data = await decryptRecord<BackupData>(archive.payload);

  let imported = 0;
  let skipped = 0;

  if (mode === "replace") {
    await db.records.clear();
    await db.documents.clear();
  }

  // Restaure les candidatures
  for (const app of data.applications) {
    try {
      const appData = app as { id: string; updatedAt: string; status: string; company: string };
      const record = await encryptRecord(app, { collection: "applications" });
      await db.records.put({
        id: appData.id,
        collection: "applications",
        payload: JSON.stringify(record),
        meta: JSON.stringify({ status: appData.status, company: appData.company }),
        updatedAt: appData.updatedAt,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  // Restaure les événements
  for (const evt of data.events) {
    try {
      const evtData = evt as { id: string; updatedAt: string; type: string; startAt: string };
      const record = await encryptRecord(evt, { collection: "calendar-events" });
      await db.records.put({
        id: evtData.id,
        collection: "calendar-events",
        payload: JSON.stringify(record),
        meta: JSON.stringify({ type: evtData.type, startAt: evtData.startAt }),
        updatedAt: evtData.updatedAt,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  // Restaure les documents
  for (const doc of data.documents) {
    try {
      const docMeta = doc.meta as { id: string; updatedAt: string };
      const metaEncrypted = await encryptRecord(doc.meta, {
        collection: "documents",
        kind: "meta",
      });
      const contentEncrypted = await encryptRecord(doc.content, {
        collection: "documents",
        kind: "content",
      });
      await db.documents.put({
        id: docMeta.id,
        meta: JSON.stringify(metaEncrypted),
        content: JSON.stringify(contentEncrypted),
        version: 1,
        updatedAt: docMeta.updatedAt,
      });
      imported++;
    } catch {
      skipped++;
    }
  }

  return { imported, skipped };
}
