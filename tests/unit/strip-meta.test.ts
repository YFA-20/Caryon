/**
 * Velora — tests de l'utilitaire stripMetaFields.
 *
 * Vérifie que les champs système (id, createdAt, updatedAt, completed,
 * notified) sont retirés et que les champs métier sont conservés.
 */
import { describe, it, expect } from "vitest";
import { stripMetaFields } from "@/lib/utils/strip-meta";

describe("stripMetaFields", () => {
  it("retire id, createdAt, updatedAt", () => {
    const result = stripMetaFields({
      id: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      company: "Acme",
      position: "Dev",
    });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).toHaveProperty("company", "Acme");
    expect(result).toHaveProperty("position", "Dev");
  });

  it("retire completed et notified", () => {
    const result = stripMetaFields({
      id: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      completed: true,
      notified: true,
      title: "Mon objectif",
    });
    expect(result).not.toHaveProperty("completed");
    expect(result).not.toHaveProperty("notified");
    expect(result).toHaveProperty("title", "Mon objectif");
  });

  it("conserve tous les autres champs", () => {
    const result = stripMetaFields({
      id: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      company: "Acme",
      position: "Dev",
      status: "envoyee",
      tags: ["react", "typescript"],
      notes: "Une note",
    });
    expect(Object.keys(result).sort()).toEqual(["company", "notes", "position", "status", "tags"]);
  });

  it("ne modifie pas l'objet original", () => {
    const original = {
      id: "abc",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      title: "Test",
    };
    stripMetaFields(original);
    expect(original.id).toBe("abc");
    expect(original.createdAt).toBeTruthy();
  });
});
