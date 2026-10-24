/**
 * Tests unitaires — demo-data-service.
 *
 * Vérifie que seedDemoData crée bien des entités dans chaque collection
 * via les vrais repositories (chiffrés). Nécessite un coffre déverrouillé.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createVault, unlockVault } from "@/lib/vault/vault-service";
import {
  seedDemoData,
  hasExistingData,
  clearDemoData,
  DEMO_TAG,
  DEMO_GOAL_PREFIX,
  LEGACY_DEMO_TAG,
  DEMO_COMPANIES,
  isDemoApplication,
} from "@/lib/vault/demo-data-service";
import { listApplications, createApplication } from "@/lib/vault/application-repository";
import { createGoal, listGoals } from "@/lib/vault/goal-repository";
import { listEvents } from "@/lib/vault/calendar-repository";
import { listJournalEntries } from "@/lib/vault/journal-repository";
import { listDocuments } from "@/lib/vault/document-repository";
import { listInterviewPreps } from "@/lib/vault/interview-repository";
import { db } from "@/lib/db/database";

const PASSPHRASE = "test-demo-data-service-passphrase-123!";

describe("demo-data-service", () => {
  beforeAll(async () => {
    await createVault(PASSPHRASE);
  });

  beforeEach(async () => {
    await unlockVault(PASSPHRASE);
    // Nettoyer entre les tests
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
  });

  it("hasExistingData retourne false sur un coffre vide", async () => {
    const result = await hasExistingData();
    expect(result).toBe(false);
  });

  it("seedDemoData crée des données dans toutes les collections", async () => {
    const result = await seedDemoData();

    expect(result.applications).toBeGreaterThanOrEqual(5);
    expect(result.applications).toBeLessThanOrEqual(10);
    expect(result.documents).toBeGreaterThanOrEqual(2);
    expect(result.events).toBeGreaterThanOrEqual(3);
    expect(result.goals).toBeGreaterThanOrEqual(2);
    expect(result.journalEntries).toBeGreaterThanOrEqual(3);
    expect(result.interviewPreps).toBeGreaterThanOrEqual(1);
  });

  it("les candidatures créées sont bien chiffrées et lisibles", async () => {
    await seedDemoData();
    const apps = await listApplications();
    expect(apps.length).toBeGreaterThanOrEqual(5);

    // Vérifier que les données sont cohérentes
    for (const app of apps) {
      expect(app.company).toBeTruthy();
      expect(app.position).toBeTruthy();
      expect(app.id).toBeTruthy();
      expect(app.createdAt).toBeTruthy();
    }
  });

  it("les candidatures démo couvrent plusieurs statuts", async () => {
    await seedDemoData();
    const apps = await listApplications();
    const statuses = new Set(apps.map((a) => a.status));
    // Au moins 4 statuts différents dans le jeu de démo
    expect(statuses.size).toBeGreaterThanOrEqual(4);
  });

  it("les événements démo sont liés à des candidatures", async () => {
    await seedDemoData();
    const apps = await listApplications();
    const events = await listEvents();
    const appIds = new Set(apps.map((a) => a.id));

    const linkedEvents = events.filter((e) => e.applicationId && appIds.has(e.applicationId));
    expect(linkedEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("les documents démo sont créés avec du contenu chiffré", async () => {
    await seedDemoData();
    const docs = await listDocuments();
    expect(docs.length).toBeGreaterThanOrEqual(2);
    for (const doc of docs) {
      expect(doc.sizeBytes).toBeGreaterThan(0);
      expect(doc.mimeType).toBe("application/pdf");
    }
  });

  it("les objectifs démo ont des métriques valides", async () => {
    await seedDemoData();
    const goals = await listGoals();
    expect(goals.length).toBeGreaterThanOrEqual(2);
    for (const goal of goals) {
      expect(goal.target).toBeGreaterThan(0);
      expect(goal.completed).toBe(false);
    }
  });

  it("les entrées de journal démo ont du contenu", async () => {
    await seedDemoData();
    const entries = await listJournalEntries();
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const entry of entries) {
      expect(entry.title).toBeTruthy();
      expect(entry.content).toBeTruthy();
    }
  });

  it("hasExistingData retourne false après seedDemoData (données démo ignorées)", async () => {
    await seedDemoData();
    const result = await hasExistingData();
    expect(result).toBe(false); // Les données démo sont ignorées
  });

  it("seedDemoData peut être appelé deux fois (données s'accumulent)", async () => {
    const r1 = await seedDemoData();
    const r2 = await seedDemoData();
    const apps = await listApplications();
    expect(apps.length).toBe(r1.applications + r2.applications);
  });

  it("les fiches de préparation sont liées à des candidatures existantes", async () => {
    await seedDemoData();
    const preps = await listInterviewPreps();
    const apps = await listApplications();
    const appIds = new Set(apps.map((a) => a.id));

    expect(preps.length).toBeGreaterThanOrEqual(1);
    for (const prep of preps) {
      expect(appIds.has(prep.applicationId)).toBe(true);
      expect(prep.checklist.length).toBeGreaterThan(0);
    }
  });

  it("les candidatures démo ont le tag DEMO_TAG", async () => {
    await seedDemoData();
    const apps = await listApplications();
    for (const app of apps) {
      expect(app.tags).toContain(DEMO_TAG);
    }
  });

  it("les objectifs démo ont le préfixe [DÉMO]", async () => {
    await seedDemoData();
    const goals = await listGoals();
    expect(goals.length).toBeGreaterThanOrEqual(2);
    for (const goal of goals) {
      expect(goal.title.startsWith(DEMO_GOAL_PREFIX)).toBe(true);
    }
  });
});

describe("clearDemoData", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE);
    await unlockVault(PASSPHRASE);
  });

  it("supprime toutes les données démo après seedDemoData", async () => {
    await seedDemoData();
    // Vérifier qu'il y a des données
    const appsBefore = await listApplications();
    expect(appsBefore.length).toBeGreaterThanOrEqual(5);

    const result = await clearDemoData();

    // Vérifier que tout est supprimé
    const appsAfter = await listApplications();
    const docsAfter = await listDocuments();
    const eventsAfter = await listEvents();
    const goalsAfter = await listGoals();
    const journalAfter = await listJournalEntries();
    const prepsAfter = await listInterviewPreps();

    expect(appsAfter.length).toBe(0);
    expect(docsAfter.length).toBe(0);
    expect(eventsAfter.length).toBe(0);
    expect(goalsAfter.length).toBe(0);
    expect(journalAfter.length).toBe(0);
    expect(prepsAfter.length).toBe(0);

    // Vérifier le résultat
    expect(result.applications).toBeGreaterThanOrEqual(5);
    expect(result.documents).toBeGreaterThanOrEqual(2);
    expect(result.events).toBeGreaterThanOrEqual(3);
    expect(result.goals).toBeGreaterThanOrEqual(2);
    expect(result.journalEntries).toBeGreaterThanOrEqual(3);
    expect(result.interviewPreps).toBeGreaterThanOrEqual(1);
  });

  it("ne supprime PAS les données non-démo", async () => {
    // Créer une vraie candidature (sans tag DEMO_TAG)
    await createApplication({
      company: "Ma vraie entreprise",
      position: "Mon vrai poste",
      type: "cdi",
      status: "brouillon",
      location: "Paris",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: ["real-data"],
    });
    // Créer un vrai objectif (sans préfixe [DÉMO])
    await createGoal({
      title: "Mon vrai objectif",
      description: "",
      metric: "applications_sent",
      target: 5,
      period: "month",
      startAt: new Date().toISOString(),
      endAt: "",
    });
    // Seed les données démo
    await seedDemoData();

    await clearDemoData();

    // Les vraies données doivent rester
    const apps = await listApplications();
    const goals = await listGoals();
    expect(apps.length).toBe(1);
    expect(apps[0]!.company).toBe("Ma vraie entreprise");
    expect(goals.length).toBe(1);
    expect(goals[0]!.title).toBe("Mon vrai objectif");
  });

  it("hasExistingData retourne false après clearDemoData (plus que des données démo)", async () => {
    await seedDemoData();
    // Avant cleanup : hasExistingData devrait retourner false car ce sont des données démo
    const before = await hasExistingData();
    expect(before).toBe(false); // Car hasExistingData ignore les données taggées DEMO_TAG

    await clearDemoData();

    const after = await hasExistingData();
    expect(after).toBe(false);
  });

  it("hasExistingData retourne true s'il y a des vraies données + des données démo", async () => {
    // Créer une vraie candidature
    await createApplication({
      company: "Vraie entreprise",
      position: "Vrai poste",
      type: "cdi",
      status: "envoyee",
      location: "",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: [],
    });
    await seedDemoData();

    const result = await hasExistingData();
    expect(result).toBe(true); // Car il y a une vraie candidature
  });

  it("clearDemoData sur un coffre vide ne lève pas d'erreur", async () => {
    const result = await clearDemoData();
    expect(result.applications).toBe(0);
    expect(result.documents).toBe(0);
    expect(result.events).toBe(0);
    expect(result.goals).toBe(0);
    expect(result.journalEntries).toBe(0);
    expect(result.interviewPreps).toBe(0);
  });

  it("clearDemoData supprime les données avec l'ancien tag 'demo' (legacy)", async () => {
    await createApplication({
      company: "Legacy Demo Corp",
      position: "Dev",
      type: "cdi",
      status: "brouillon",
      location: "",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: [LEGACY_DEMO_TAG],
    });
    await createApplication({
      company: "Ma vraie entreprise",
      position: "Vrai poste",
      type: "cdi",
      status: "envoyee",
      location: "",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: [],
    });

    const result = await clearDemoData();

    expect(result.applications).toBe(1);
    const apps = await listApplications();
    expect(apps.length).toBe(1);
    expect(apps[0]!.company).toBe("Ma vraie entreprise");
  });

  it("clearDemoData supprime les candidatures des entreprises démo connues (legacy)", async () => {
    for (const company of DEMO_COMPANIES) {
      await createApplication({
        company,
        position: "Poste test",
        type: "cdi",
        status: "brouillon",
        location: "",
        remote: false,
        salary: "",
        source: "",
        contactName: "",
        contactEmail: "",
        notes: "",
        priority: "normale",
        tags: [],
      });
    }
    await createApplication({
      company: "Entreprise réelle SARL",
      position: "Vrai poste",
      type: "cdi",
      status: "envoyee",
      location: "",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: [],
    });

    const result = await clearDemoData();

    expect(result.applications).toBe(DEMO_COMPANIES.size);
    const apps = await listApplications();
    expect(apps.length).toBe(1);
    expect(apps[0]!.company).toBe("Entreprise réelle SARL");
  });

  it("isDemoApplication détecte le nouveau tag, l'ancien tag, et les entreprises connues", () => {
    expect(isDemoApplication({ tags: [DEMO_TAG], company: "Inconnue" })).toBe(true);
    expect(isDemoApplication({ tags: [LEGACY_DEMO_TAG], company: "Inconnue" })).toBe(true);
    expect(isDemoApplication({ tags: [], company: "Atelier Nova" })).toBe(true);
    expect(isDemoApplication({ tags: [], company: "Atelier Nova (fictif)" })).toBe(true);
    expect(isDemoApplication({ tags: [], company: "Ma vraie entreprise" })).toBe(false);
    expect(isDemoApplication({ tags: ["react"], company: "Ma vraie entreprise" })).toBe(false);
  });

  it("hasExistingData ignore les données legacy (ancien tag + entreprises connues)", async () => {
    await createApplication({
      company: "Atelier Nova",
      position: "Dev",
      type: "cdi",
      status: "brouillon",
      location: "",
      remote: false,
      salary: "",
      source: "",
      contactName: "",
      contactEmail: "",
      notes: "",
      priority: "normale",
      tags: [LEGACY_DEMO_TAG],
    });

    const result = await hasExistingData();
    expect(result).toBe(false);
  });
});
