/**
 * Tests — pipelineBreakdown (extrait de pipeline-chart.tsx).
 *
 * Vérifie que la répartition par statut fonctionne correctement
 * avec les données réelles (pas seulement les données démo).
 */
import { describe, expect, it } from "vitest";
import { pipelineBreakdown } from "@/components/dashboard/pipeline-chart";
import type { Application } from "@/lib/schema/application";

function makeApp(status: Application["status"]): Application {
  return {
    id: crypto.randomUUID(),
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
    status,
    priority: "normale",
    notes: "",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("pipelineBreakdown", () => {
  it("retourne un tableau vide pour aucune candidature", () => {
    expect(pipelineBreakdown([])).toEqual([]);
  });

  it("ne retourne que les statuts présents", () => {
    const apps = [makeApp("envoyee"), makeApp("envoyee"), makeApp("entretien")];
    const result = pipelineBreakdown(apps);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.status === "envoyee")?.count).toBe(2);
    expect(result.find((r) => r.status === "entretien")?.count).toBe(1);
  });

  it("compte correctement chaque statut", () => {
    const apps = [
      makeApp("brouillon"),
      makeApp("a_envoyer"),
      makeApp("envoyee"),
      makeApp("en_attente"),
      makeApp("entretien"),
      makeApp("offre_recue"),
      makeApp("acceptee"),
      makeApp("refusee"),
      makeApp("abandonnee"),
    ];
    const result = pipelineBreakdown(apps);
    expect(result).toHaveLength(9);
    for (const r of result) {
      expect(r.count).toBe(1);
    }
  });

  it("ordre des statuts respecte le pipeline (brouillon → abandonnee)", () => {
    const apps = [makeApp("acceptee"), makeApp("brouillon"), makeApp("envoyee")];
    const result = pipelineBreakdown(apps);
    const statuses = result.map((r) => r.status);
    expect(statuses).toEqual(["brouillon", "envoyee", "acceptee"]);
  });
});
