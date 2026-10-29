// @vitest-environment node
/**
 * Velora — test du serveur statique E2E : la CSP doit être servie PAR CHEMIN.
 *
 * Régression : serve-static.mjs envoyait autrefois la PREMIÈRE CSP trouvée
 * dans `_headers` (celle de `/*`, sans hashes) à TOUTES les pages, ce qui
 * bloquait les scripts inline des pages profondes en E2E (écran vide).
 *
 * Ce test démarre le vrai serveur sur un port libre et vérifie que :
 * - `/candidatures` reçoit une CSP contenant des hashes sha256
 * - `/` reçoit une CSP différente (hashes de index.html)
 * - les deux CSPs sont distinctes
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";

let serverProc: ChildProcess | null = null;
let tmpDir: string;
let outDir: string;
let port: number;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("base64");
}

async function waitForServer(url: string, maxMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Serveur non démarré après ${maxMs}ms sur ${url}`);
}

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "velora-serve-"));
  outDir = join(tmpDir, "out");
  await mkdir(join(outDir, "_next"), { recursive: true });

  // Deux pages avec des scripts inline DIFFÉRENTS (comme Next.js)
  const indexScript = 'self.__next_f.push([1,"home"])';
  const candScript = 'self.__next_f.push([1,"candidatures"])';
  const indexHtml = `<html><head></head><body><script>${indexScript}</script></body></html>`;
  const candHtml = `<html><head></head><body><script>${candScript}</script></body></html>`;

  await writeFile(join(outDir, "index.html"), indexHtml);
  await writeFile(join(outDir, "candidatures.html"), candHtml);

  // _headers avec CSP par chemin (format Cloudflare)
  const indexCsp = `default-src 'self'; script-src 'self' 'sha256-${sha256(indexScript)}'`;
  const candCsp = `default-src 'self'; script-src 'self' 'sha256-${sha256(candScript)}'`;
  const headers = `/*
  Cache-Control: no-cache

/candidatures
  Content-Security-Policy: ${candCsp}

/candidatures/
  Content-Security-Policy: ${candCsp}

/candidatures.html
  Content-Security-Policy: ${candCsp}

/
  Content-Security-Policy: ${indexCsp}

/index.html
  Content-Security-Policy: ${indexCsp}
`;
  await writeFile(join(outDir, "_headers"), headers);

  // Démarre le serveur depuis le tmpDir (il sert ./out)
  port = 3900 + Math.floor(Math.random() * 500);
  serverProc = spawn("node", [join(process.cwd(), "scripts/serve-static.mjs")], {
    cwd: tmpDir,
    env: { ...process.env, VELORA_TEST_PORT: String(port) },
    stdio: "pipe",
  });
  await waitForServer(`http://127.0.0.1:${port}/`);
}, 30_000);

afterAll(async () => {
  serverProc?.kill("SIGTERM");
  await rm(tmpDir, { recursive: true, force: true });
});

describe("serve-static — CSP par chemin", () => {
  it("/candidatures reçoit la CSP avec le hash de candidatures.html", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/candidatures`);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(`sha256-${sha256('self.__next_f.push([1,"candidatures"])')}`);
    expect(csp).not.toContain(`sha256-${sha256('self.__next_f.push([1,"home"])')}`);
  });

  it("/ reçoit la CSP avec le hash de index.html", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain(`sha256-${sha256('self.__next_f.push([1,"home"])')}`);
  });

  it("/candidatures et / ont des CSP différentes", async () => {
    const res1 = await fetch(`http://127.0.0.1:${port}/candidatures`);
    const res2 = await fetch(`http://127.0.0.1:${port}/`);
    const csp1 = res1.headers.get("Content-Security-Policy") ?? "";
    const csp2 = res2.headers.get("Content-Security-Policy") ?? "";
    expect(csp1).not.toBe(csp2);
  });

  it("/candidatures.html (accès direct au fichier) reçoit aussi la bonne CSP", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/candidatures.html`);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("sha256-");
  });
});
