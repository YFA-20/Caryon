/**
 * Velora — tests du service de relances intelligentes.
 *
 * Vérifie le calcul des jours, les seuils par type de contrat,
 * le filtrage des statuts, le tri et les priorités suggérées.
 */
import { describe, it, expect } from "vitest";
import {
  daysSince,
  getApplicationsNeedingFollowUp,
  countPendingApplications,
} from "@/lib/vault/followup-service";
import type { Application } from "@/lib/schema/application";

const NOW = new Date("2026-12-15T12:00:00.000Z");

function daysAgo(n: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

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
    appliedAt: daysAgo(20),
    deadline: "",
    source: "LinkedIn",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "envoyee",
    priority: "normale",
    notes: "",
    tags: [],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
    ...overrides,
  };
}

describe("followup-service", () => {
  describe("daysSince", () => {
    it("calcule les jours écoulés", () => {
      expect(daysSince("2026-12-01T12:00:00.000Z", NOW)).toBe(14);
    });

    it("ne retourne jamais un nombre négatif", () => {
      expect(daysSince("2026-12-20T12:00:00.000Z", NOW)).toBe(0);
    });

    it("arrondit à l'entier le plus proche", () => {
      expect(daysSince("2026-12-14T18:00:00.000Z", NOW)).toBe(1); // 18h = 0.75j → 1
    });
  });

  describe("getApplicationsNeedingFollowUp", () => {
    it("retourne vide sur données vides", () => {
      expect(getApplicationsNeedingFollowUp([], NOW)).toEqual([]);
    });

    it("ne relance pas une candidature trop récente (sous le seuil)", () => {
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(5), status: "envoyee" })];
      // Seuil CDI = 14 jours, 5 < 14 → pas de relance
      expect(getApplicationsNeedingFollowUp(apps, NOW)).toEqual([]);
    });

    it("relance une candidature au-delà du seuil", () => {
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(20), status: "envoyee" })];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result).toHaveLength(1);
      expect(result[0]!.daysSince).toBe(20);
      expect(result[0]!.thresholdDays).toBe(14);
    });

    it("applique des seuils différents selon le type de contrat", () => {
      // Freelance : seuil 7 jours
      const freelance = makeApp({ type: "freelance", appliedAt: daysAgo(10), status: "envoyee" });
      expect(getApplicationsNeedingFollowUp([freelance], NOW)).toHaveLength(1);

      // CDI : seuil 14 jours, 10 < 14 → pas de relance
      const cdi = makeApp({ type: "cdi", appliedAt: daysAgo(10), status: "envoyee" });
      expect(getApplicationsNeedingFollowUp([cdi], NOW)).toEqual([]);

      // Stage : seuil 10 jours, 10 >= 10 → relance
      const stage = makeApp({ type: "stage", appliedAt: daysAgo(10), status: "envoyee" });
      expect(getApplicationsNeedingFollowUp([stage], NOW)).toHaveLength(1);
    });

    it("ignore les candidatures sans date d'envoi", () => {
      const apps = [makeApp({ appliedAt: "", status: "envoyee" })];
      expect(getApplicationsNeedingFollowUp(apps, NOW)).toEqual([]);
    });

    it("ignore les candidatures déjà clôturées (entretien, refusée, acceptée…)", () => {
      const apps = [
        makeApp({ status: "entretien", appliedAt: daysAgo(30) }),
        makeApp({ status: "acceptee", appliedAt: daysAgo(30) }),
        makeApp({ status: "refusee", appliedAt: daysAgo(30) }),
        makeApp({ status: "brouillon", appliedAt: daysAgo(30) }),
        makeApp({ status: "a_envoyer", appliedAt: daysAgo(30) }),
      ];
      expect(getApplicationsNeedingFollowUp(apps, NOW)).toEqual([]);
    });

    it("inclut le statut « en attente »", () => {
      const apps = [makeApp({ status: "en_attente", appliedAt: daysAgo(20), type: "cdi" })];
      expect(getApplicationsNeedingFollowUp(apps, NOW)).toHaveLength(1);
    });

    it("trie par ancienneté décroissante (plus vieille d'abord)", () => {
      const apps = [
        makeApp({ company: "Recente", appliedAt: daysAgo(15), type: "cdi" }),
        makeApp({ company: "Ancienne", appliedAt: daysAgo(40), type: "cdi" }),
        makeApp({ company: "Moyenne", appliedAt: daysAgo(25), type: "cdi" }),
      ];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result.map((r) => r.application.company)).toEqual(["Ancienne", "Moyenne", "Recente"]);
    });

    it("suggère « haute » priorité si très en retard (> 2x le seuil)", () => {
      // Seuil CDI = 14, 30 jours = 16 jours de retard >= 14 → haute
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(30) })];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result[0]!.suggestedPriority).toBe("haute");
    });

    it("suggère « haute » priorité si la candidature est déjà prioritaire", () => {
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(15), priority: "haute" })];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result[0]!.suggestedPriority).toBe("haute");
    });

    it("suggère « basse » priorité si la candidature est en priorité basse", () => {
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(15), priority: "basse" })];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result[0]!.suggestedPriority).toBe("basse");
    });

    it("suggère « normale » par défaut", () => {
      const apps = [makeApp({ type: "cdi", appliedAt: daysAgo(15), priority: "normale" })];
      const result = getApplicationsNeedingFollowUp(apps, NOW);
      expect(result[0]!.suggestedPriority).toBe("normale");
    });
  });

  describe("countPendingApplications", () => {
    it("compte uniquement envoyée + en attente", () => {
      const apps = [
        makeApp({ status: "envoyee" }),
        makeApp({ status: "en_attente" }),
        makeApp({ status: "entretien" }),
        makeApp({ status: "brouillon" }),
        makeApp({ status: "refusee" }),
      ];
      expect(countPendingApplications(apps)).toBe(2);
    });
  });
});
