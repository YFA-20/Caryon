/**
 * Velora — tests du dépôt des fiches de préparation d'entretien (chiffrées).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listInterviewPreps,
  getInterviewPrep,
  getInterviewPrepByApplication,
  createInterviewPrep,
  updateInterviewPrep,
  deleteInterviewPrep,
  toggleChecklistItem,
  checklistProgress,
  questionsProgress,
} from "@/lib/vault/interview-repository";
import { DEFAULT_INTERVIEW_CHECKLIST } from "@/lib/schema/interview";
import type { InterviewPrep } from "@/lib/schema/interview";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";
const APP_ID = "550e8400-e29b-41d4-a716-446655440000";
const APP_ID_2 = "550e8400-e29b-41d4-a716-446655440001";

describe("interview-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("crée une fiche avec la checklist par défaut", async () => {
    const prep = await createInterviewPrep(APP_ID);
    expect(prep.applicationId).toBe(APP_ID);
    expect(prep.checklist).toHaveLength(DEFAULT_INTERVIEW_CHECKLIST.length);
    expect(prep.checklist.every((i) => !i.done)).toBe(true);
    expect(prep.format).toBe("non_precis");
  });

  it("ne crée pas de doublon pour la même candidature", async () => {
    const first = await createInterviewPrep(APP_ID);
    const second = await createInterviewPrep(APP_ID);
    expect(second.id).toBe(first.id);
    expect(await listInterviewPreps()).toHaveLength(1);
  });

  it("récupère une fiche par candidature", async () => {
    await createInterviewPrep(APP_ID);
    const found = await getInterviewPrepByApplication(APP_ID);
    expect(found).toBeTruthy();
    expect(await getInterviewPrepByApplication(APP_ID_2)).toBeNull();
  });

  it("met à jour une fiche", async () => {
    const prep = await createInterviewPrep(APP_ID);
    const updated = await updateInterviewPrep(prep.id, {
      format: "visio",
      strengths: "5 ans de React, lead technique",
    });
    expect(updated.format).toBe("visio");
    expect(updated.strengths).toContain("React");
    expect(updated.id).toBe(prep.id);
    expect(updated.createdAt).toBe(prep.createdAt);
  });

  it("bascule un item de checklist", async () => {
    const prep = await createInterviewPrep(APP_ID);
    const item = prep.checklist[0]!;
    const updated = await toggleChecklistItem(prep.id, item.id);
    expect(updated.checklist[0]!.done).toBe(true);
    // Re-bascule
    const updated2 = await toggleChecklistItem(prep.id, item.id);
    expect(updated2.checklist[0]!.done).toBe(false);
  });

  it("supprime une fiche", async () => {
    const prep = await createInterviewPrep(APP_ID);
    await deleteInterviewPrep(prep.id);
    expect(await getInterviewPrep(prep.id)).toBeNull();
  });

  it("ne stocke pas les notes en clair", async () => {
    const prep = await createInterviewPrep(APP_ID);
    await updateInterviewPrep(prep.id, { companyResearch: "NOTE-SECRETE-ENTRETIEN-99" });
    const rows = await db.records.toArray();
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("NOTE-SECRETE-ENTRETIEN-99");
  });

  describe("checklistProgress", () => {
    it("retourne 0 si checklist vide", () => {
      expect(checklistProgress({ checklist: [] } as unknown as InterviewPrep)).toBe(0);
    });

    it("calcule le pourcentage d'items faits", () => {
      const prep = {
        checklist: [
          { id: "1", label: "A", done: true },
          { id: "2", label: "B", done: false },
          { id: "3", label: "C", done: true },
          { id: "4", label: "D", done: false },
        ],
      } as unknown as InterviewPrep;
      expect(checklistProgress(prep)).toBe(50);
    });
  });

  describe("questionsProgress", () => {
    it("retourne 0 si pas de questions", () => {
      expect(questionsProgress({ questions: [] } as unknown as InterviewPrep)).toBe(0);
    });

    it("calcule le pourcentage de questions préparées", () => {
      const prep = {
        questions: [
          { id: "1", question: "Q1", answer: "", category: "technique", prepared: true },
          { id: "2", question: "Q2", answer: "", category: "technique", prepared: false },
        ],
      } as unknown as InterviewPrep;
      expect(questionsProgress(prep)).toBe(50);
    });
  });
});
