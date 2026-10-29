/**
 * Velora — dépôt des objectifs (Goal) et des préférences (VaultSettings).
 *
 * Toutes les opérations passent par le chiffrement AES-256-GCM.
 * Les données en clair n'existent qu'en mémoire après déverrouillage.
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import { goalSchema, vaultSettingsSchema, type Goal, type VaultSettings } from "@/lib/schema/goal";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const GOALS_COLLECTION = "goals";
const SETTINGS_COLLECTION = "settings";
const SETTINGS_ID = "default";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

// ---------------------------------------------------------------------------
// Objectifs
// ---------------------------------------------------------------------------

export async function listGoals(): Promise<Goal[]> {
  const rows = await db.records.where("collection").equals(GOALS_COLLECTION).toArray();
  const goals: Goal[] = [];
  for (const row of rows) {
    try {
      const record = parseRecord(row.payload);
      const data = await decryptRecord<unknown>(record);
      const parsed = goalSchema.safeParse(data);
      if (parsed.success) goals.push(parsed.data);
    } catch {
      console.error(`[goals] Objectif illisible: ${row.id}`);
    }
  }
  return goals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getGoal(id: string): Promise<Goal | null> {
  const row = await db.records.get(id);
  if (!row || row.collection !== GOALS_COLLECTION) return null;
  try {
    const record = parseRecord(row.payload);
    const data = await decryptRecord<unknown>(record);
    const parsed = goalSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createGoal(
  input: Omit<Goal, "id" | "completed" | "createdAt" | "updatedAt">
): Promise<Goal> {
  const now = new Date().toISOString();
  const goal: Goal = {
    ...input,
    id: crypto.randomUUID(),
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
  const validated = goalSchema.parse(goal);
  const record = await encryptRecord(validated, {
    collection: GOALS_COLLECTION,
    id: validated.id,
    metric: validated.metric,
  });
  await db.records.put({
    id: validated.id,
    collection: GOALS_COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ metric: validated.metric, target: validated.target }),
    updatedAt: now,
  });
  return validated;
}

export async function updateGoal(
  id: string,
  patch: Partial<Omit<Goal, "id" | "createdAt">>
): Promise<Goal> {
  const existing = await getGoal(id);
  if (!existing) throw new Error(`Objectif introuvable: ${id}`);
  const updated: Goal = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = goalSchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: GOALS_COLLECTION,
    id: validated.id,
    metric: validated.metric,
  });
  await db.records.put({
    id: validated.id,
    collection: GOALS_COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ metric: validated.metric, target: validated.target }),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

export async function deleteGoal(id: string): Promise<void> {
  await db.records.delete(id);
}

// ---------------------------------------------------------------------------
// Préférences (VaultSettings) — singleton
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<VaultSettings> {
  const row = await db.records.get(SETTINGS_ID);
  if (!row || row.collection !== SETTINGS_COLLECTION) {
    // Valeurs par défaut (non persistées tant que l'utilisateur ne sauvegarde pas)
    return {
      id: "default",
      firstName: "",
      autoLockMs: 15 * 60 * 1000,
      theme: "dark",
      notificationsEnabled: true,
      onboardingCompleted: false,
      demoMode: false,
      aiConsent: false,
      aiProvider: "local",
      aiApiKey: "",
      aiModel: "",
      syncEnabled: false,
      syncEndpoint: "",
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const record = parseRecord(row.payload);
    const data = await decryptRecord<unknown>(record);
    const parsed = vaultSettingsSchema.safeParse(data);
    return parsed.success
      ? parsed.data
      : {
          id: "default",
          firstName: "",
          autoLockMs: 15 * 60 * 1000,
          theme: "dark",
          notificationsEnabled: true,
          onboardingCompleted: false,
          demoMode: false,
          aiConsent: false,
          aiProvider: "local",
          aiApiKey: "",
          aiModel: "",
          syncEnabled: false,
          syncEndpoint: "",
          updatedAt: new Date().toISOString(),
        };
  } catch {
    return {
      id: "default",
      firstName: "",
      autoLockMs: 15 * 60 * 1000,
      theme: "dark",
      notificationsEnabled: true,
      onboardingCompleted: false,
      demoMode: false,
      aiConsent: false,
      aiProvider: "local",
      aiApiKey: "",
      aiModel: "",
      syncEnabled: false,
      syncEndpoint: "",
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function saveSettings(
  patch: Partial<Omit<VaultSettings, "id" | "updatedAt">>
): Promise<VaultSettings> {
  const current = await getSettings();
  const updated: VaultSettings = {
    ...current,
    ...patch,
    id: "default",
    updatedAt: new Date().toISOString(),
  };
  const validated = vaultSettingsSchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: SETTINGS_COLLECTION,
    id: SETTINGS_ID,
  });
  await db.records.put({
    id: SETTINGS_ID,
    collection: SETTINGS_COLLECTION,
    payload: JSON.stringify(record),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

// ---------------------------------------------------------------------------
// Suppression complète du coffre (danger zone)
// ---------------------------------------------------------------------------

/**
 * Efface TOUTES les données de l'application (vault, records, documents).
 * IRRÉVERSIBLE. À utiliser uniquement depuis la page Paramètres avec
 * confirmation explicite. La phrase secrète reste requise pour recréer
 * un nouveau coffre ensuite.
 */
export async function wipeAllData(): Promise<void> {
  await db.vault.clear();
  await db.records.clear();
  await db.documents.clear();
}
