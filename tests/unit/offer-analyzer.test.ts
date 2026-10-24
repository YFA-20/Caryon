/**
 * Tests unitaires — offer-analyzer (Phase 2, Lot 7).
 *
 * Vérifie :
 * - analysisToPrefill : conversion analyse → données de pré-remplissage
 * - Validation des types et catégories
 * - Gestion des cas limites (champs vides, type invalide)
 */
import { describe, it, expect } from "vitest";
import { analysisToPrefill, type OfferAnalysis } from "@/lib/ai/offer-analyzer";

function makeAnalysis(overrides: Partial<OfferAnalysis> = {}): OfferAnalysis {
  return {
    poste: "Développeur React",
    entreprise: "Acme Corp",
    type: "cdi",
    localisation: "Paris, hybride",
    teletravail: true,
    salaire: "45-55k€",
    competencesRequises: ["React", "TypeScript", "Node.js"],
    competencesSouhaitees: ["GraphQL", "AWS"],
    avantages: ["Tickets resto", "Mutuelle", "RTT"],
    niveauExperience: "3-5 ans",
    descriptionCourte: "Startup en croissance, équipe de 10 devs.",
    motsCles: ["react", "typescript", "startup"],
    ...overrides,
  };
}

describe("analysisToPrefill", () => {
  it("convertit une analyse complète en données de pré-remplissage", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.company).toBe("Acme Corp");
    expect(prefill.position).toBe("Développeur React");
    expect(prefill.type).toBe("cdi");
    expect(prefill.location).toBe("Paris, hybride");
    expect(prefill.remote).toBe(true);
    expect(prefill.salary).toBe("45-55k€");
    expect(prefill.source).toBe("Analyse IA");
  });

  it("inclut les compétences requises dans les notes", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.notes).toContain("Compétences requises : React, TypeScript, Node.js");
  });

  it("inclut les compétences souhaitées dans les notes", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.notes).toContain("Compétences souhaitées : GraphQL, AWS");
  });

  it("inclut les avantages dans les notes", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.notes).toContain("Avantages : Tickets resto, Mutuelle, RTT");
  });

  it("inclut le niveau d'expérience dans les notes", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.notes).toContain("Niveau d'expérience : 3-5 ans");
  });

  it("inclut la description courte dans les notes", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    expect(prefill.notes).toContain("Startup en croissance, équipe de 10 devs.");
  });

  it("gère une analyse avec type vide", () => {
    const prefill = analysisToPrefill(makeAnalysis({ type: "" }));
    expect(prefill.type).toBeUndefined();
  });

  it("gère une analyse avec tous les tableaux vides", () => {
    const prefill = analysisToPrefill(
      makeAnalysis({
        competencesRequises: [],
        competencesSouhaitees: [],
        avantages: [],
        niveauExperience: "",
        descriptionCourte: "",
      })
    );
    expect(prefill.notes).toBe("");
  });

  it("gère une analyse minimale (seulement poste + entreprise)", () => {
    const prefill = analysisToPrefill(
      makeAnalysis({
        poste: "Stage Dev",
        entreprise: "Startup",
        type: "stage",
        localisation: "",
        teletravail: false,
        salaire: "",
        competencesRequises: [],
        competencesSouhaitees: [],
        avantages: [],
        niveauExperience: "",
        descriptionCourte: "",
        motsCles: [],
      })
    );
    expect(prefill.company).toBe("Startup");
    expect(prefill.position).toBe("Stage Dev");
    expect(prefill.type).toBe("stage");
    expect(prefill.location).toBe("");
    expect(prefill.remote).toBe(false);
    expect(prefill.notes).toBe("");
  });

  it("sépare les sections de notes par des lignes vides", () => {
    const prefill = analysisToPrefill(makeAnalysis());
    // Les sections sont séparées par \n\n
    const sections = prefill.notes.split("\n\n");
    expect(sections.length).toBeGreaterThanOrEqual(4);
  });
});
