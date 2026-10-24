/**
 * Tests unitaires — demo-data-service.
 *
 * Vérifie que seedDemoData crée bien des entités dans chaque collection
 * via les vrais repositories (chiffrés). Nécessite un coffre déverrouillé.
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createVault, unlockVault } from "@/lib/vault/vault-service";
import { seedDemoData, hasExistingData } from "@/lib/vault/demo-data-service";
import { listApplications } from "@/lib/vault/application-repository";
import { listEvents } from "@/lib/vault/calendar-repository";
import { listGoals } from "@/lib/vault/goal-repository";
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

  it("hasExistingData retourne true après seedDemoData", async () => {
    await seedDemoData();
    const result = await hasExistingData();
    expect(result).toBe(true);
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
});
