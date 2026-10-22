/**
 * Velora — dépôt des candidatures (Application).
 *
 * Toutes les opérations passent par le chiffrement AES-256-GCM.
 * Les données en clair n'existent qu'en mémoire après déverrouillage.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import { applicationSchema, type Application } from "@/lib/schema/application";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const COLLECTION = "applications";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

export async function listApplications(): Promise<Application[]> {
  const rows = await db.records.where("collection").equals(COLLECTION).toArray();
  const apps: Application[] = [];
  for (const row of rows) {
    try {
      const record = parseRecord(row.payload);
      const data = await decryptRecord<unknown>(record);
      const parsed = applicationSchema.safeParse(data);
      if (parsed.success) apps.push(parsed.data);
    } catch {
      // Enregistrement illisible (modifié/corrompu) — ignoré, loggé côté console en dev.
      console.error(`[vault] Enregistrement candidature illisible: ${row.id}`);
    }
  }
  return apps.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getApplication(id: string): Promise<Application | null> {
  const row = await db.records.get(id);
  if (!row || row.collection !== COLLECTION) return null;
  const record = parseRecord(row.payload);
  const data = await decryptRecord<unknown>(record);
  const parsed = applicationSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export async function createApplication(
  input: Omit<Application, "id" | "createdAt" | "updatedAt">
): Promise<Application> {
  const now = new Date().toISOString();
  const app: Application = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const validated = applicationSchema.parse(app);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    status: validated.status,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ status: validated.status, company: validated.company }),
    updatedAt: now,
  });
  return validated;
}

export async function updateApplication(
  id: string,
  patch: Partial<Omit<Application, "id" | "createdAt">>
): Promise<Application> {
  const existing = await getApplication(id);
  if (!existing) throw new Error(`Candidature introuvable: ${id}`);
  const updated: Application = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = applicationSchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    status: validated.status,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ status: validated.status, company: validated.company }),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

export async function deleteApplication(id: string): Promise<void> {
  await db.records.delete(id);
}

export async function countApplications(): Promise<number> {
  return db.records.where("collection").equals(COLLECTION).count();
}
