import { describe, expect, it } from "vitest";
import {
  computeDemoStats,
  DEMO_APPLICATIONS,
  DEMO_FIRST_NAME,
  pipelineBreakdown,
} from "@/lib/demo/demo-data";
import { applicationSchema } from "@/lib/schema/application";

describe("données de démonstration", () => {
  it("le prénom de démo est défini", () => {
    expect(DEMO_FIRST_NAME.length).toBeGreaterThan(0);
  });

  it("toutes les candidatures de démo sont valides (schéma Zod)", () => {
    for (const app of DEMO_APPLICATIONS) {
      const parsed = applicationSchema.safeParse(app);
      expect(parsed.success, `candidature ${app.id} invalide`).toBe(true);
    }
  });

  it("les entreprises de démo sont clairement fictives", () => {
    for (const app of DEMO_APPLICATIONS) {
      expect(app.company.toLowerCase()).toContain("fictif");
    }
  });

  it("les emails de démo utilisent le TLD réservé .invalid", () => {
    for (const app of DEMO_APPLICATIONS) {
      if (app.contactEmail) {
        expect(app.contactEmail.endsWith(".invalid")).toBe(true);
      }
    }
  });

  it("computeDemoStats calcule correctement", () => {
    const stats = computeDemoStats(DEMO_APPLICATIONS);
    expect(stats.active).toBeGreaterThan(0);
    expect(stats.interviewsUpcoming).toBeGreaterThan(0);
    expect(stats.active + 1).toBe(DEMO_APPLICATIONS.length); // 1 brouillon
  });

  it("pipelineBreakdown ne retourne que les statuts présents", () => {
    const breakdown = pipelineBreakdown(DEMO_APPLICATIONS);
    expect(breakdown.every((b) => b.count > 0)).toBe(true);
    const total = breakdown.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(DEMO_APPLICATIONS.length);
  });
});
