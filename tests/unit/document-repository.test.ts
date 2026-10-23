/**
 * Velora — tests du dépôt des documents chiffrés.
 *
 * Vérifie le CRUD chiffré : création, lecture, contenu round-trip,
 * rejet des MIME non autorisés, rejet des fichiers trop volumineux,
 * et que le contenu stocké dans IndexedDB n'est PAS en clair.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import {
  listDocuments,
  getDocument,
  getDocumentContent,
  createDocument,
  updateDocument,
  deleteDocument,
  addDocumentVersion,
  countDocuments,
  getTotalDocumentsSize,
} from "@/lib/vault/document-repository";
import { MAX_DOCUMENT_SIZE } from "@/lib/schema/document";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

function makePdfContent(text: string): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4 ${text}`);
}

describe("document-repository", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
    await createVault(TEST_PASSPHRASE, { testMode: true });
  });

  it("crée et liste un document", async () => {
    const doc = await createDocument({
      name: "cv-jean.pdf",
      type: "cv",
      mimeType: "application/pdf",
      content: makePdfContent("contenu cv"),
    });
    expect(doc.id).toBeTruthy();
    expect(doc.versionCount).toBe(1);

    const list = await listDocuments();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("cv-jean.pdf");
  });

  it("round-trip du contenu binaire (déchiffrement = octets originaux)", async () => {
    const original = makePdfContent("données binaires fictives");
    const doc = await createDocument({
      name: "lettre.pdf",
      type: "lettre",
      mimeType: "application/pdf",
      content: original,
    });

    const content = await getDocumentContent(doc.id);
    expect(content).not.toBeNull();
    expect(Array.from(content!)).toEqual(Array.from(original));
  });

  it("rejette un type MIME non autorisé", async () => {
    await expect(
      createDocument({
        name: "virus.exe",
        type: "autre",
        mimeType: "application/x-msdownload",
        content: new Uint8Array([1, 2, 3]),
      })
    ).rejects.toThrow(/non autorisé/);
  });

  it("rejette un fichier trop volumineux", async () => {
    const big = new Uint8Array(MAX_DOCUMENT_SIZE + 1);
    await expect(
      createDocument({
        name: "gros.pdf",
        type: "autre",
        mimeType: "application/pdf",
        content: big,
      })
    ).rejects.toThrow(/trop volumineux/);
  });

  it("ne stocke PAS le contenu en clair dans IndexedDB", async () => {
    const secret = "CONTENU-SECRET-UNIQUE-12345";
    await createDocument({
      name: "secret.pdf",
      type: "cv",
      mimeType: "application/pdf",
      content: makePdfContent(secret),
    });

    const rows = await db.documents.toArray();
    expect(rows).toHaveLength(1);
    const serialized = JSON.stringify(rows[0]);
    expect(serialized).not.toContain(secret);
    // Le nom du document non plus n'est pas en clair (métadonnées chiffrées)
    expect(serialized).not.toContain("secret.pdf");
  });

  it("met à jour les métadonnées", async () => {
    const doc = await createDocument({
      name: "cv.pdf",
      type: "cv",
      mimeType: "application/pdf",
      content: makePdfContent("v1"),
    });
    const updated = await updateDocument(doc.id, { name: "cv-2026.pdf", tags: ["prioritaire"] });
    expect(updated.name).toBe("cv-2026.pdf");
    expect(updated.tags).toEqual(["prioritaire"]);
    expect(updated.createdAt).toBe(doc.createdAt);
    expect(updated.updatedAt >= doc.updatedAt).toBe(true);
  });

  it("ajoute une nouvelle version et incrémente le compteur", async () => {
    const doc = await createDocument({
      name: "cv.pdf",
      type: "cv",
      mimeType: "application/pdf",
      content: makePdfContent("v1"),
    });
    const v2 = await addDocumentVersion(doc.id, makePdfContent("v2 plus longue"));
    expect(v2.version).toBe(2);

    const after = await getDocument(doc.id);
    expect(after!.versionCount).toBe(2);

    const content = await getDocumentContent(doc.id);
    expect(new TextDecoder().decode(content!)).toContain("v2 plus longue");
  });

  it("supprime un document et son contenu", async () => {
    const doc = await createDocument({
      name: "a-supprimer.pdf",
      type: "autre",
      mimeType: "application/pdf",
      content: makePdfContent("x"),
    });
    await deleteDocument(doc.id);
    expect(await countDocuments()).toBe(0);
    expect(await getDocument(doc.id)).toBeNull();
    expect(await getDocumentContent(doc.id)).toBeNull();
  });

  it("calcule la taille totale des documents", async () => {
    await createDocument({
      name: "a.pdf",
      type: "autre",
      mimeType: "application/pdf",
      content: makePdfContent("12345"),
    });
    await createDocument({
      name: "b.pdf",
      type: "autre",
      mimeType: "application/pdf",
      content: makePdfContent("123"),
    });
    const total = await getTotalDocumentsSize();
    // "%PDF-1.4 " fait 9 caractères, donc 9+5=14 et 9+3=12
    expect(total).toBe(14 + 12);
  });
});
