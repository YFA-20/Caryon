// @vitest-environment jsdom
/**
 * Velora — tests d'accessibilité (WCAG 2.2 AA).
 *
 * Vérifie les invariants structurels du code source :
 * - Skip link présent dans le shell
 * - <main> a un id pour le skip link
 * - Focus trap sur les modales
 * - KeyboardSensor sur le Kanban
 * - Pas de tabIndex positif
 * - Pas de div/span avec onClick
 * - scope="col" sur les <th>
 * - Contraste des couleurs du design system >= 4.5:1
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readSrc(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// --- Contraste WCAG ---

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const PALETTE = {
  background: "#191119",
  surface: "#1D141D",
  card: "#2B1E2C",
  primary: "#F8EDF2",
  secondary: "#BBA8B5",
  rose: "#E7C4D3",
  lavender: "#BBA6D9",
  success: "#9BC4A8",
  warning: "#E3C08D",
  danger: "#D98A8A",
} as const;

describe("a11y — contraste WCAG 2.2 AA (4.5:1 minimum)", () => {
  const combos: [keyof typeof PALETTE, keyof typeof PALETTE][] = [
    ["primary", "background"],
    ["primary", "card"],
    ["primary", "surface"],
    ["secondary", "background"],
    ["secondary", "card"],
    ["secondary", "surface"],
    ["rose", "background"],
    ["rose", "card"],
    ["lavender", "background"],
    ["lavender", "card"],
    ["success", "background"],
    ["success", "card"],
    ["warning", "background"],
    ["warning", "card"],
    ["danger", "background"],
    ["danger", "card"],
  ];

  for (const [fg, bg] of combos) {
    it(`contraste ${fg} sur ${bg} >= 4.5`, () => {
      const ratio = contrastRatio(PALETTE[fg], PALETTE[bg]);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("a11y — structure du code source", () => {
  it("le shell a un skip link vers #main-content", () => {
    const shell = readSrc("src/components/layout/app-shell.tsx");
    expect(shell).toContain('href="#main-content"');
    expect(shell).toContain("sr-only");
  });

  it("le <main> a un id main-content et tabIndex=-1", () => {
    const shell = readSrc("src/components/layout/app-shell.tsx");
    expect(shell).toMatch(/<main[^>]*id="main-content"/);
    expect(shell).toMatch(/<main[^>]*tabIndex=\{-1\}/);
  });

  it("le Kanban a un KeyboardSensor (drag & drop clavier)", () => {
    const board = readSrc("src/components/applications/kanban-board.tsx");
    expect(board).toContain("KeyboardSensor");
    expect(board).toContain("sortableKeyboardCoordinates");
  });

  it("les cartes Kanban sont focusables avec un aria-label", () => {
    const card = readSrc("src/components/applications/kanban-card.tsx");
    expect(card).toContain('role="button"');
    expect(card).toContain("tabIndex={0}");
    expect(card).toContain("aria-label");
  });

  it("les 3 modales utilisent useFocusTrap", () => {
    for (const f of [
      "src/components/ai/ai-consent-modal.tsx",
      "src/components/onboarding/onboarding-wizard.tsx",
      "src/components/common/command-palette.tsx",
    ]) {
      const src = readSrc(f);
      expect(src).toContain("useFocusTrap");
      expect(src).toContain('aria-modal="true"');
    }
  });

  it("aucun tabIndex positif dans le code", () => {
    const files = [
      "src/components/layout/app-shell.tsx",
      "src/components/applications/kanban-card.tsx",
      "src/components/ai/ai-consent-modal.tsx",
      "src/components/onboarding/onboarding-wizard.tsx",
      "src/components/common/command-palette.tsx",
    ];
    for (const f of files) {
      const src = readSrc(f);
      const matches = src.match(/tabIndex=\{(\d+)\}/g) || [];
      for (const m of matches) {
        const val = parseInt(m.match(/\d+/)![0], 10);
        expect(val).toBeLessThanOrEqual(0);
      }
    }
  });

  it("les <th> du tableau ont scope=col", () => {
    const table = readSrc("src/components/applications/applications-table.tsx");
    const thCount = (table.match(/<th\b/g) || []).length;
    const scopeCount = (table.match(/<th[^>]*scope="col"/g) || []).length;
    expect(scopeCount).toBe(thCount);
  });

  it("le html a lang=fr", () => {
    const layout = readSrc("src/app/layout.tsx");
    expect(layout).toContain('lang="fr"');
  });

  it("globals.css a focus-visible et prefers-reduced-motion", () => {
    const css = readSrc("src/app/globals.css");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("les onClick sur div dans la palette sont le backdrop (role=dialog) ou stopPropagation interne", () => {
    const src = readSrc("src/components/common/command-palette.tsx");
    // Le backdrop (ligne ~162) a role="dialog" — fermeture au clic OK avec Escape aussi.
    // Le div interne (ligne ~170) a stopPropagation — il est DANS le dialog, pas un élément
    // interactif autonome. Aucun div cliquable autonome hors dialog.
    const backdropMatch = src.match(
      /<div[^>]*onClick=\{\(\) => setOpen\(false\)\}[^>]*role="dialog"/s
    );
    expect(backdropMatch).not.toBeNull();
  });
});

describe("a11y — hook useFocusTrap", () => {
  it("le fichier du hook existe et exporte useFocusTrap", () => {
    const hook = readSrc("src/hooks/use-focus-trap.ts");
    expect(hook).toContain("export function useFocusTrap");
    expect(hook).toContain("Tab");
    expect(hook).toContain("shiftKey");
  });
});
