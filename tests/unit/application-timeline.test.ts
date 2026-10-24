/**
 * Tests unitaires — ApplicationTimeline : construction de la chronologie.
 */
import { describe, it, expect } from "vitest";
import { buildTimeline } from "@/components/applications/application-timeline";
import type { Application } from "@/lib/schema/application";
import type { CalendarEvent } from "@/lib/schema/calendar";
import type { Document } from "@/lib/schema/document";
import type { JournalEntry } from "@/lib/schema/journal";

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    company: "Test Corp",
    position: "Dev",
    type: "cdi",
    offerUrl: "",
    location: "Paris",
    remote: false,
    salary: "",
    appliedAt: "",
    deadline: "",
    source: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "brouillon",
    priority: "normale",
    notes: "",
    tags: [],
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "Entretien",
    type: "entretien",
    startAt: "2026-01-10T14:00:00.000Z",
    endAt: "",
    allDay: false,
    applicationId: "app-1",
    notes: "",
    notified: false,
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: crypto.randomUUID(),
    name: "CV.pdf",
    type: "cv",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    tags: [],
    applicationId: "app-1",
    versionCount: 1,
    createdAt: "2026-01-03T10:00:00.000Z",
    updatedAt: "2026-01-03T10:00:00.000Z",
    ...overrides,
  };
}

function makeJournal(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    date: "2026-01-08T10:00:00.000Z",
    title: "Bilan",
    content: "Bonne semaine",
    mood: "bien",
    tags: [],
    applicationId: "app-1",
    createdAt: "2026-01-08T10:00:00.000Z",
    updatedAt: "2026-01-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildTimeline", () => {
  it("inclut toujours l'événement de création", () => {
    const app = makeApp();
    const items = buildTimeline(app, [], [], []);
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe("created");
    expect(items[0]!.title).toBe("Candidature créée");
  });

  it("inclut l'envoi si appliedAt est défini", () => {
    const app = makeApp({ appliedAt: "2026-01-05T10:00:00.000Z" });
    const items = buildTimeline(app, [], [], []);
    const applied = items.find((i) => i.id === "app-1-applied");
    expect(applied).toBeDefined();
    expect(applied?.type).toBe("status_change");
    expect(applied?.status).toBe("envoyee");
  });

  it("n'inclut pas l'envoi si appliedAt est vide", () => {
    const app = makeApp({ appliedAt: "" });
    const items = buildTimeline(app, [], [], []);
    expect(items.find((i) => i.id === "app-1-applied")).toBeUndefined();
  });

  it("inclut le statut actuel si différent de brouillon", () => {
    const app = makeApp({ status: "entretien", updatedAt: "2026-01-10T10:00:00.000Z" });
    const items = buildTimeline(app, [], [], []);
    const statusItem = items.find((i) => i.id === "app-1-status");
    expect(statusItem).toBeDefined();
    expect(statusItem?.status).toBe("entretien");
  });

  it("n'inclut pas le statut si brouillon", () => {
    const app = makeApp({ status: "brouillon" });
    const items = buildTimeline(app, [], [], []);
    expect(items.find((i) => i.id === "app-1-status")).toBeUndefined();
  });

  it("inclut la dernière modification si différente de la création", () => {
    const app = makeApp({
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-10T10:00:00.000Z",
    });
    const items = buildTimeline(app, [], [], []);
    expect(items.find((i) => i.type === "updated")).toBeDefined();
  });

  it("n'inclut pas la modification si identique à la création", () => {
    const app = makeApp({
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });
    const items = buildTimeline(app, [], [], []);
    expect(items.find((i) => i.type === "updated")).toBeUndefined();
  });

  it("inclut les événements liés à la candidature", () => {
    const app = makeApp();
    const event = makeEvent({ title: "Entretien technique" });
    const items = buildTimeline(app, [event], [], []);
    const eventItem = items.find((i) => i.type === "event");
    expect(eventItem).toBeDefined();
    expect(eventItem?.title).toBe("Entretien technique");
  });

  it("ignore les événements d'autres candidatures", () => {
    const app = makeApp();
    const event = makeEvent({ applicationId: "autre-app" });
    const items = buildTimeline(app, [event], [], []);
    expect(items.find((i) => i.type === "event")).toBeUndefined();
  });

  it("inclut les documents liés", () => {
    const app = makeApp();
    const doc = makeDoc({ name: "Lettre.pdf" });
    const items = buildTimeline(app, [], [doc], []);
    const docItem = items.find((i) => i.type === "document");
    expect(docItem).toBeDefined();
    expect(docItem?.title).toContain("Lettre.pdf");
  });

  it("inclut les entrées de journal liées", () => {
    const app = makeApp();
    const entry = makeJournal({ title: "Bilan hebdo" });
    const items = buildTimeline(app, [], [], [entry]);
    const journalItem = items.find((i) => i.type === "journal");
    expect(journalItem).toBeDefined();
    expect(journalItem?.title).toContain("Bilan hebdo");
  });

  it("trie les items par date décroissante (plus récent d'abord)", () => {
    const app = makeApp({
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      status: "envoyee",
      appliedAt: "2026-01-05T10:00:00.000Z",
    });
    const event = makeEvent({ startAt: "2026-01-10T14:00:00.000Z" });
    const items = buildTimeline(app, [event], [], []);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1]!.date >= items[i]!.date).toBe(true);
    }
  });

  it("scénario complet avec tous les types d'items", () => {
    const app = makeApp({
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      status: "entretien",
      appliedAt: "2026-01-05T10:00:00.000Z",
    });
    const event = makeEvent({ startAt: "2026-01-20T14:00:00.000Z" });
    const doc = makeDoc({ createdAt: "2026-01-03T10:00:00.000Z" });
    const journal = makeJournal({ date: "2026-01-12T10:00:00.000Z" });
    const items = buildTimeline(app, [event], [doc], [journal]);

    const types = items.map((i) => i.type);
    expect(types).toContain("created");
    expect(types).toContain("status_change"); // appliedAt + status
    expect(types).toContain("updated");
    expect(types).toContain("event");
    expect(types).toContain("document");
    expect(types).toContain("journal");
    // Au moins 6 items (création + envoi + statut + modif + event + doc + journal = 7)
    expect(items.length).toBeGreaterThanOrEqual(6);
  });
});
