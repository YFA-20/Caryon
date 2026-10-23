/**
 * Velora — tests du parser d'offres (extraction 100% locale).
 *
 * Vérifie l'extraction de l'entreprise, du poste, du type, de la
 * localisation, du télétravail, du salaire et de la source, ainsi que
 * le nettoyage du texte et le comportement sur entrée vide.
 */
import { describe, it, expect } from "vitest";
import { parseOfferText } from "@/lib/utils/offer-parser";

const SAMPLE_OFFER = `
Développeur Full-Stack React/Node — Atelier Nova
Entreprise : Atelier Nova
Nous recherchons un développeur full-stack pour rejoindre notre équipe à Paris (75).
Type de contrat : CDI
Télétravail possible 3 jours par semaine.
Rémunération : 45 000 € – 55 000 € par an selon profil.
Vous serez en charge du développement front-end et back-end.
Profil recherché : développeur full-stack React/Node.js, 3 ans d'expérience.
Envoyez votre candidature à recrutement@ateliernova.fr
`;

describe("offer-parser", () => {
  it("extrait le poste depuis « Nous recherchons un… »", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.position).toContain("développeur");
    expect(result.detectedFields).toContain("poste");
  });

  it("extrait l'entreprise depuis « Entreprise : … »", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.company).toBe("Atelier Nova");
    expect(result.detectedFields).toContain("entreprise");
  });

  it("détecte le type CDI", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.type).toBe("cdi");
    expect(result.detectedFields).toContain("type");
  });

  it("détecte la localisation (Paris)", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.location).toContain("Paris");
    expect(result.detectedFields).toContain("localisation");
  });

  it("détecte le télétravail", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.remote).toBe(true);
    expect(result.detectedFields).toContain("télétravail");
  });

  it("extrait le salaire", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.salary).toContain("45");
    expect(result.salary).toContain("55");
    expect(result.detectedFields).toContain("salaire");
  });

  it("tronque l'extrait à 2000 caractères", () => {
    const longText = "A".repeat(5000);
    const result = parseOfferText(longText);
    expect(result.excerpt.length).toBeLessThanOrEqual(2001); // 2000 + …
    expect(result.excerpt.endsWith("…")).toBe(true);
  });

  it("nettoie les retours à la ligne multiples", () => {
    const result = parseOfferText("Ligne 1\n\n\n\n\nLigne 2");
    expect(result.excerpt).toBe("Ligne 1\n\nLigne 2");
  });

  it("détecte la source depuis l'URL (LinkedIn)", () => {
    const result = parseOfferText(SAMPLE_OFFER, "https://www.linkedin.com/jobs/view/123");
    expect(result.source).toBe("LinkedIn");
    expect(result.detectedFields).toContain("source");
  });

  it("détecte la source depuis l'URL (Welcome to the Jungle)", () => {
    const result = parseOfferText(
      SAMPLE_OFFER,
      "https://www.welcometothejungle.com/fr/companies/acme/jobs/dev"
    );
    expect(result.source).toBe("Welcome to the Jungle");
  });

  it("capitalise le domaine inconnu comme source", () => {
    const result = parseOfferText(SAMPLE_OFFER, "https://www.exemple-entreprise.fr/offre/1");
    expect(result.source).toBe("Exemple-entreprise");
  });

  it("retourne « Copié depuis une offre » sans URL", () => {
    const result = parseOfferText(SAMPLE_OFFER);
    expect(result.source).toBe("Copié depuis une offre");
  });

  it("gère une entrée vide sans erreur", () => {
    const result = parseOfferText("");
    expect(result.company).toBe("");
    expect(result.position).toBe("");
    expect(result.type).toBe("");
    expect(result.detectedFields).toEqual([]);
  });

  it("détecte un stage", () => {
    const text = "Stage de 6 mois — Développeur front-end chez Studio Lumen. Stage rémunéré.";
    const result = parseOfferText(text);
    expect(result.type).toBe("stage");
  });

  it("détecte une alternance", () => {
    const text =
      "Contrat d'alternance — Développeur web. Rythme : 3 semaines entreprise / 1 école.";
    const result = parseOfferText(text);
    expect(result.type).toBe("alternance");
  });

  it("détecte un freelance", () => {
    const text = "Mission freelance — Développeur React. 6 mois renouvelable. TJM à négocier.";
    const result = parseOfferText(text);
    expect(result.type).toBe("freelance");
  });

  it("ne détecte pas le télétravail si absent", () => {
    const result = parseOfferText("Poste sur site à Lyon. Pas de remote.");
    expect(result.remote).toBe(false);
  });

  it("détecte « Selon profil » pour le salaire", () => {
    const result = parseOfferText("Salaire selon profil et expérience.");
    expect(result.salary).toBe("Selon profil");
  });

  it("extrait une rémunération au format k€", () => {
    const result = parseOfferText("Rémunération : 50k€ - 65k€ annuel.");
    expect(result.salary).toContain("50");
    expect(result.salary).toContain("65");
  });
});
