/**
 * Velora — tests du dépôt des événements calendrier (chiffrés).
 *
 * Vérifie le CRUD, le filtrage par plage de dates, les événements à venir,
 * et le comptage par type.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventsInRange,
  listUpcomingEvents,
  countEventsByType,
} from "@/lib/vault/calendar-repository";
import type { CalendarEvent } from "@/lib/schema/calendar";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

function makeInput(overrides: Partial<CalendarEvent> = {}) {
  return {
    title: "Entretien Acme",
    type: "entretien" as const,
    startAt: "2026-12-01T10:00:00.000Z",
    endAt: "2026-12-01T11:00:00.000Z",
    allDay: false,
    notes: "Préparer le portfolio",
    ...overrides,
  };
}

describe("calendar-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("crée et liste un événement", async () => {
    const ev = await createEvent(makeInput());
    expect(ev.id).toBeTruthy();
    expect(ev.notified).toBe(false);

    const list = await listEvents();
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe("Entretien Acme");
  });

  it("récupère un événement par id", async () => {
    const ev = await createEvent(makeInput());
    const found = await getEvent(ev.id);
    expect(found).toBeTruthy();
    expect(found!.notes).toBe("Préparer le portfolio");
  });

  it("met à jour un événement", async () => {
    const ev = await createEvent(makeInput());
    const updated = await updateEvent(ev.id, { title: "Entretien Acme (reporté)" });
    expect(updated.title).toBe("Entretien Acme (reporté)");
    expect(updated.id).toBe(ev.id);
    expect(updated.createdAt).toBe(ev.createdAt);
    expect(updated.updatedAt >= ev.updatedAt).toBe(true);
  });

  it("supprime un événement", async () => {
    const ev = await createEvent(makeInput());
    await deleteEvent(ev.id);
    expect(await getEvent(ev.id)).toBeNull();
    expect(await listEvents()).toHaveLength(0);
  });

  it("filtre les événements dans une plage de dates", async () => {
    await createEvent(makeInput({ title: "Dans la plage", startAt: "2026-12-10T09:00:00.000Z" }));
    await createEvent(makeInput({ title: "Hors plage", startAt: "2027-06-01T09:00:00.000Z" }));

    const inRange = await listEventsInRange("2026-12-01T00:00:00.000Z", "2026-12-31T23:59:59.000Z");
    expect(inRange).toHaveLength(1);
    expect(inRange[0]!.title).toBe("Dans la plage");
  });

  it("liste les événements à venir (limite)", async () => {
    const future1 = new Date(Date.now() + 86400000).toISOString();
    const future2 = new Date(Date.now() + 172800000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    await createEvent(makeInput({ title: "Futur 1", startAt: future1 }));
    await createEvent(makeInput({ title: "Futur 2", startAt: future2 }));
    await createEvent(makeInput({ title: "Passé", startAt: past }));

    const upcoming = await listUpcomingEvents(10);
    expect(upcoming).toHaveLength(2);
    expect(upcoming.map((e) => e.title).sort()).toEqual(["Futur 1", "Futur 2"]);
  });

  it("compte les événements par type", async () => {
    await createEvent(makeInput({ type: "entretien" }));
    await createEvent(makeInput({ type: "entretien" }));
    await createEvent(makeInput({ type: "relance" }));
    await createEvent(makeInput({ type: "echeance" }));

    const counts = await countEventsByType();
    expect(counts.entretien).toBe(2);
    expect(counts.relance).toBe(1);
    expect(counts.echeance).toBe(1);
    expect(counts.preparation).toBe(0);
    expect(counts.personnel).toBe(0);
  });

  it("ne stocke pas le titre en clair dans IndexedDB", async () => {
    await createEvent(makeInput({ title: "TITRE-SECRET-UNIQUE-XYZ" }));
    const rows = await db.records.toArray();
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("TITRE-SECRET-UNIQUE-XYZ");
  });
});
