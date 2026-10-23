/**
 * Velora — dépôt des entrées de journal (chiffrées).
 *
 * Toutes les opérations passent par le chiffrement AES-256-GCM.
 * Les données en clair n'existent qu'en mémoire après déverrouillage.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import { journalEntrySchema, type JournalEntry } from "@/lib/schema/journal";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const COLLECTION = "journal";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

export async function listJournalEntries(): Promise<JournalEntry[]> {
  const rows = await db.records.where("collection").equals(COLLECTION).toArray();
  const entries: JournalEntry[] = [];
  for (const row of rows) {
    try {
      const record = parseRecord(row.payload);
      const data = await decryptRecord<unknown>(record);
      const parsed = journalEntrySchema.safeParse(data);
      if (parsed.success) entries.push(parsed.data);
    } catch {
      console.error(`[journal] Entrée illisible: ${row.id}`);
    }
  }
  // Plus récentes d'abord
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getJournalEntry(id: string): Promise<JournalEntry | null> {
  const row = await db.records.get(id);
  if (!row || row.collection !== COLLECTION) return null;
  try {
    const record = parseRecord(row.payload);
    const data = await decryptRecord<unknown>(record);
    const parsed = journalEntrySchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createJournalEntry(
  input: Omit<JournalEntry, "id" | "createdAt" | "updatedAt">
): Promise<JournalEntry> {
  const now = new Date().toISOString();
  const entry: JournalEntry = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const validated = journalEntrySchema.parse(entry);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    date: validated.date,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ date: validated.date }),
    updatedAt: now,
  });
  return validated;
}

export async function updateJournalEntry(
  id: string,
  patch: Partial<Omit<JournalEntry, "id" | "createdAt">>
): Promise<JournalEntry> {
  const existing = await getJournalEntry(id);
  if (!existing) throw new Error(`Entrée introuvable: ${id}`);
  const updated: JournalEntry = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = journalEntrySchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    date: validated.date,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ date: validated.date }),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.records.delete(id);
}

export async function countJournalEntries(): Promise<number> {
  return db.records.where("collection").equals(COLLECTION).count();
}

/** Entrées d'un mois donné (YYYY-MM). */
export async function listJournalEntriesByMonth(yearMonth: string): Promise<JournalEntry[]> {
  const all = await listJournalEntries();
  return all.filter((e) => e.date.startsWith(yearMonth));
}
