/**
 * Velora — tests du dépôt du journal (chiffré).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  countJournalEntries,
  listJournalEntriesByMonth,
} from "@/lib/vault/journal-repository";
import type { JournalEntry } from "@/lib/schema/journal";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

function makeInput(overrides: Partial<JournalEntry> = {}) {
  return {
    date: "2026-11-15T12:00:00.000Z",
    title: "Bilan de la semaine",
    content: "3 entretiens cette semaine, 2 relances envoyées.",
    mood: "bien" as const,
    tags: ["bilan", "semaine-46"],
    ...overrides,
  };
}

describe("journal-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("crée et liste une entrée (triée par date décroissante)", async () => {
    await createJournalEntry(makeInput({ title: "Ancienne", date: "2026-10-01T12:00:00.000Z" }));
    await createJournalEntry(makeInput({ title: "Récente", date: "2026-11-15T12:00:00.000Z" }));

    const list = await listJournalEntries();
    expect(list).toHaveLength(2);
    expect(list[0]!.title).toBe("Récente");
    expect(list[1]!.title).toBe("Ancienne");
  });

  it("récupère une entrée par id", async () => {
    const entry = await createJournalEntry(makeInput());
    const found = await getJournalEntry(entry.id);
    expect(found).toBeTruthy();
    expect(found!.content).toContain("3 entretiens");
  });

  it("met à jour une entrée", async () => {
    const entry = await createJournalEntry(makeInput());
    const updated = await updateJournalEntry(entry.id, {
      title: "Bilan modifié",
      mood: "motive",
    });
    expect(updated.title).toBe("Bilan modifié");
    expect(updated.mood).toBe("motive");
    expect(updated.id).toBe(entry.id);
    expect(updated.createdAt).toBe(entry.createdAt);
  });

  it("supprime une entrée", async () => {
    const entry = await createJournalEntry(makeInput());
    await deleteJournalEntry(entry.id);
    expect(await getJournalEntry(entry.id)).toBeNull();
    expect(await countJournalEntries()).toBe(0);
  });

  it("filtre par mois", async () => {
    await createJournalEntry(makeInput({ title: "Novembre", date: "2026-11-10T12:00:00.000Z" }));
    await createJournalEntry(makeInput({ title: "Octobre", date: "2026-10-10T12:00:00.000Z" }));

    const nov = await listJournalEntriesByMonth("2026-11");
    expect(nov).toHaveLength(1);
    expect(nov[0]!.title).toBe("Novembre");
  });

  it("ne stocke pas le contenu en clair dans IndexedDB", async () => {
    await createJournalEntry(makeInput({ content: "CONTENU-SECRET-JOURNAL-UNIQUE-42" }));
    const rows = await db.records.toArray();
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("CONTENU-SECRET-JOURNAL-UNIQUE-42");
  });
});
