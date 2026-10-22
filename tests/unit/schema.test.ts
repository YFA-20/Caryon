import { describe, expect, it } from "vitest";
import { applicationSchema } from "@/lib/schema/application";
import { encryptedRecordSchema } from "@/lib/schema/encrypted-record";
import { vaultSchema } from "@/lib/schema/vault";

const validApplication = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  company: "Exemple SAS",
  position: "Développeur·se full-stack",
  type: "cdi",
  status: "envoyee",
  priority: "normale",
  notes: "Candidature envoyée le mardi.",
  tags: ["frontend", "react"],
  createdAt: "2026-10-22T08:00:00.000Z",
  updatedAt: "2026-10-22T08:00:00.000Z",
};

describe("schéma Application (Zod)", () => {
  it("valide une candidature correcte", () => {
    const parsed = applicationSchema.parse(validApplication);
    expect(parsed.company).toBe("Exemple SAS");
    expect(parsed.remote).toBe(false);
  });

  it("applique les valeurs par défaut", () => {
    const parsed = applicationSchema.parse(validApplication);
    expect(parsed.status).toBe("envoyee");
    expect(parsed.tags).toEqual(["frontend", "react"]);
  });

  it("rejette un UUID invalide", () => {
    expect(() => applicationSchema.parse({ ...validApplication, id: "pas-un-uuid" })).toThrow();
  });

  it("rejette un type invalide", () => {
    expect(() => applicationSchema.parse({ ...validApplication, type: "cdi-forever" })).toThrow();
  });

  it("rejette un email de contact invalide", () => {
    expect(() =>
      applicationSchema.parse({ ...validApplication, contactEmail: "pas-un-email" })
    ).toThrow();
  });

  it("rejette une URL d'offre invalide", () => {
    expect(() =>
      applicationSchema.parse({ ...validApplication, offerUrl: "pas une url" })
    ).toThrow();
  });

  it("rejette des notes trop longues (minimisation des données)", () => {
    expect(() =>
      applicationSchema.parse({ ...validApplication, notes: "x".repeat(20001) })
    ).toThrow();
  });
});

describe("schéma Vault (Zod)", () => {
  it("valide les métadonnées du coffre", () => {
    const vault = vaultSchema.parse({
      id: "123e4567-e89b-42d3-a456-426614174000",
      createdAt: "2026-10-22T08:00:00.000Z",
      kdf: {
        algorithm: "argon2id",
        memoryKiB: 65536,
        iterations: 3,
        parallelism: 1,
        hashLength: 32,
      },
      salt: "c2FsdA",
      wrappedMasterKey: "d3JhcHBlZA",
      wrapIv: "aXY",
      verifier: "dmVyaWZpZXI",
      verifierIv: "aXY",
    });
    expect(vault.autoLockMs).toBe(15 * 60 * 1000);
  });
});

describe("schéma EncryptedRecord (Zod)", () => {
  it("valide un enregistrement v1 AES-256-GCM", () => {
    const record = encryptedRecordSchema.parse({
      v: 1,
      alg: "AES-256-GCM",
      iv: "abcd",
      ct: "efgh",
      aad: "ijkl",
    });
    expect(record.v).toBe(1);
  });

  it("rejette une version inconnue", () => {
    expect(() =>
      encryptedRecordSchema.parse({ v: 2, alg: "AES-256-GCM", iv: "a", ct: "b", aad: "c" })
    ).toThrow();
  });
});
