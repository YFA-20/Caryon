import { describe, expect, it } from "vitest";
import { formatDateFr } from "@/lib/utils/date";
import { uuid } from "@/lib/utils/uuid";

describe("uuid", () => {
  it("génère des UUID v4 valides et uniques", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const id = uuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
    }
  });
});

describe("formatDateFr", () => {
  it("formate en français", () => {
    const out = formatDateFr("2026-10-22T08:00:00.000Z");
    expect(out).toContain("2026");
    expect(out.toLowerCase()).toMatch(/octobre/);
  });

  it("retourne l'entrée si la date est invalide", () => {
    expect(formatDateFr("pas-une-date")).toBe("pas-une-date");
  });
});
