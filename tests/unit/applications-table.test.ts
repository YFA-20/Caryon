/**
 * Tests unitaires — ApplicationsTable : filtres combinés, tri, extraction sources.
 */
import { describe, it, expect } from "vitest";
import {
  applyTableFilters,
  applyTableSort,
  extractSources,
  type SortState,
  type TableFilters,
} from "@/components/applications/applications-table";
import type { Application } from "@/lib/schema/application";

function makeApp(overrides: Partial<Application>): Application {
  return {
    id: crypto.randomUUID(),
    company: "Entreprise Test",
    position: "Développeur",
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
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

const FIXTURE: Application[] = [
  makeApp({
    company: "Alpha Corp",
    position: "Dev Front",
    type: "cdi",
    status: "envoyee",
    source: "LinkedIn",
    createdAt: "2026-01-10T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
  }),
  makeApp({
    company: "Beta SARL",
    position: "Stage Dev",
    type: "stage",
    status: "entretien",
    source: "Indeed",
    location: "Lyon",
    createdAt: "2026-02-01T10:00:00.000Z",
    updatedAt: "2026-02-05T10:00:00.000Z",
  }),
  makeApp({
    company: "Gamma SA",
    position: "Alternance Data",
    type: "alternance",
    status: "refusee",
    source: "LinkedIn",
    location: "Bordeaux",
    createdAt: "2026-01-20T10:00:00.000Z",
    updatedAt: "2026-01-25T10:00:00.000Z",
  }),
  makeApp({
    company: "Delta EURL",
    position: "Freelance Mobile",
    type: "freelance",
    status: "brouillon",
    source: "Malt",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  }),
];

const EMPTY_FILTERS: TableFilters = {
  search: "",
  status: "all",
  type: "all",
  source: "",
  dateFrom: "",
  dateTo: "",
};

describe("extractSources", () => {
  it("extrait les sources uniques triées", () => {
    const sources = extractSources(FIXTURE);
    expect(sources).toEqual(["Indeed", "LinkedIn", "Malt"]);
  });

  it("ignore les sources vides", () => {
    const apps = [makeApp({ source: "" }), makeApp({ source: "Apec" })];
    expect(extractSources(apps)).toEqual(["Apec"]);
  });

  it("retourne un tableau vide si aucune source", () => {
    const apps = [makeApp({ source: "" })];
    expect(extractSources(apps)).toEqual([]);
  });
});

describe("applyTableFilters", () => {
  it("retourne tout sans filtre", () => {
    expect(applyTableFilters(FIXTURE, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("filtre par statut", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, status: "entretien" });
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Beta SARL");
  });

  it("filtre par type", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, type: "cdi" });
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Alpha Corp");
  });

  it("filtre par source", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, source: "LinkedIn" });
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.company)).toEqual(["Alpha Corp", "Gamma SA"]);
  });

  it("filtre par recherche texte (entreprise)", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, search: "beta" });
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Beta SARL");
  });

  it("filtre par recherche texte (poste)", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, search: "mobile" });
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Delta EURL");
  });

  it("filtre par plage de dates (création)", () => {
    const result = applyTableFilters(FIXTURE, {
      ...EMPTY_FILTERS,
      dateFrom: "2026-01-15",
      dateTo: "2026-02-15",
    });
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.company)).toEqual(["Beta SARL", "Gamma SA"]);
  });

  it("combine plusieurs filtres", () => {
    const result = applyTableFilters(FIXTURE, {
      ...EMPTY_FILTERS,
      type: "cdi",
      source: "LinkedIn",
      search: "alpha",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.company).toBe("Alpha Corp");
  });

  it("retourne vide si aucun match", () => {
    const result = applyTableFilters(FIXTURE, { ...EMPTY_FILTERS, search: "zzzzz" });
    expect(result).toHaveLength(0);
  });
});

describe("applyTableSort", () => {
  it("trie par entreprise ascendant", () => {
    const sort: SortState = { column: "company", direction: "asc" };
    const result = applyTableSort(FIXTURE, sort);
    expect(result.map((a) => a.company)).toEqual([
      "Alpha Corp",
      "Beta SARL",
      "Delta EURL",
      "Gamma SA",
    ]);
  });

  it("trie par entreprise descendant", () => {
    const sort: SortState = { column: "company", direction: "desc" };
    const result = applyTableSort(FIXTURE, sort);
    expect(result.map((a) => a.company)).toEqual([
      "Gamma SA",
      "Delta EURL",
      "Beta SARL",
      "Alpha Corp",
    ]);
  });

  it("trie par date de création ascendante", () => {
    const sort: SortState = { column: "createdAt", direction: "asc" };
    const result = applyTableSort(FIXTURE, sort);
    expect(result[0]!.company).toBe("Alpha Corp"); // 2026-01-10
    expect(result[3]!.company).toBe("Delta EURL"); // 2026-03-01
  });

  it("trie par date de modification descendante", () => {
    const sort: SortState = { column: "updatedAt", direction: "desc" };
    const result = applyTableSort(FIXTURE, sort);
    expect(result[0]!.company).toBe("Delta EURL"); // 2026-03-01
  });

  it("trie par statut (alphabétique)", () => {
    const sort: SortState = { column: "status", direction: "asc" };
    const result = applyTableSort(FIXTURE, sort);
    // brouillon < entretien < envoyee < refusee (ordre alphabétique des clés)
    expect(result[0]!.status).toBe("brouillon");
    expect(result[3]!.status).toBe("refusee");
  });

  it("ne modifie pas le tableau original", () => {
    const original = [...FIXTURE];
    const sort: SortState = { column: "company", direction: "asc" };
    applyTableSort(FIXTURE, sort);
    expect(FIXTURE.map((a) => a.company)).toEqual(original.map((a) => a.company));
  });

  it("tri secondaire par entreprise quand égalité", () => {
    const apps = [
      makeApp({ company: "Zeta", position: "Dev", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeApp({ company: "Alpha", position: "Dev", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const sort: SortState = { column: "createdAt", direction: "asc" };
    const result = applyTableSort(apps, sort);
    expect(result[0]!.company).toBe("Alpha");
    expect(result[1]!.company).toBe("Zeta");
  });
});
