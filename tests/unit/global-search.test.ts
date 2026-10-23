/**
 * Velora — tests de la recherche globale locale.
 *
 * Vérifie le scoring de pertinence, la recherche dans chaque collection,
 * le tri par score, la limite de résultats, et la recherche dans les pages.
 */
import { describe, it, expect } from "vitest";
import { globalSearch, scoreMatch, type SearchableData } from "@/lib/search/global-search";
import type { Application } from "@/lib/schema/application";
import type { Document } from "@/lib/schema/document";
import type { CalendarEvent } from "@/lib/schema/calendar";
import type { Goal } from "@/lib/schema/goal";
import type { JournalEntry } from "@/lib/schema/journal";
import type { InterviewPrep } from "@/lib/schema/interview";

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: crypto.randomUUID(),
    company: "Atelier Nova",
    position: "Développeur front-end",
    type: "cdi",
    offerUrl: "",
    location: "Paris",
    remote: true,
    salary: "45-55k€",
    appliedAt: "",
    deadline: "",
    source: "LinkedIn",
    contactName: "Marie Dupont",
    contactEmail: "marie@ateliernova.fr",
    contactPhone: "",
    status: "entretien",
    priority: "normale",
    notes: "Entretien technique prévu",
    tags: ["react", "front-end"],
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: crypto.randomUUID(),
    name: "cv-2026.pdf",
    type: "cv",
    mimeType: "application/pdf",
    sizeBytes: 150000,
    tags: ["cv", "2026"],
    versionCount: 1,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "Entretien Atelier Nova",
    type: "entretien",
    startAt: "2026-12-01T10:00:00.000Z",
    endAt: "",
    allDay: false,
    notes: "Préparer le portfolio",
    notified: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: crypto.randomUUID(),
    title: "10 candidatures en novembre",
    description: "Objectif du mois",
    metric: "applications_sent",
    target: 10,
    period: "month",
    startAt: "2026-11-01T00:00:00.000Z",
    endAt: "",
    completed: false,
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    date: "2026-11-15T12:00:00.000Z",
    title: "Bilan semaine 46",
    content: "Deux entretiens cette semaine, une relance envoyée.",
    mood: "bien",
    tags: ["bilan"],
    createdAt: "2026-11-15T12:00:00.000Z",
    updatedAt: "2026-11-15T12:00:00.000Z",
    ...overrides,
  };
}

function makePrep(appId: string, overrides: Partial<InterviewPrep> = {}): InterviewPrep {
  return {
    id: crypto.randomUUID(),
    applicationId: appId,
    interviewDate: "",
    format: "visio",
    companyResearch: "Studio innovant, 50 personnes",
    strengths: "React, TypeScript",
    weaknesses: "",
    questions: [],
    checklist: [],
    selfRating: 0,
    postNotes: "",
    createdAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeData(overrides: Partial<SearchableData> = {}): SearchableData {
  const app = makeApp();
  return {
    applications: [app],
    documents: [makeDoc()],
    events: [makeEvent()],
    goals: [makeGoal()],
    journalEntries: [makeJournal()],
    interviewPreps: [makePrep(app.id)],
    applicationsById: new Map([[app.id, app]]),
    ...overrides,
  };
}

describe("scoreMatch", () => {
  it("correspondance exacte = 100+", () => {
    expect(scoreMatch("atelier nova", "Atelier Nova")).toBeGreaterThanOrEqual(100);
  });

  it("correspondance en début de champ > sous-chaîne", () => {
    const startScore = scoreMatch("atelier", "Atelier Nova");
    const midScore = scoreMatch("nova", "Atelier Nova");
    expect(startScore).toBeGreaterThan(midScore);
  });

  it("insensible à la casse et aux accents", () => {
    expect(scoreMatch("developpeur", "Développeur front-end")).toBeGreaterThan(0);
    expect(scoreMatch("paris", "Paris")).toBeGreaterThan(0);
  });

  it("retourne 0 si aucune correspondance", () => {
    expect(scoreMatch("xyz", "Atelier Nova")).toBe(0);
  });

  it("retourne 0 sur requête vide", () => {
    expect(scoreMatch("", "Atelier Nova")).toBe(0);
    expect(scoreMatch("   ", "Atelier Nova")).toBe(0);
  });
});

describe("globalSearch", () => {
  it("retourne vide sur requête vide", () => {
    expect(globalSearch(makeData(), "")).toEqual([]);
    expect(globalSearch(makeData(), "   ")).toEqual([]);
  });

  it("trouve une candidature par entreprise", () => {
    const results = globalSearch(makeData(), "atelier nova");
    const appResult = results.find((r) => r.type === "application");
    expect(appResult).toBeTruthy();
    expect(appResult!.href).toBe("/candidatures");
  });

  it("trouve une candidature par tag", () => {
    const results = globalSearch(makeData(), "react");
    expect(results.some((r) => r.type === "application")).toBe(true);
  });

  it("trouve un document par nom", () => {
    const results = globalSearch(makeData(), "cv-2026");
    const docResult = results.find((r) => r.type === "document");
    expect(docResult).toBeTruthy();
    expect(docResult!.href).toBe("/documents");
  });

  it("trouve un événement", () => {
    const results = globalSearch(makeData(), "entretien atelier");
    expect(results.some((r) => r.type === "event")).toBe(true);
  });

  it("trouve un objectif", () => {
    const results = globalSearch(makeData(), "10 candidatures");
    expect(results.some((r) => r.type === "goal")).toBe(true);
  });

  it("trouve une entrée de journal", () => {
    const results = globalSearch(makeData(), "bilan semaine");
    expect(results.some((r) => r.type === "journal")).toBe(true);
  });

  it("trouve une fiche d'entretien via la candidature liée", () => {
    const results = globalSearch(makeData(), "atelier nova");
    expect(results.some((r) => r.type === "interview")).toBe(true);
  });

  it("trouve une page statique", () => {
    const results = globalSearch(makeData(), "calendrier");
    const pageResult = results.find((r) => r.type === "page" && r.href === "/calendrier");
    expect(pageResult).toBeTruthy();
  });

  it("trie par score décroissant", () => {
    const results = globalSearch(makeData(), "atelier");
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    }
  });

  it("respecte la limite de résultats", () => {
    const data = makeData({
      applications: Array.from({ length: 30 }, (_, i) =>
        makeApp({ id: `app-${i}`, company: `Entreprise ${i}`, position: `Poste ${i}` })
      ),
    });
    data.applicationsById = new Map(data.applications.map((a) => [a.id, a]));
    const results = globalSearch(data, "entreprise", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("retourne des résultats avec entityId pour les entités", () => {
    const data = makeData();
    const results = globalSearch(data, "atelier nova");
    const appResult = results.find((r) => r.type === "application");
    expect(appResult!.entityId).toBe(data.applications[0]!.id);
  });

  it("recherche dans plusieurs collections simultanément", () => {
    const results = globalSearch(makeData(), "atelier");
    const types = new Set(results.map((r) => r.type));
    expect(types.size).toBeGreaterThan(1);
  });
});
