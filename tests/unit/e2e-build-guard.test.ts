/**
 * Velora — garde-fou : le flag de build E2E ne doit jamais activer
 * le KDF allégé hors de la CI E2E.
 *
 * Invariants vérifiés :
 * 1. Seul `.github/workflows/e2e.yml` (via `npm run test:e2e` → `build:e2e`)
 *    définit `NEXT_PUBLIC_E2E_TEST_BUILD`.
 * 2. Les workflows de déploiement (deploy.yml, deploy-preview.yml, release.yml)
 *    ne définissent JAMAIS ce flag → le build de production garde
 *    Argon2id 64 MiB, t=3 (DEFAULT_KDF_PARAMS).
 * 3. `src/lib/env.ts` ne contient pas de valeur par défaut "1" pour le flag.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const FLAG = "NEXT_PUBLIC_E2E_TEST_BUILD";

function workflowFiles(): string[] {
  return readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
}

describe("garde-fou build E2E (KDF allégé réservé aux tests)", () => {
  it("seul le workflow e2e.yml peut définir le flag de test", () => {
    const offenders: string[] = [];
    for (const file of workflowFiles()) {
      const content = readFileSync(join(WORKFLOWS, file), "utf8");
      if (content.includes(FLAG) && file !== "e2e.yml") {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("les workflows de déploiement n'utilisent pas le build E2E", () => {
    for (const file of ["deploy.yml", "deploy-preview.yml", "release.yml"]) {
      const content = readFileSync(join(WORKFLOWS, file), "utf8");
      expect(content).not.toContain("build:e2e");
      expect(content).not.toContain(FLAG);
    }
  });

  it("le flag n'a pas de valeur par défaut activée dans src/lib/env.ts", () => {
    const env = readFileSync(join(ROOT, "src", "lib", "env.ts"), "utf8");
    expect(env).toContain(`process.env?.${FLAG} === "1"`);
    // La constante exportée doit être une comparaison stricte, pas un littéral true/"1"
    expect(env).not.toMatch(/export const E2E_TEST_BUILD\s*=\s*("1"|true)\s*;/);
  });

  it("le script build de production ne définit pas le flag", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build"]).not.toContain(FLAG);
    expect(pkg.scripts["build:e2e"]).toContain(`${FLAG}=1`);
  });
});
