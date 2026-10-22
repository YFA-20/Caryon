/**
 * Velora — test de cohérence CSP / scripts inline.
 *
 * Garantit que `out/_headers` contient les hashes SHA-256 de TOUS les scripts
 * inline présents dans `out/index.html` et `out/404.html`. Sans cela, la CSP
 * `script-src 'self'` bloquerait l'hydratation React → page blanche.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "out");
const SKIP = !existsSync(join(OUT_DIR, "_headers"));

function extractInlineScripts(html: string): string[] {
  const re = /<script>([\s\S]*?)<\/script>/g;
  const scripts: string[] = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    const content = match[1];
    if (content && content.trim().length > 0) scripts.push(content);
  }
  return scripts;
}

function extractCspHashes(headers: string): string[] {
  const re = /'sha256-([^']+)'/g;
  const hashes: string[] = [];
  let match;
  while ((match = re.exec(headers)) !== null) {
    const hash = match[1];
    if (hash) hashes.push(hash);
  }
  return hashes;
}

function sha256Base64(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("base64");
}

function readCsp(): string {
  const headers = readFileSync(join(OUT_DIR, "_headers"), "utf8");
  const cspMatch = headers.match(/Content-Security-Policy:\s*(.+)/);
  return cspMatch?.[1]?.trim() ?? "";
}

describe.skipIf(SKIP)("CSP — hashes des scripts inline", () => {
  let cspHashes: string[];

  beforeAll(() => {
    const headers = readFileSync(join(OUT_DIR, "_headers"), "utf8");
    cspHashes = extractCspHashes(headers);
  });

  it("_headers contient au moins un hash SHA-256", () => {
    expect(cspHashes.length).toBeGreaterThan(0);
  });

  it("tous les scripts inline de index.html sont autorisés", () => {
    const html = readFileSync(join(OUT_DIR, "index.html"), "utf8");
    const scripts = extractInlineScripts(html);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const hash = sha256Base64(script);
      expect(cspHashes).toContain(hash);
    }
  });

  it("tous les scripts inline de 404.html sont autorisés", () => {
    const html = readFileSync(join(OUT_DIR, "404.html"), "utf8");
    const scripts = extractInlineScripts(html);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const hash = sha256Base64(script);
      expect(cspHashes).toContain(hash);
    }
  });

  it("la CSP ne contient pas 'unsafe-inline' pour script-src", () => {
    const csp = readCsp();
    const scriptSrcMatch = csp.match(/script-src ([^;]+)/);
    expect(scriptSrcMatch).not.toBeNull();
    const scriptSrc = scriptSrcMatch?.[1] ?? "";
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("la CSP contient les directives de sécurité essentielles", () => {
    const headers = readFileSync(join(OUT_DIR, "_headers"), "utf8");
    expect(headers).toContain("X-Content-Type-Options: nosniff");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("Referrer-Policy: no-referrer");
    expect(headers).toContain("object-src 'none'");
    expect(headers).toContain("frame-ancestors 'none'");
  });
});
