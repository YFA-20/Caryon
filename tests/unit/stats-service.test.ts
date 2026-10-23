/**
 * Velora — tests du service de statistiques (calcul local).
 *
 * Vérifie les KPIs, les taux, le délai moyen de réponse,
 * la répartition par statut/source/type et les événements à venir.
 */
import { describe, it, expect } from "vitest";
import { computeStats } from "@/lib/vault/stats-service";
import type { Application } from "@/lib/schema/application";
import type { CalendarEvent } from "@/lib/schema/calendar";

function makeApp(overrides: Partial<Application> = {}): Application {
  return {
    id: crypto.randomUUID(),
    company: "Acme",
    position: "Dev",
    type: "cdi",
    offerUrl: "",
    location: "Paris",
    remote: false,
    salary: "",
    appliedAt: "",
    deadline: "",
    source: "LinkedIn",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "brouillon",
    priority: "normale",
    notes: "",
    tags: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "Entretien",
    type: "entretien",
    startAt: new Date(Date.now() + 86400000).toISOString(),
    endAt: "",
    allDay: false,
    notes: "",
    notified: false,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("stats-service", () => {
  it("retourne des zéros sur données vides", () => {
    const stats = computeStats([], []);
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.responseRate).toBe(0);
    expect(stats.interviewRate).toBe(0);
    expect(stats.avgResponseDays).toBeNull();
    expect(stats.applicationsPerWeek).toEqual([]);
    expect(stats.upcomingInterviews).toBe(0);
  });

  it("compte le total et les actives", () => {
    const apps = [
      makeApp({ status: "envoyee" }),
      makeApp({ status: "entretien" }),
      makeApp({ status: "acceptee" }),
      makeApp({ status: "refusee" }),
      makeApp({ status: "brouillon" }),
    ];
    const stats = computeStats(apps, []);
    expect(stats.total).toBe(5);
    // Actives = envoyee, en_attente, entretien, offre_recue
    expect(stats.active).toBe(2);
  });

  it("calcule le taux de réponse (dénominateur = envoyées)", () => {
    const apps = [
      makeApp({ status: "envoyee" }),
      makeApp({ status: "envoyee" }),
      makeApp({ status: "entretien" }),
      makeApp({ status: "refusee" }),
      makeApp({ status: "brouillon" }), // non envoyée : hors dénominateur
    ];
    const stats = computeStats(apps, []);
    // envoyées = 4 (2 envoyee + entretien + refusee), répondues = 2
    expect(stats.responseRate).toBe(50);
  });

  it("calcule le taux d'entretien", () => {
    const apps = [
      makeApp({ status: "envoyee" }),
      makeApp({ status: "entretien" }),
      makeApp({ status: "acceptee" }),
      makeApp({ status: "refusee" }),
    ];
    const stats = computeStats(apps, []);
    // envoyées = 4, entretiens+ = 2 (entretien + acceptee)
    expect(stats.interviewRate).toBe(50);
  });

  it("calcule le délai moyen de réponse en jours", () => {
    const apps = [
      makeApp({
        status: "entretien",
        appliedAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-11T10:00:00.000Z", // 10 jours
      }),
      makeApp({
        status: "refusee",
        appliedAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-21T10:00:00.000Z", // 20 jours
      }),
    ];
    const stats = computeStats(apps, []);
    expect(stats.avgResponseDays).toBe(15);
  });

  it("regroupe par source avec « Non renseigné »", () => {
    const apps = [
      makeApp({ source: "LinkedIn" }),
      makeApp({ source: "LinkedIn" }),
      makeApp({ source: "" }),
    ];
    const stats = computeStats(apps, []);
    expect(stats.bySource["LinkedIn"]).toBe(2);
    expect(stats.bySource["Non renseigné"]).toBe(1);
  });

  it("regroupe par type", () => {
    const apps = [makeApp({ type: "cdi" }), makeApp({ type: "stage" }), makeApp({ type: "stage" })];
    const stats = computeStats(apps, []);
    expect(stats.byType["cdi"]).toBe(1);
    expect(stats.byType["stage"]).toBe(2);
  });

  it("compte les événements à venir par catégorie", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    const past = new Date(Date.now() - 86400000).toISOString();
    const events = [
      makeEvent({ type: "entretien", startAt: future }),
      makeEvent({ type: "entretien", startAt: past }), // passé : ignoré
      makeEvent({ type: "echeance", startAt: future }),
      makeEvent({ type: "relance", startAt: future }),
    ];
    const stats = computeStats([], events);
    expect(stats.upcomingInterviews).toBe(1);
    expect(stats.upcomingDeadlines).toBe(1);
    expect(stats.remindersDue).toBe(1);
  });

  it("limite applicationsPerWeek aux 8 dernières semaines", () => {
    const apps: Application[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date("2026-01-05T10:00:00.000Z");
      d.setDate(d.getDate() + i * 7); // 12 semaines espacées
      apps.push(makeApp({ createdAt: d.toISOString() }));
    }
    const stats = computeStats(apps, []);
    expect(stats.applicationsPerWeek.length).toBeLessThanOrEqual(8);
    const totalCount = stats.applicationsPerWeek.reduce((s, w) => s + w.count, 0);
    expect(totalCount).toBe(8);
  });
});
