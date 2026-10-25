/**
 * Tests de régression — mode démo + persistance (Bug #6 du rapport).
 *
 * Scénarios couverts :
 * 1. Modifier une candidature fictive → sauvegarder → relire → la modification persiste
 * 2. Quitter la démo → réactiver → pas de doublons
 * 3. Sortie de démo préserve les vraies données créées pendant la démo
 * 4. Les données démo (documents, événements, objectifs, journal) sont présentes
 *    après seedDemoData et supprimées par clearDemoData
 * 5. Persistance UI (sessionStorage) — restauration des préférences candidatures
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createVault, unlockVault, lock } from "@/lib/vault/vault-service";
import {
  seedDemoData,
  clearDemoData,
  hasExistingData,
  DEMO_TAG,
} from "@/lib/vault/demo-data-service";
import {
  listApplications,
  createApplication,
  updateApplication,
  getApplication,
} from "@/lib/vault/application-repository";
import { listEvents } from "@/lib/vault/calendar-repository";
import { listDocuments } from "@/lib/vault/document-repository";
import { listGoals, getSettings, saveSettings } from "@/lib/vault/goal-repository";
import { listJournalEntries } from "@/lib/vault/journal-repository";
import { db } from "@/lib/db/database";
import {
  persistUiState,
  restoreUiState,
  clearUiState,
  CANDIDATURES_VIEW_KEY,
  CANDIDATURES_SEARCH_KEY,
  CANDIDATURES_STATUS_FILTER_KEY,
  CANDIDATURES_SORT_KEY,
  CANDIDATURES_TABLE_FILTERS_KEY,
} from "@/lib/utils/ui-persistence";
import type { SortState, TableFilters } from "@/components/applications/applications-table";

const PASSPHRASE = "test-demo-regression-passphrase-456!";

async function resetVault() {
  await db.vault.clear();
  await db.records.clear();
  await db.documents.clear();
  await createVault(PASSPHRASE);
  await unlockVault(PASSPHRASE);
}

describe("Régression mode démo — persistance des modifications (Bug #6)", () => {
  beforeAll(async () => {
    await createVault(PASSPHRASE);
  });

  beforeEach(async () => {
    await resetVault();
  });

  it("modifier une candidature fictive → la modification persiste après relecture", async () => {
    // 1. Seed les données démo
    await seedDemoData();
    const apps = await listApplications();
    expect(apps.length).toBeGreaterThanOrEqual(5);

    // 2. Prendre la première candidature démo et la modifier
    const target = apps[0]!;
    const newNotes = "Modification de test — persistée après F5 simulé";
    await updateApplication(target.id, { notes: newNotes, status: "entretien" });

    // 3. Relire depuis le coffre (simule un rechargement)
    const reloaded = await getApplication(target.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.notes).toBe(newNotes);
    expect(reloaded!.status).toBe("entretien");
    // Le tag démo doit être préservé
    expect(reloaded!.tags).toContain(DEMO_TAG);
  });

  it("les modifications sur une candidature démo survivent à un verrouillage/déverrouillage", async () => {
    await seedDemoData();
    const apps = await listApplications();
    const target = apps[0]!;

    // Modifier
    await updateApplication(target.id, { salary: "99999€ test" });

    // Simuler verrouillage + déverrouillage (F5)
    lock();
    await unlockVault(PASSPHRASE);

    // Relire
    const reloaded = await getApplication(target.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.salary).toBe("99999€ test");
  });

  it("quitter puis réactiver la démo ne crée pas de doublons", async () => {
    // 1. Activer la démo
    const r1 = await seedDemoData();
    await saveSettings({ demoMode: true });

    const appsAfterFirst = await listApplications();
    expect(appsAfterFirst.length).toBe(r1.applications);

    // 2. Quitter la démo
    await clearDemoData();
    await saveSettings({ demoMode: false });

    const appsAfterClear = await listApplications();
    expect(appsAfterClear.length).toBe(0);

    // 3. Réactiver la démo
    const r2 = await seedDemoData();
    await saveSettings({ demoMode: true });

    const appsAfterSecond = await listApplications();
    // Pas de doublons : exactement le même nombre que la première activation
    expect(appsAfterSecond.length).toBe(r2.applications);
    expect(appsAfterSecond.length).toBe(r1.applications);

    // Vérifier qu'il n'y a pas d'IDs en double
    const ids = appsAfterSecond.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("la sortie de démo préserve les vraies données créées pendant la démo", async () => {
    // 1. Activer la démo
    await seedDemoData();
    await saveSettings({ demoMode: true });

    const demoAppsBefore = await listApplications();
    expect(demoAppsBefore.length).toBeGreaterThanOrEqual(5);

    // 2. Créer une VRAIE candidature pendant que la démo est active
    const realApp = await createApplication({
      company: "Ma vraie entreprise (créée pendant la démo)",
      position: "Développeur senior",
      type: "cdi",
      status: "envoyee",
      location: "Lyon",
      remote: true,
      salary: "55k€",
      source: "Recommandation",
      contactName: "Jean Dupont",
      contactEmail: "jean@entreprise.fr",
      notes: "Candidature réelle créée en mode démo",
      priority: "haute",
      tags: ["real", "important"],
    });

    // 3. Vérifier que hasExistingData retourne true (vraie donnée présente)
    const hasReal = await hasExistingData();
    expect(hasReal).toBe(true);

    // 4. Quitter la démo
    const cleanup = await clearDemoData();
    await saveSettings({ demoMode: false });

    // 5. Les données démo sont supprimées
    expect(cleanup.applications).toBeGreaterThanOrEqual(5);

    // 6. La vraie candidature est préservée
    const appsAfter = await listApplications();
    expect(appsAfter.length).toBe(1);
    expect(appsAfter[0]!.id).toBe(realApp.id);
    expect(appsAfter[0]!.company).toBe("Ma vraie entreprise (créée pendant la démo)");
    expect(appsAfter[0]!.tags).not.toContain(DEMO_TAG);
  });

  it("les données démo couvrent toutes les collections (documents, événements, objectifs, journal)", async () => {
    const result = await seedDemoData();

    // Vérifier les compteurs du résultat
    expect(result.applications).toBe(8);
    expect(result.documents).toBe(3);
    expect(result.events).toBe(6);

    // Vérifier via les repositories
    const apps = await listApplications();
    const docs = await listDocuments();
    const events = await listEvents();
    const goals = await listGoals();
    const journal = await listJournalEntries();

    expect(apps.length).toBe(8);
    expect(docs.length).toBe(3);
    expect(events.length).toBe(6);
    expect(goals.length).toBeGreaterThanOrEqual(2);
    expect(journal.length).toBeGreaterThanOrEqual(3);
  });

  it("après clearDemoData, toutes les collections démo sont vides", async () => {
    await seedDemoData();

    const cleanup = await clearDemoData();

    const apps = await listApplications();
    const docs = await listDocuments();
    const events = await listEvents();
    const goals = await listGoals();
    const journal = await listJournalEntries();

    expect(apps.length).toBe(0);
    expect(docs.length).toBe(0);
    expect(events.length).toBe(0);
    expect(goals.length).toBe(0);
    expect(journal.length).toBe(0);

    // Les compteurs de cleanup doivent correspondre
    expect(cleanup.applications).toBe(8);
    expect(cleanup.documents).toBe(3);
    expect(cleanup.events).toBe(6);
  });

  it("le paramètre demoMode persiste dans les settings chiffrés", async () => {
    // Activer
    await saveSettings({ demoMode: true });
    let settings = await getSettings();
    expect(settings.demoMode).toBe(true);

    // Simuler F5 : relire depuis le coffre
    lock();
    await unlockVault(PASSPHRASE);
    settings = await getSettings();
    expect(settings.demoMode).toBe(true);

    // Désactiver
    await saveSettings({ demoMode: false });
    settings = await getSettings();
    expect(settings.demoMode).toBe(false);
  });
});

describe("Persistance UI — sessionStorage (Bug #2)", () => {
  beforeEach(() => {
    // Nettoyer sessionStorage avant chaque test
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.clear();
    }
  });

  it("persistUiState + restoreUiState — round-trip pour la vue", () => {
    persistUiState(CANDIDATURES_VIEW_KEY, "table");
    expect(restoreUiState(CANDIDATURES_VIEW_KEY, "kanban")).toBe("table");
  });

  it("restoreUiState retourne le fallback si rien n'est stocké", () => {
    expect(restoreUiState(CANDIDATURES_VIEW_KEY, "kanban")).toBe("kanban");
  });

  it("persistUiState + restoreUiState — round-trip pour la recherche", () => {
    persistUiState(CANDIDATURES_SEARCH_KEY, "atelier nova");
    expect(restoreUiState(CANDIDATURES_SEARCH_KEY, "")).toBe("atelier nova");
  });

  it("persistUiState + restoreUiState — round-trip pour le filtre statut", () => {
    persistUiState(CANDIDATURES_STATUS_FILTER_KEY, "entretien");
    expect(restoreUiState(CANDIDATURES_STATUS_FILTER_KEY, "all")).toBe("entretien");
  });

  it("persistUiState + restoreUiState — round-trip pour le tri", () => {
    const sort: SortState = { column: "company", direction: "asc" };
    persistUiState(CANDIDATURES_SORT_KEY, sort);
    expect(
      restoreUiState(CANDIDATURES_SORT_KEY, { column: "updatedAt", direction: "desc" })
    ).toEqual(sort);
  });

  it("persistUiState + restoreUiState — round-trip pour les filtres tableau", () => {
    const filters: TableFilters = {
      search: "test",
      status: "envoyee",
      type: "cdi",
      source: "LinkedIn",
      dateFrom: "2025-01-01",
      dateTo: "2025-12-31",
    };
    persistUiState(CANDIDATURES_TABLE_FILTERS_KEY, filters);
    expect(
      restoreUiState(CANDIDATURES_TABLE_FILTERS_KEY, {
        search: "",
        status: "all" as const,
        type: "all" as const,
        source: "",
        dateFrom: "",
        dateTo: "",
      })
    ).toEqual(filters);
  });

  it("clearUiState supprime la valeur stockée", () => {
    persistUiState(CANDIDATURES_VIEW_KEY, "list");
    clearUiState(CANDIDATURES_VIEW_KEY);
    expect(restoreUiState(CANDIDATURES_VIEW_KEY, "kanban")).toBe("kanban");
  });

  it("restoreUiState retourne le fallback si le JSON est corrompu", () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("velora:ui:test-corrupt", "{invalid json");
    }
    expect(restoreUiState("test-corrupt", "fallback")).toBe("fallback");
  });

  it("les clés sont préfixées velora:ui: (pas de collision)", () => {
    persistUiState("mykey", "myvalue");
    if (typeof window !== "undefined") {
      expect(window.sessionStorage.getItem("velora:ui:mykey")).toBe('"myvalue"');
      // La clé sans préfixe ne doit pas exister
      expect(window.sessionStorage.getItem("mykey")).toBeNull();
    }
  });
});

describe("Source de vérité unique — vaultStore (Bug #3)", () => {
  it("le store UI n'a plus de vaultUnlocked (dead code supprimé)", async () => {
    const { useUiStore } = await import("@/store/ui-store");
    const state = useUiStore.getState();
    // vaultUnlocked ne doit plus exister dans le state
    expect("vaultUnlocked" in state).toBe(false);
    expect("setVaultUnlocked" in state).toBe(false);
    // demoMode doit toujours exister
    expect(typeof state.demoMode).toBe("boolean");
    expect(typeof state.setDemoMode).toBe("function");
  });
});
