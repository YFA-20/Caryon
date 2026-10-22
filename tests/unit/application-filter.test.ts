/**
 * Velora — tests du filtrage/recherche des candidatures.
 *
 * La logique de filtrage est extraite et testée isolément :
 * - Recherche texte (entreprise, poste, lieu, contact, notes, tags)
 * - Filtre par statut
 * - Combinaison des deux
 */
import { describe, it, expect } from "vitest";
import type { Application, ApplicationStatus } from "@/lib/schema/application";

function makeApp(overrides: Partial<Application>): Application {
  return {
    id: crypto.randomUUID(),
    company: "Atelier Nova",
    position: "Développeur front-end",
    type: "cdi",
    offerUrl: "",
    location: "Paris",
    remote: true,
    salary: "45-55k€",
    appliedAt: "",
    deadline: "",
    source: "LinkedIn",
    contactName: "Marie Dupont",
    contactEmail: "marie@ateliernova.fr",
    contactPhone: "",
    status: "envoyee",
    priority: "normale",
    notes: "Premier entretien téléphonique",
    tags: ["react", "front-end"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Logique de filtrage (identique à celle de la page candidatures).
 * Extraite ici pour être testable sans rendu React.
 */
function filterApplications(
  applications: Application[],
  search: string,
  statusFilter: ApplicationStatus | "all"
): Application[] {
  const q = search.trim().toLowerCase();
  return applications.filter((app) => {
    if (statusFilter !== "all" && app.status !== statusFilter) return false;
    if (!q) return true;
    const haystack = [
      app.company,
      app.position,
      app.location,
      app.source,
      app.contactName,
      app.contactEmail,
      app.notes,
      app.salary,
      ...app.tags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

const APPS: Application[] = [
  makeApp({
    company: "Atelier Nova",
    position: "Développeur front-end",
    status: "envoyee",
    contactEmail: "contact@ateliernova.fr",
    tags: ["#react", "#typescript"],
  }),
  makeApp({
    company: "Studio Lumen",
    position: "Designer UI",
    status: "entretien",
    location: "Lyon",
    contactEmail: "hello@studiolumen.fr",
    tags: ["#figma", "#ui"],
  }),
  makeApp({
    company: "Cabinet Aster",
    position: "Juriste",
    status: "brouillon",
    remote: false,
    contactEmail: "contact@cabinet-aster.fr",
    tags: ["#droit"],
  }),
  makeApp({
    company: "TechCorp",
    position: "DevOps",
    status: "refusee",
    notes: "Refus après entretien technique",
    contactEmail: "jobs@techcorp.io",
    tags: ["#kubernetes", "#aws"],
  }),
];

describe("filtrage des candidatures", () => {
  it("retourne tout sans filtre", () => {
    expect(filterApplications(APPS, "", "all")).toHaveLength(4);
  });

  it("filtre par entreprise (insensible à la casse)", () => {
    const result = filterApplications(APPS, "atelier nova", "all");
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Atelier Nova");
  });

  it("filtre par poste", () => {
    const result = filterApplications(APPS, "designer", "all");
    expect(result).toHaveLength(1);
    expect(result[0]!.position).toBe("Designer UI");
  });

  it("filtre par localisation", () => {
    const result = filterApplications(APPS, "lyon", "all");
    expect(result).toHaveLength(1);
    expect(result[0]!.location).toBe("Lyon");
  });

  it("filtre par note", () => {
    const result = filterApplications(APPS, "entretien technique", "all");
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("TechCorp");
  });

  it("filtre par tag", () => {
    const result = filterApplications(APPS, "#kubernetes", "all");
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("TechCorp");
  });

  it("filtre par statut", () => {
    const result = filterApplications(APPS, "", "entretien");
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("entretien");
  });

  it("combine recherche + statut", () => {
    // "a" apparaît dans plusieurs, mais seul Studio Lumen est en entretien
    const result = filterApplications(APPS, "studio", "entretien");
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Studio Lumen");
  });

  it("recherche + statut sans correspondance retourne vide", () => {
    const result = filterApplications(APPS, "atelier nova", "refusee");
    expect(result).toHaveLength(0);
  });

  it("recherche avec espaces est trimmée", () => {
    const result = filterApplications(APPS, "  atelier nova  ", "all");
    expect(result).toHaveLength(1);
  });

  it("aucun résultat pour une recherche inexistante", () => {
    expect(filterApplications(APPS, "zzzzz", "all")).toHaveLength(0);
  });
});
