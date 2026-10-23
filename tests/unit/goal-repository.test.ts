/**
 * Velora — tests du dépôt des objectifs et des préférences (chiffrés).
 *
 * Vérifie le CRUD des objectifs, le singleton des paramètres,
 * et que les données ne sont pas stockées en clair.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listGoals,
  getGoal,
  createGoal,
  updateGoal,
  deleteGoal,
  getSettings,
  saveSettings,
  wipeAllData,
} from "@/lib/vault/goal-repository";
import type { Goal } from "@/lib/schema/goal";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

function makeGoalInput(overrides: Partial<Goal> = {}) {
  return {
    title: "10 candidatures ce mois",
    description: "Objectif novembre",
    metric: "applications_sent" as const,
    target: 10,
    period: "month" as const,
    startAt: new Date().toISOString(),
    endAt: "",
    ...overrides,
  };
}

describe("goal-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  describe("objectifs", () => {
    it("crée et liste un objectif", async () => {
      const goal = await createGoal(makeGoalInput());
      expect(goal.id).toBeTruthy();
      expect(goal.completed).toBe(false);

      const list = await listGoals();
      expect(list).toHaveLength(1);
      expect(list[0]!.title).toBe("10 candidatures ce mois");
    });

    it("récupère un objectif par id", async () => {
      const goal = await createGoal(makeGoalInput());
      const found = await getGoal(goal.id);
      expect(found).toBeTruthy();
      expect(found!.target).toBe(10);
    });

    it("met à jour un objectif", async () => {
      const goal = await createGoal(makeGoalInput());
      const updated = await updateGoal(goal.id, { target: 20, completed: true });
      expect(updated.target).toBe(20);
      expect(updated.completed).toBe(true);
      expect(updated.id).toBe(goal.id);
      expect(updated.createdAt).toBe(goal.createdAt);
    });

    it("supprime un objectif", async () => {
      const goal = await createGoal(makeGoalInput());
      await deleteGoal(goal.id);
      expect(await getGoal(goal.id)).toBeNull();
      expect(await listGoals()).toHaveLength(0);
    });

    it("ne stocke pas le titre en clair dans IndexedDB", async () => {
      await createGoal(makeGoalInput({ title: "TITRE-SECRET-OBJECTIF-XYZ" }));
      const rows = await db.records.toArray();
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain("TITRE-SECRET-OBJECTIF-XYZ");
    });
  });

  describe("paramètres", () => {
    it("retourne les valeurs par défaut si aucun paramètre sauvegardé", async () => {
      const settings = await getSettings();
      expect(settings.id).toBe("default");
      expect(settings.firstName).toBe("");
      expect(settings.autoLockMs).toBe(15 * 60 * 1000);
    });

    it("sauvegarde et recharge les paramètres", async () => {
      await saveSettings({ firstName: "Camille", autoLockMs: 5 * 60 * 1000 });
      const settings = await getSettings();
      expect(settings.firstName).toBe("Camille");
      expect(settings.autoLockMs).toBe(5 * 60 * 1000);
    });

    it("fusionne les patchs partiels", async () => {
      await saveSettings({ firstName: "Camille" });
      await saveSettings({ autoLockMs: 30 * 60 * 1000 });
      const settings = await getSettings();
      expect(settings.firstName).toBe("Camille"); // conservé
      expect(settings.autoLockMs).toBe(30 * 60 * 1000); // mis à jour
    });

    it("ne stocke pas le prénom en clair", async () => {
      await saveSettings({ firstName: "PrenomSecretUnique123" });
      const rows = await db.records.toArray();
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain("PrenomSecretUnique123");
    });
  });

  describe("wipeAllData", () => {
    it("efface toutes les données (vault, records, documents)", async () => {
      await createGoal(makeGoalInput());
      await saveSettings({ firstName: "Test" });
      await db.documents.put({
        id: "doc-1",
        meta: "{}",
        content: "{}",
        version: 1,
        updatedAt: new Date().toISOString(),
      });

      await wipeAllData();

      expect(await db.vault.count()).toBe(0);
      expect(await db.records.count()).toBe(0);
      expect(await db.documents.count()).toBe(0);
    });
  });
});
