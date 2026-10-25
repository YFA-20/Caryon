// @vitest-environment node
/**
 * Velora — test de régression CSP par page.
 *
 * Exécute le vrai script postbuild (`scripts/update-csp-hashes.mjs`) sur un
 * export factice comportant des routes profondes, puis vérifie que :
 * - Chaque page a sa propre règle `_headers` avec les bons hashes.
 * - Aucun `'unsafe-inline'` ni `'unsafe-eval'` dans `script-src`.
 * - La règle globale `/*` ne définit PAS de CSP (évite l'intersection bloquante).
 * - `404.html` contient une balise `<meta http-equiv="Content-Security-Policy">`.
 * - Toutes les lignes respectent la limite Cloudflare de 2 000 caractères.
 * - Le script échoue si l'export est incomplet ou si une ligne est trop longue.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const generator = resolve("scripts/update-csp-hashes.mjs");
const directories: string[] = [];

// Pages factices avec des scripts inline distincts (comme Next.js génère
// des payloads RSC différents par page).
const pages: Record<string, string> = {
  "index.html": 'self.__next_f.push([1,"home"])',
  "404.html": 'self.__next_f.push([1,"not-found"])',
  "candidatures.html": 'self.__next_f.push([1,"candidatures"])',
  "calendrier.html": 'self.__next_f.push([1,"calendrier"])',
  "nested/page/index.html": 'self.__next_f.push([1,"nested"])',
};

async function createFixture(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "velora-csp-"));
  directories.push(directory);
  for (const [file, script] of Object.entries(pages)) {
    const path = join(directory, "out", file);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, `<html><head></head><body><script>${script}</script></body></html>`);
  }
  return directory;
}

function runGenerator(directory: string): void {
  execFileSync(process.execPath, [generator], { cwd: directory, stdio: "pipe" });
}

/** Parse le fichier `_headers` en map { route → valeur CSP }. */
function parseCspPolicies(headers: string): Map<string, string> {
  const result = new Map<string, string>();
  let route = "";
  for (const line of headers.split("\n")) {
    if (line.startsWith("/")) route = line.trim();
    const trimmed = line.trim();
    if (trimmed.startsWith("Content-Security-Policy:")) {
      result.set(route, trimmed.slice("Content-Security-Policy:".length).trim());
    }
  }
  return result;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("CSP — toutes les routes de l'export", () => {
  it("autorise le payload propre à chaque page et chaque alias Cloudflare", async () => {
    const directory = await createFixture();
    runGenerator(directory);

    const headers = await readFile(join(directory, "out/_headers"), "utf8");
    const csp = parseCspPolicies(headers);

    const expectedRoutes: Record<string, string[]> = {
      "index.html": ["/", "/index.html"],
      "404.html": ["/404", "/404/", "/404.html"],
      "candidatures.html": ["/candidatures", "/candidatures/", "/candidatures.html"],
      "calendrier.html": ["/calendrier", "/calendrier/", "/calendrier.html"],
      "nested/page/index.html": ["/nested/page", "/nested/page/", "/nested/page/index.html"],
    };

    // La règle globale /* ne doit PAS contenir de CSP
    expect(csp.has("/*")).toBe(false);

    for (const [file, aliases] of Object.entries(expectedRoutes)) {
      const hash = createHash("sha256").update(pages[file]!).digest("base64");
      for (const alias of aliases) {
        const policy = csp.get(alias);
        expect(policy, `CSP manquante pour ${alias}`).toBeDefined();
        expect(policy).toContain(`'sha256-${hash}'`);
        expect(policy).toContain("frame-ancestors 'none'");
        expect(policy).not.toContain("'unsafe-eval'");
        expect(policy?.match(/script-src ([^;]+)/)?.[1]).not.toContain("'unsafe-inline'");
      }
    }

    // Les en-têtes de sécurité communs sont présents
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");

    // Toutes les lignes respectent la limite Cloudflare de 2 000 caractères
    for (const line of headers.split("\n")) {
      expect(
        line.length,
        `Ligne trop longue (${line.length} > 2000) : ${line.slice(0, 80)}…`
      ).toBeLessThanOrEqual(2000);
    }
  });

  it("protège la 404 servie pour une URL inconnue via une balise <meta>", async () => {
    const directory = await createFixture();
    runGenerator(directory);
    // Relance le postbuild pour vérifier l'idempotence (pas de balise dupliquée)
    runGenerator(directory);

    const html = await readFile(join(directory, "out/404.html"), "utf8");

    // Une seule balise meta CSP
    const metaMatches = html.match(/http-equiv="Content-Security-Policy"/g);
    expect(metaMatches).toHaveLength(1);

    // Le hash du script inline de 404.html est présent
    const hash = createHash("sha256").update(pages["404.html"]!).digest("base64");
    expect(html).toContain(`'sha256-${hash}'`);

    // La balise meta est dans le <head>, avant les scripts
    expect(html.indexOf("http-equiv=")).toBeLessThan(html.indexOf("<script>"));

    // frame-ancestors n'est pas supporté en meta → absent de la balise
    expect(html).not.toContain("frame-ancestors");
  });

  it("échoue si l'export est incomplet (index.html manquant)", async () => {
    const directory = await createFixture();
    await rm(join(directory, "out/index.html"));
    expect(() => runGenerator(directory)).toThrow();
  });

  it("échoue si une page n'a aucun script inline", async () => {
    const directory = await createFixture();
    await writeFile(join(directory, "out/empty.html"), "<html><head></head><body></body></html>");
    expect(() => runGenerator(directory)).toThrow();
  });

  it("échoue si une ligne CSP dépasse 2 000 caractères (limite Cloudflare)", async () => {
    const directory = await createFixture();
    // Génère 50 scripts inline distincts → CSP trop longue
    const scripts = Array.from({ length: 50 }, (_, n) => `<script>console.log(${n})</script>`).join(
      ""
    );
    await writeFile(
      join(directory, "out/candidatures.html"),
      `<html><head></head>${scripts}</html>`
    );
    expect(() => runGenerator(directory)).toThrow();
  });
});
