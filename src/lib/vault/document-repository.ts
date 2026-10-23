/**
 * Velora — dépôt des documents chiffrés.
 *
 * Le contenu binaire est chiffré (AES-256-GCM) avant stockage dans IndexedDB.
 * Les métadonnées (nom, type, tags) sont aussi chiffrées.
 * Seules les métadonnées techniques minimales (id, version, date) sont en clair.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import {
  documentSchema,
  documentVersionSchema,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  type Document,
  type DocumentVersion,
  type DocumentType,
} from "@/lib/schema/document";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const COLLECTION = "documents";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

export async function listDocuments(): Promise<Document[]> {
  const rows = await db.documents.toArray();
  const docs: Document[] = [];
  for (const row of rows) {
    try {
      const metaRecord = parseRecord(row.meta);
      const data = await decryptRecord<unknown>(metaRecord);
      const parsed = documentSchema.safeParse(data);
      if (parsed.success) docs.push(parsed.data);
    } catch {
      console.error(`[documents] Métadonnées illisibles: ${row.id}`);
    }
  }
  return docs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocument(id: string): Promise<Document | null> {
  const row = await db.documents.get(id);
  if (!row) return null;
  try {
    const metaRecord = parseRecord(row.meta);
    const data = await decryptRecord<unknown>(metaRecord);
    const parsed = documentSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Récupère le contenu déchiffré d'un document.
 * Retourne les octets originaux (prêt à être téléchargé ou affiché).
 */
export async function getDocumentContent(id: string): Promise<Uint8Array | null> {
  const row = await db.documents.get(id);
  if (!row) return null;
  try {
    const contentRecord = parseRecord(row.content);
    return decryptRecord<Uint8Array>(contentRecord).then((data) => {
      // Le contenu est stocké comme tableau d'octets JSON
      return new Uint8Array(data as unknown as number[]);
    });
  } catch {
    return null;
  }
}

export interface CreateDocumentInput {
  name: string;
  type: DocumentType;
  mimeType: string;
  content: Uint8Array;
  tags?: string[];
  applicationId?: string;
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  // Validation des contraintes
  if (!ALLOWED_MIME_TYPES.includes(input.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error(`Type de fichier non autorisé : ${input.mimeType}`);
  }
  if (input.content.length > MAX_DOCUMENT_SIZE) {
    throw new Error(
      `Fichier trop volumineux (${(input.content.length / 1024 / 1024).toFixed(1)} Mo, max 10 Mo)`
    );
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Métadonnées du document
  const doc: Document = {
    id,
    name: input.name,
    type: input.type,
    mimeType: input.mimeType,
    sizeBytes: input.content.length,
    tags: input.tags ?? [],
    applicationId: input.applicationId || undefined,
    versionCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  const validatedDoc = documentSchema.parse(doc);

  // Version 1
  const version: DocumentVersion = {
    id: crypto.randomUUID(),
    documentId: id,
    version: 1,
    sizeBytes: input.content.length,
    createdAt: now,
  };
  const validatedVersion = documentVersionSchema.parse(version);

  // Chiffrement des métadonnées
  const metaEncrypted = await encryptRecord(validatedDoc, {
    collection: COLLECTION,
    id,
    kind: "meta",
  });

  // Chiffrement du contenu binaire (converti en tableau pour JSON)
  const contentArray = Array.from(input.content);
  const contentEncrypted = await encryptRecord(contentArray, {
    collection: COLLECTION,
    id,
    kind: "content",
    version: 1,
  });

  // Stockage de la version dans records (pour l'historique)
  await db.records.put({
    id: validatedVersion.id,
    collection: `${COLLECTION}-versions`,
    payload: JSON.stringify(await encryptRecord(validatedVersion, { collection: COLLECTION, id })),
    updatedAt: now,
  });

  await db.documents.put({
    id,
    meta: JSON.stringify(metaEncrypted),
    content: JSON.stringify(contentEncrypted),
    version: 1,
    updatedAt: now,
  });

  return validatedDoc;
}

/**
 * Ajoute une nouvelle version à un document existant.
 * L'ancienne version est conservée dans l'historique.
 */
export async function addDocumentVersion(
  documentId: string,
  content: Uint8Array
): Promise<DocumentVersion> {
  const doc = await getDocument(documentId);
  if (!doc) throw new Error("Document introuvable");
  if (content.length > MAX_DOCUMENT_SIZE) {
    throw new Error("Fichier trop volumineux (max 10 Mo)");
  }

  const now = new Date().toISOString();
  const newVersionNumber = doc.versionCount + 1;

  const version: DocumentVersion = {
    id: crypto.randomUUID(),
    documentId,
    version: newVersionNumber,
    sizeBytes: content.length,
    createdAt: now,
  };
  const validatedVersion = documentVersionSchema.parse(version);

  // Chiffrement du nouveau contenu
  const contentArray = Array.from(content);
  const contentEncrypted = await encryptRecord(contentArray, {
    collection: COLLECTION,
    id: documentId,
    kind: "content",
    version: newVersionNumber,
  });

  // Mise à jour du contenu actuel
  await db.documents.update(documentId, {
    content: JSON.stringify(contentEncrypted),
    version: newVersionNumber,
    updatedAt: now,
  });

  // Mise à jour des métadonnées (versionCount, sizeBytes, updatedAt)
  const updatedDoc: Document = {
    ...doc,
    sizeBytes: content.length,
    versionCount: newVersionNumber,
    updatedAt: now,
  };
  const metaEncrypted = await encryptRecord(updatedDoc, {
    collection: COLLECTION,
    id: documentId,
    kind: "meta",
  });
  await db.documents.update(documentId, {
    meta: JSON.stringify(metaEncrypted),
  });

  // Stockage de la version dans l'historique
  await db.records.put({
    id: validatedVersion.id,
    collection: `${COLLECTION}-versions`,
    payload: JSON.stringify(
      await encryptRecord(validatedVersion, { collection: COLLECTION, id: documentId })
    ),
    updatedAt: now,
  });

  return validatedVersion;
}

export async function updateDocument(
  id: string,
  patch: Partial<Omit<Document, "id" | "createdAt">>
): Promise<Document> {
  const existing = await getDocument(id);
  if (!existing) throw new Error(`Document introuvable: ${id}`);

  const updated: Document = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = documentSchema.parse(updated);

  const metaEncrypted = await encryptRecord(validated, {
    collection: COLLECTION,
    id,
    kind: "meta",
  });

  await db.documents.update(id, {
    meta: JSON.stringify(metaEncrypted),
    updatedAt: validated.updatedAt,
  });

  return validated;
}

export async function deleteDocument(id: string): Promise<void> {
  // Supprime le document et son historique de versions
  await db.documents.delete(id);
  const versions = await db.records.where("collection").equals(`${COLLECTION}-versions`).toArray();
  const versionIds = versions
    .filter((v) => {
      try {
        const record = parseRecord(v.payload);
        return record.aad && atob(record.aad.replace(/-/g, "+").replace(/_/g, "/")).includes(id);
      } catch {
        return false;
      }
    })
    .map((v) => v.id);
  await db.records.bulkDelete(versionIds);
}

export async function countDocuments(): Promise<number> {
  return db.documents.count();
}

/** Retourne la taille totale utilisée par les documents (en octets). */
export async function getTotalDocumentsSize(): Promise<number> {
  const docs = await listDocuments();
  return docs.reduce((sum, d) => sum + d.sizeBytes, 0);
}
