/**
 * Velora — tests du dépôt des candidatures.
 *
 * Vérifie le CRUD chiffré : création, lecture, mise à jour, suppression,
 * persistance IndexedDB, et que les données stockées ne sont pas en clair.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  deleteApplication,
  countApplications,
} from "@/lib/vault/application-repository";
import type { Application } from "@/lib/schema/application";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

function makeInput(overrides: Partial<Application> = {}) {
  return {
    company: "Atelier Nova",
    position: "Développeur front-end",
    type: "cdi" as const,
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
    status: "envoyee" as const,
    priority: "normale" as const,
    notes: "Premier entretien téléphonique prévu",
    tags: ["front-end", "react"],
    ...overrides,
  };
}

describe("application-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("crée et liste une candidature", async () => {
    const app = await createApplication(makeInput());
    expect(app.id).toBeTruthy();
    expect(app.createdAt).toBeTruthy();

    const list = await listApplications();
    expect(list).toHaveLength(1);
    expect(list[0]!.company).toBe("Atelier Nova");
  });

  it("récupère une candidature par id", async () => {
    const app = await createApplication(makeInput());
    const found = await getApplication(app.id);
    expect(found).toBeTruthy();
    expect(found!.position).toBe("Développeur front-end");
  });

  it("met à jour une candidature", async () => {
    const app = await createApplication(makeInput());
    const updated = await updateApplication(app.id, {
      status: "entretien",
      notes: "Entretien le 15",
    });
    expect(updated.status).toBe("entretien");
    expect(updated.notes).toBe("Entretien le 15");
    expect(updated.id).toBe(app.id);
    expect(updated.createdAt).toBe(app.createdAt);
  });

  it("supprime une candidature", async () => {
    const app = await createApplication(makeInput());
    await deleteApplication(app.id);
    expect(await countApplications()).toBe(0);
    expect(await getApplication(app.id)).toBeNull();
  });

  it("ne stocke pas les données en clair dans IndexedDB", async () => {
    await createApplication(makeInput({ notes: "NOTE-SECRETE-UNIQUE-12345" }));
    const rows = await db.records.toArray();
    expect(rows.length).toBeGreaterThan(0);
    const allPayloads = rows.map((r) => r.payload).join(" ");
    expect(allPayloads).not.toContain("NOTE-SECRETE-UNIQUE-12345");
    expect(allPayloads).not.toContain("Atelier Nova");
    expect(allPayloads).not.toContain("Développeur front-end");
  });

  it("refuse de créer sans coffre déverrouillé", async () => {
    lock();
    await expect(createApplication(makeInput())).rejects.toThrow(/verrouillé/);
  });

  it("trie par date de mise à jour décroissante", async () => {
    const a = await createApplication(makeInput({ company: "A" }));
    await new Promise((r) => setTimeout(r, 10));
    const b = await createApplication(makeInput({ company: "B" }));
    await new Promise((r) => setTimeout(r, 10));
    await updateApplication(a.id, { notes: "modifié" });

    const list = await listApplications();
    expect(list[0]!.id).toBe(a.id); // 'a' modifié en dernier
    expect(list[1]!.id).toBe(b.id);
  });
});
