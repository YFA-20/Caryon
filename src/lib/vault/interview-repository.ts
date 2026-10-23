/**
 * Velora — dépôt des fiches de préparation d'entretien (chiffrées).
 *
 * Une fiche est liée à une candidature. Contient le contexte entreprise,
 * une checklist, des questions anticipées et une auto-évaluation.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import {
  interviewPrepSchema,
  DEFAULT_INTERVIEW_CHECKLIST,
  type InterviewPrep,
  type InterviewChecklistItem,
} from "@/lib/schema/interview";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const COLLECTION = "interview-preps";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

function defaultChecklist(): InterviewChecklistItem[] {
  return DEFAULT_INTERVIEW_CHECKLIST.map((label) => ({
    id: crypto.randomUUID(),
    label,
    done: false,
  }));
}

export async function listInterviewPreps(): Promise<InterviewPrep[]> {
  const rows = await db.records.where("collection").equals(COLLECTION).toArray();
  const preps: InterviewPrep[] = [];
  for (const row of rows) {
    try {
      const record = parseRecord(row.payload);
      const data = await decryptRecord<unknown>(record);
      const parsed = interviewPrepSchema.safeParse(data);
      if (parsed.success) preps.push(parsed.data);
    } catch {
      console.error(`[interview] Fiche illisible: ${row.id}`);
    }
  }
  return preps.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getInterviewPrep(id: string): Promise<InterviewPrep | null> {
  const row = await db.records.get(id);
  if (!row || row.collection !== COLLECTION) return null;
  try {
    const record = parseRecord(row.payload);
    const data = await decryptRecord<unknown>(record);
    const parsed = interviewPrepSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Fiche de préparation pour une candidature donnée (0 ou 1). */
export async function getInterviewPrepByApplication(
  applicationId: string
): Promise<InterviewPrep | null> {
  const all = await listInterviewPreps();
  return all.find((p) => p.applicationId === applicationId) ?? null;
}

/** Crée une fiche de préparation pour une candidature (checklist par défaut). */
export async function createInterviewPrep(
  applicationId: string,
  interviewDate = ""
): Promise<InterviewPrep> {
  const existing = await getInterviewPrepByApplication(applicationId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const prep: InterviewPrep = {
    id: crypto.randomUUID(),
    applicationId,
    interviewDate,
    format: "non_precis",
    companyResearch: "",
    strengths: "",
    weaknesses: "",
    questions: [],
    checklist: defaultChecklist(),
    selfRating: 0,
    postNotes: "",
    createdAt: now,
    updatedAt: now,
  };
  const validated = interviewPrepSchema.parse(prep);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    applicationId,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ applicationId }),
    updatedAt: now,
  });
  return validated;
}

export async function updateInterviewPrep(
  id: string,
  patch: Partial<Omit<InterviewPrep, "id" | "createdAt">>
): Promise<InterviewPrep> {
  const existing = await getInterviewPrep(id);
  if (!existing) throw new Error(`Fiche introuvable: ${id}`);
  const updated: InterviewPrep = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = interviewPrepSchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    applicationId: validated.applicationId,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ applicationId: validated.applicationId }),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

export async function deleteInterviewPrep(id: string): Promise<void> {
  await db.records.delete(id);
}

/** Bascule l'état done d'un item de checklist. */
export async function toggleChecklistItem(prepId: string, itemId: string): Promise<InterviewPrep> {
  const prep = await getInterviewPrep(prepId);
  if (!prep) throw new Error(`Fiche introuvable: ${prepId}`);
  const checklist = prep.checklist.map((item) =>
    item.id === itemId ? { ...item, done: !item.done } : item
  );
  return updateInterviewPrep(prepId, { checklist });
}

/** Progression de la checklist (0-100). */
export function checklistProgress(prep: InterviewPrep): number {
  if (prep.checklist.length === 0) return 0;
  const done = prep.checklist.filter((i) => i.done).length;
  return Math.round((done / prep.checklist.length) * 100);
}

/** Progression des questions préparées (0-100). */
export function questionsProgress(prep: InterviewPrep): number {
  if (prep.questions.length === 0) return 0;
  const prepared = prep.questions.filter((q) => q.prepared).length;
  return Math.round((prepared / prep.questions.length) * 100);
}
