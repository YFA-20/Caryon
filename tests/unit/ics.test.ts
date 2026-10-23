/**
 * Velora — tests de l'export ICS (RFC 5545).
 *
 * Vérifie la structure du fichier, l'échappement, les événements
 * toute la journée vs horodatés, et les fins d'événement par défaut.
 */
import { describe, it, expect } from "vitest";
import { generateIcs } from "@/lib/utils/ics";
import type { CalendarEvent } from "@/lib/schema/calendar";

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Entretien Acme",
    type: "entretien",
    startAt: "2026-12-01T10:00:00.000Z",
    endAt: "2026-12-01T11:00:00.000Z",
    allDay: false,
    notes: "",
    notified: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ics export", () => {
  it("génère une structure VCALENDAR valide", () => {
    const ics = generateIcs([makeEvent()]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Velora//Calendrier//FR");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("utilise des fins de ligne CRLF (RFC 5545)", () => {
    const ics = generateIcs([makeEvent()]);
    expect(ics).toContain("\r\n");
    // Pas de LF isolé
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("génère un VEVENT avec UID, DTSTART, DTEND, SUMMARY", () => {
    const ev = makeEvent();
    const ics = generateIcs([ev]);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(`UID:${ev.id}@velora`);
    expect(ics).toContain("DTSTART:20261201T100000Z");
    expect(ics).toContain("DTEND:20261201T110000Z");
    expect(ics).toContain("SUMMARY:Entretien Acme");
    expect(ics).toContain("CATEGORIES:entretien");
    expect(ics).toContain("END:VEVENT");
  });

  it("échappe les caractères spéciaux dans le résumé", () => {
    const ics = generateIcs([makeEvent({ title: "Entretien, Acme; Paris\n2e étage" })]);
    expect(ics).toContain("SUMMARY:Entretien\\, Acme\\; Paris\\n2e étage");
  });

  it("gère les événements toute la journée (VALUE=DATE)", () => {
    const ics = generateIcs([
      makeEvent({
        allDay: true,
        startAt: "2026-12-01T00:00:00.000Z",
        endAt: "",
      }),
    ]);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261201");
    // Sans endAt en allDay : fin = lendemain
    expect(ics).toContain("DTEND;VALUE=DATE:20261202");
  });

  it("génère une fin par défaut (+1h) si endAt est absent", () => {
    const ics = generateIcs([makeEvent({ endAt: "" })]);
    expect(ics).toContain("DTSTART:20261201T100000Z");
    expect(ics).toContain("DTEND:20261201T110000Z");
  });

  it("inclut la description si notes est renseigné", () => {
    const ics = generateIcs([makeEvent({ notes: "Apporter le CV" })]);
    expect(ics).toContain("DESCRIPTION:Apporter le CV");
  });

  it("supporte plusieurs événements", () => {
    const ics = generateIcs([
      makeEvent({ id: "550e8400-e29b-41d4-a716-446655440001", title: "A" }),
      makeEvent({ id: "550e8400-e29b-41d4-a716-446655440002", title: "B" }),
    ]);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("SUMMARY:A");
    expect(ics).toContain("SUMMARY:B");
  });
});
