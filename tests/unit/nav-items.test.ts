/**
 * Tests — nav-items : structure des groupes de navigation partagés.
 *
 * Vérifie que :
 * - Les 3 groupes attendus sont présents (Mon espace, Ma carrière, Mon coffre-fort)
 * - Chaque groupe a au moins 1 item
 * - Tous les hrefs sont uniques (pas de doublon)
 * - Tous les hrefs commencent par "/"
 * - Tous les items ont un label non vide et une icône
 * - Les pages critiques sont présentes (paramètres, sécurité, sauvegardes)
 */
import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "@/components/layout/nav-items";

describe("NAV_GROUPS — structure de navigation", () => {
  it("contient exactement 3 groupes", () => {
    expect(NAV_GROUPS).toHaveLength(3);
  });

  it("les 3 groupes ont les bons titres", () => {
    const titles = NAV_GROUPS.map((g) => g.title);
    expect(titles).toEqual(["Mon espace", "Ma carrière", "Mon coffre-fort"]);
  });

  it("chaque groupe a au moins 1 item", () => {
    for (const group of NAV_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("tous les hrefs sont uniques (pas de doublon)", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const unique = new Set(hrefs);
    expect(unique.size).toBe(hrefs.length);
  });

  it("tous les hrefs commencent par /", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("tous les items ont un label non vide", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("tous les items ont une icône définie", () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.icon).toBeDefined();
      }
    }
  });

  it("les pages critiques sont présentes (paramètres, sécurité, sauvegardes)", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/parametres");
    expect(hrefs).toContain("/securite");
    expect(hrefs).toContain("/sauvegardes");
  });

  it("toutes les pages principales sont présentes", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    const expected = [
      "/",
      "/candidatures",
      "/calendrier",
      "/documents",
      "/journal",
      "/offres",
      "/ia",
      "/entretien",
      "/analyses",
      "/objectifs",
      "/securite",
      "/sauvegardes",
      "/parametres",
    ];
    for (const href of expected) {
      expect(hrefs).toContain(href);
    }
  });

  it("total de 13 items répartis en 5 + 5 + 3", () => {
    expect(NAV_GROUPS[0]!.items).toHaveLength(5); // Mon espace
    expect(NAV_GROUPS[1]!.items).toHaveLength(5); // Ma carrière
    expect(NAV_GROUPS[2]!.items).toHaveLength(3); // Mon coffre-fort
  });
});
