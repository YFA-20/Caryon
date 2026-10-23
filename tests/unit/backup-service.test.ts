/**
 * Velora — tests du service de sauvegarde/restauration chiffrée.
 *
 * Vérifie :
 * - Export → sérialisation → parsing (round-trip du conteneur).
 * - Export → import sur le même coffre (mode replace) : données restaurées.
 * - Détection de modification du payload (checksum SHA-256).
 * - Restauration du coffre depuis une archive (simulation nouvel appareil).
 * - Refus de restauration de coffre si un coffre existe déjà.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, unlockVault, lock, isUnlocked } from "@/lib/vault/vault-service";
import {
  exportBackup,
  serializeBackup,
  parseBackup,
  importBackup,
  restoreVaultFromBackup,
  verifyBackupIntegrity,
} from "@/lib/vault/backup-service";
import { createApplication, listApplications } from "@/lib/vault/application-repository";
import { createDocument, listDocuments, getDocumentContent } from "@/lib/vault/document-repository";
import { createEvent, listEvents } from "@/lib/vault/calendar-repository";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

async function resetDb() {
  await db.vault.clear();
  await db.records.clear();
  await db.documents.clear();
  lock();
}

describe("backup-service", () => {
  beforeEach(async () => {
    await resetDb();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("exporte une archive avec manifest et snapshot du coffre", async () => {
    const archive = await exportBackup();
    expect(archive.manifest.format).toBe("velora-backup");
    expect(archive.manifest.version).toBe(1);
    expect(archive.manifest.checksum).toHaveLength(64);
    expect(archive.vault.wrappedMasterKey).toBeTruthy();
    expect(archive.vault.salt).toBeTruthy();
    expect(archive.payload.alg).toBe("AES-256-GCM");
  });

  it("sérialise et parse une archive (round-trip conteneur)", async () => {
    const archive = await exportBackup();
    const json = serializeBackup(archive);
    const parsed = parseBackup(json);
    expect(parsed.manifest.checksum).toBe(archive.manifest.checksum);
    expect(parsed.vault.id).toBe(archive.vault.id);
  });

  it("restaure les candidatures, documents et événements (mode replace)", async () => {
    await createApplication({
      company: "Acme",
      position: "Dev",
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
      status: "envoyee",
      priority: "normale",
      notes: "",
      tags: [],
    });
    await createDocument({
      name: "cv.pdf",
      type: "cv",
      mimeType: "application/pdf",
      content: new TextEncoder().encode("%PDF-1.4 contenu test"),
    });
    await createEvent({
      title: "Entretien",
      type: "entretien",
      startAt: "2026-12-01T10:00:00.000Z",
      endAt: "",
      allDay: false,
      notes: "",
    });

    const archive = await exportBackup();
    expect(archive.manifest.recordCount).toBe(3);

    // Efface tout, puis restaure
    await db.records.clear();
    await db.documents.clear();
    expect(await listApplications()).toHaveLength(0);

    const result = await importBackup(archive, "replace");
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);

    const apps = await listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.company).toBe("Acme");

    const docs = await listDocuments();
    expect(docs).toHaveLength(1);
    const content = await getDocumentContent(docs[0]!.id);
    expect(new TextDecoder().decode(content!)).toContain("contenu test");

    const events = await listEvents();
    expect(events).toHaveLength(1);
    expect(events[0]!.title).toBe("Entretien");
  });

  it("détecte une modification du payload (checksum)", async () => {
    await createApplication({
      company: "Acme",
      position: "Dev",
      type: "cdi",
      offerUrl: "",
      location: "",
      remote: false,
      salary: "",
      appliedAt: "",
      deadline: "",
      source: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      status: "brouillon",
      priority: "normale",
      notes: "",
      tags: [],
    });

    const archive = await exportBackup();
    // Modifie le ciphertext (simule une altération)
    const tampered = {
      ...archive,
      payload: { ...archive.payload, ct: archive.payload.ct.slice(0, -4) + "AAAA" },
    };

    await expect(verifyBackupIntegrity(tampered)).rejects.toThrow(/Intégrité compromise/);
    await expect(importBackup(tampered, "replace")).rejects.toThrow(/Intégrité compromise/);
  });

  it("restaure le coffre depuis une archive (simulation nouvel appareil)", async () => {
    await createApplication({
      company: "Acme",
      position: "Dev",
      type: "cdi",
      offerUrl: "",
      location: "",
      remote: false,
      salary: "",
      appliedAt: "",
      deadline: "",
      source: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      status: "brouillon",
      priority: "normale",
      notes: "",
      tags: [],
    });
    const archive = await exportBackup();

    // Simule un nouvel appareil : base vide, pas de coffre
    await resetDb();
    expect(isUnlocked()).toBe(false);
    expect(await db.vault.count()).toBe(0);

    await restoreVaultFromBackup(archive);
    expect(await db.vault.count()).toBe(1);

    // Le coffre restauré se déverrouille avec la même phrase
    const vault = await unlockVault(TEST_PASSPHRASE, { testMode: true });
    expect(vault.id).toBe(archive.vault.id);
    expect(isUnlocked()).toBe(true);

    // Les données sont restaurables après déverrouillage
    const result = await importBackup(archive, "replace");
    expect(result.imported).toBe(1);
    const apps = await listApplications();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.company).toBe("Acme");
  });

  it("refuse de restaurer le coffre si un coffre existe déjà", async () => {
    const archive = await exportBackup();
    // Un coffre existe déjà (créé dans beforeEach)
    await expect(restoreVaultFromBackup(archive)).rejects.toThrow(/existe déjà/);
  });

  it("refuse d'exporter si le coffre est verrouillé", async () => {
    lock();
    await expect(exportBackup()).rejects.toThrow(/verrouillé/);
  });

  it("rejette un JSON invalide lors du parsing", () => {
    expect(() => parseBackup("pas du json")).toThrow();
    expect(() => parseBackup(JSON.stringify({ manifest: {}, payload: {} }))).toThrow();
  });
});
