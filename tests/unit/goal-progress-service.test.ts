/**
 * Velora — tests du service de suivi de progression des objectifs.
 *
 * Vérifie le calcul des métriques, les plages de périodes (semaine, mois,
 * trimestre, custom) et le calcul de progression.
 */
import { describe, it, expect } from "vitest";
import {
  computeMetricValue,
  computeGoalProgress,
  computeAllGoalProgress,
  getGoalPeriodRange,
} from "@/lib/vault/goal-progress-service";
import type { Application } from "@/lib/schema/application";
import type { Goal } from "@/lib/schema/goal";

const NOW = new Date("2026-11-15T12:00:00.000Z"); // un dimanche

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
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: crypto.randomUUID(),
    title: "Objectif test",
    description: "",
    metric: "applications_created",
    target: 10,
    period: "month",
    startAt: NOW.toISOString(),
    endAt: "",
    completed: false,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("goal-progress-service", () => {
  describe("getGoalPeriodRange", () => {
    it("semaine : lundi → dimanche", () => {
      const { start, end } = getGoalPeriodRange(makeGoal({ period: "week" }), NOW);
      expect(start.getDay()).toBe(1); // lundi
      expect(end.getDay()).toBe(0); // dimanche
      expect(start.getDate()).toBe(9); // 9 nov 2026
      expect(end.getDate()).toBe(15); // 15 nov 2026
    });

    it("mois : 1er → dernier jour", () => {
      const { start, end } = getGoalPeriodRange(makeGoal({ period: "month" }), NOW);
      expect(start.getDate()).toBe(1);
      expect(start.getMonth()).toBe(10); // novembre
      expect(end.getDate()).toBe(30); // 30 nov
      expect(end.getMonth()).toBe(10);
    });

    it("trimestre : octobre → décembre (T4)", () => {
      const { start, end } = getGoalPeriodRange(makeGoal({ period: "quarter" }), NOW);
      expect(start.getMonth()).toBe(9); // octobre (T4)
      expect(end.getMonth()).toBe(11); // décembre
      expect(end.getDate()).toBe(31);
    });

    it("custom : startAt → endAt de l'objectif", () => {
      const goal = makeGoal({
        period: "custom",
        startAt: "2026-01-01T00:00:00.000Z",
        endAt: "2026-03-31T23:59:59.000Z",
      });
      const { start, end } = getGoalPeriodRange(goal, NOW);
      expect(start.toISOString()).toContain("2026-01-01");
      expect(end.toISOString()).toContain("2026-03-31");
    });
  });

  describe("computeMetricValue", () => {
    const periodStart = new Date("2026-11-01T00:00:00.000Z");
    const periodEnd = new Date("2026-11-30T23:59:59.000Z");

    it("applications_created : compte les créations dans la période", () => {
      const apps = [
        makeApp({ createdAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ createdAt: "2026-11-10T10:00:00.000Z" }),
        makeApp({ createdAt: "2026-10-15T10:00:00.000Z" }), // hors période
      ];
      expect(computeMetricValue("applications_created", apps, periodStart, periodEnd)).toBe(2);
    });

    it("applications_sent : compte les statuts envoyés+", () => {
      const apps = [
        makeApp({ status: "envoyee", updatedAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ status: "entretien", updatedAt: "2026-11-06T10:00:00.000Z" }),
        makeApp({ status: "acceptee", updatedAt: "2026-11-07T10:00:00.000Z" }),
        makeApp({ status: "brouillon", updatedAt: "2026-11-05T10:00:00.000Z" }), // non compté
        makeApp({ status: "refusee", updatedAt: "2026-11-08T10:00:00.000Z" }),
      ];
      expect(computeMetricValue("applications_sent", apps, periodStart, periodEnd)).toBe(4);
    });

    it("interviews : compte entretien/offre/acceptee", () => {
      const apps = [
        makeApp({ status: "entretien", updatedAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ status: "offre_recue", updatedAt: "2026-11-06T10:00:00.000Z" }),
        makeApp({ status: "acceptee", updatedAt: "2026-11-07T10:00:00.000Z" }),
        makeApp({ status: "envoyee", updatedAt: "2026-11-05T10:00:00.000Z" }), // non compté
        makeApp({ status: "refusee", updatedAt: "2026-11-08T10:00:00.000Z" }), // non compté
      ];
      expect(computeMetricValue("interviews", apps, periodStart, periodEnd)).toBe(3);
    });

    it("responses : compte entretien/offre/acceptee/refusee", () => {
      const apps = [
        makeApp({ status: "refusee", updatedAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ status: "entretien", updatedAt: "2026-11-06T10:00:00.000Z" }),
        makeApp({ status: "envoyee", updatedAt: "2026-11-05T10:00:00.000Z" }), // non compté
      ];
      expect(computeMetricValue("responses", apps, periodStart, periodEnd)).toBe(2);
    });
  });

  describe("computeGoalProgress", () => {
    it("calcule le pourcentage et completed", () => {
      const goal = makeGoal({ metric: "applications_created", target: 4, period: "month" });
      const apps = [
        makeApp({ createdAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ createdAt: "2026-11-06T10:00:00.000Z" }),
      ];
      const progress = computeGoalProgress(goal, apps, NOW);
      expect(progress.current).toBe(2);
      expect(progress.target).toBe(4);
      expect(progress.percent).toBe(50);
      expect(progress.completed).toBe(false);
    });

    it("marque completed quand current >= target", () => {
      const goal = makeGoal({ metric: "applications_created", target: 2, period: "month" });
      const apps = [
        makeApp({ createdAt: "2026-11-05T10:00:00.000Z" }),
        makeApp({ createdAt: "2026-11-06T10:00:00.000Z" }),
        makeApp({ createdAt: "2026-11-07T10:00:00.000Z" }), // dépassement
      ];
      const progress = computeGoalProgress(goal, apps, NOW);
      expect(progress.current).toBe(3);
      expect(progress.completed).toBe(true);
      expect(progress.percent).toBe(100); // plafonné
    });

    it("calcule les jours restants", () => {
      const goal = makeGoal({ period: "month" });
      const progress = computeGoalProgress(goal, [], NOW); // 15 nov 12h → 30 nov 23h59
      // ~15.5 jours → arrondi supérieur = 16
      expect(progress.daysRemaining).toBe(16);
    });

    it("daysRemaining = null si la période est passée", () => {
      const goal = makeGoal({
        period: "custom",
        startAt: "2026-10-01T00:00:00.000Z",
        endAt: "2026-10-31T23:59:59.000Z",
      });
      const progress = computeGoalProgress(goal, [], NOW); // NOW = 15 nov
      expect(progress.daysRemaining).toBeNull();
    });
  });

  describe("computeAllGoalProgress", () => {
    it("calcule la progression de tous les objectifs", () => {
      const goals = [
        makeGoal({ id: crypto.randomUUID(), title: "A", target: 2 }),
        makeGoal({ id: crypto.randomUUID(), title: "B", target: 5 }),
      ];
      const apps = [makeApp({ createdAt: "2026-11-05T10:00:00.000Z" })];
      const results = computeAllGoalProgress(goals, apps, NOW);
      expect(results).toHaveLength(2);
      expect(results[0]!.current).toBe(1);
      expect(results[1]!.current).toBe(1);
    });
  });
});
