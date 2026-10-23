/**
 * Velora — dépôt des événements calendrier (chiffrés).
 */
import { db } from "@/lib/db/database";
import { encryptRecord, decryptRecord } from "./vault-service";
import {
  calendarEventSchema,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/schema/calendar";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

const COLLECTION = "calendar-events";

function parseRecord(payload: string): EncryptedRecord {
  return JSON.parse(payload) as EncryptedRecord;
}

export async function listEvents(): Promise<CalendarEvent[]> {
  const rows = await db.records.where("collection").equals(COLLECTION).toArray();
  const events: CalendarEvent[] = [];
  for (const row of rows) {
    try {
      const record = parseRecord(row.payload);
      const data = await decryptRecord<unknown>(record);
      const parsed = calendarEventSchema.safeParse(data);
      if (parsed.success) events.push(parsed.data);
    } catch {
      console.error(`[calendar] Événement illisible: ${row.id}`);
    }
  }
  return events.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const row = await db.records.get(id);
  if (!row || row.collection !== COLLECTION) return null;
  try {
    const record = parseRecord(row.payload);
    const data = await decryptRecord<unknown>(record);
    const parsed = calendarEventSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function createEvent(
  input: Omit<CalendarEvent, "id" | "createdAt" | "updatedAt" | "notified">
): Promise<CalendarEvent> {
  const now = new Date().toISOString();
  const event: CalendarEvent = {
    ...input,
    id: crypto.randomUUID(),
    notified: false,
    createdAt: now,
    updatedAt: now,
  };
  const validated = calendarEventSchema.parse(event);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    type: validated.type,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ type: validated.type, startAt: validated.startAt }),
    updatedAt: now,
  });
  return validated;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<CalendarEvent, "id" | "createdAt">>
): Promise<CalendarEvent> {
  const existing = await getEvent(id);
  if (!existing) throw new Error(`Événement introuvable: ${id}`);
  const updated: CalendarEvent = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  const validated = calendarEventSchema.parse(updated);
  const record = await encryptRecord(validated, {
    collection: COLLECTION,
    id: validated.id,
    type: validated.type,
  });
  await db.records.put({
    id: validated.id,
    collection: COLLECTION,
    payload: JSON.stringify(record),
    meta: JSON.stringify({ type: validated.type, startAt: validated.startAt }),
    updatedAt: validated.updatedAt,
  });
  return validated;
}

export async function deleteEvent(id: string): Promise<void> {
  await db.records.delete(id);
}

/** Événements dans une plage de dates. */
export async function listEventsInRange(
  startIso: string,
  endIso: string
): Promise<CalendarEvent[]> {
  const all = await listEvents();
  return all.filter((e) => e.startAt >= startIso && e.startAt <= endIso);
}

/** Événements à venir (à partir de maintenant). */
export async function listUpcomingEvents(limit = 10): Promise<CalendarEvent[]> {
  const now = new Date().toISOString();
  const all = await listEvents();
  return all.filter((e) => e.startAt >= now).slice(0, limit);
}

/** Compte les événements par type. */
export async function countEventsByType(): Promise<Record<CalendarEventType, number>> {
  const events = await listEvents();
  const counts: Record<CalendarEventType, number> = {
    entretien: 0,
    relance: 0,
    echeance: 0,
    preparation: 0,
    personnel: 0,
  };
  for (const e of events) {
    counts[e.type]++;
  }
  return counts;
}
