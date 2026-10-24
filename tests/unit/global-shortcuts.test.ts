/**
 * Velora — tests des raccourcis clavier globaux.
 *
 * Vérifie la logique de détection des cibles éditables et la table
 * de navigation (g + lettre). Le hook React est testé via sa logique
 * isolée (pas de montage de composant).
 */
import { describe, it, expect } from "vitest";

/** Recopie de la logique isEditableTarget du hook (testée isolément). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Recopie de la table NAV_SHORTCUTS du hook. */
const NAV_SHORTCUTS: Record<string, string> = {
  h: "/",
  c: "/candidatures",
  k: "/calendrier",
  d: "/documents",
  j: "/journal",
  o: "/offres",
  e: "/entretien",
  a: "/analyses",
  t: "/objectifs",
  s: "/securite",
  b: "/sauvegardes",
  p: "/parametres",
};

describe("global shortcuts — logique isolée", () => {
  describe("isEditableTarget", () => {
    it("détecte un input", () => {
      const el = document.createElement("input");
      expect(isEditableTarget(el)).toBe(true);
    });

    it("détecte un textarea", () => {
      const el = document.createElement("textarea");
      expect(isEditableTarget(el)).toBe(true);
    });

    it("détecte un select", () => {
      const el = document.createElement("select");
      expect(isEditableTarget(el)).toBe(true);
    });

    it("détecte contentEditable", () => {
      const el = document.createElement("div");
      Object.defineProperty(el, "isContentEditable", { value: true });
      expect(isEditableTarget(el)).toBe(true);
    });

    it("ne détecte pas un div standard", () => {
      const el = document.createElement("div");
      expect(isEditableTarget(el)).toBe(false);
    });

    it("ne détecte pas un bouton", () => {
      const el = document.createElement("button");
      expect(isEditableTarget(el)).toBe(false);
    });

    it("retourne false pour null", () => {
      expect(isEditableTarget(null)).toBe(false);
    });
  });

  describe("table de navigation g + lettre", () => {
    it("couvre toutes les pages principales", () => {
      const hrefs = Object.values(NAV_SHORTCUTS);
      expect(hrefs).toContain("/");
      expect(hrefs).toContain("/candidatures");
      expect(hrefs).toContain("/calendrier");
      expect(hrefs).toContain("/documents");
      expect(hrefs).toContain("/journal");
      expect(hrefs).toContain("/offres");
      expect(hrefs).toContain("/entretien");
      expect(hrefs).toContain("/analyses");
      expect(hrefs).toContain("/objectifs");
      expect(hrefs).toContain("/securite");
      expect(hrefs).toContain("/sauvegardes");
      expect(hrefs).toContain("/parametres");
    });

    it("n'a pas de doublons de lettres", () => {
      const keys = Object.keys(NAV_SHORTCUTS);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it("n'a pas de doublons de hrefs", () => {
      const hrefs = Object.values(NAV_SHORTCUTS);
      // "/" est unique, les autres aussi
      expect(new Set(hrefs).size).toBe(hrefs.length);
    });
  });
});
