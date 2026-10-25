/**
 * Velora — met à jour la CSP avec les hashes des scripts inline de Next.js.
 *
 * Next.js `output: "export"` injecte des scripts inline (payload RSC/hydratation).
 * Une CSP stricte `script-src 'self'` les bloque → page blanche intermittente.
 *
 * Ce script :
 * 1. Lit `out/index.html` (et `out/404.html`).
 * 2. Extrait chaque `<script>...</script>` inline.
 * 3. Calcule le hash SHA-256 (base64) de chacun.
 * 4. Réécrit `out/_headers` avec `script-src 'self' 'sha256-...'`.
 *
 * Sécurité : seuls les scripts inline générés par le build sont autorisés.
 * Aucun `'unsafe-inline'`, aucun `eval` autorisé.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "out");
const HEADERS_PATH = join(OUT_DIR, "_headers");

const INLINE_SCRIPT_RE = /<script>([\s\S]*?)<\/script>/g;

function sha256Base64(content) {
  return createHash("sha256").update(content, "utf8").digest("base64");
}

async function extractHashes(html) {
  const hashes = new Set();
  let match;
  while ((match = INLINE_SCRIPT_RE.exec(html)) !== null) {
    const content = match[1];
    if (content.trim().length === 0) continue;
    hashes.add(`'sha256-${sha256Base64(content)}'`);
  }
  return [...hashes];
}

const HEADER_TEMPLATE = `/*
  Cache-Control: no-cache
  Content-Security-Policy: __CSP__
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/manifest.webmanifest
  Cache-Control: no-cache

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/icons/*
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable
`;

async function main() {
  const allHashes = new Set();

  for (const file of ["index.html", "404.html"]) {
    const path = join(OUT_DIR, file);
    let html;
    try {
      html = await readFile(path, "utf8");
    } catch {
      console.warn(`[csp] ${file} introuvable, ignoré.`);
      continue;
    }
    const hashes = await extractHashes(html);
    console.log(`[csp] ${file}: ${hashes.length} script(s) inline hashé(s).`);
    for (const h of hashes) allHashes.add(h);
  }

  if (allHashes.size === 0) {
    console.error("[csp] ERREUR: aucun script inline trouvé — la CSP ne serait pas mise à jour.");
    process.exit(1);
  }

  const hashList = [...allHashes].join(" ");
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashList}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    // worker-src retiré : plus de Service Worker (fix écrans vierges F5)
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = HEADER_TEMPLATE.replace("__CSP__", csp);
  await writeFile(HEADERS_PATH, headers, "utf8");
  console.log(`[csp] _headers mis à jour avec ${allHashes.size} hash(es) SHA-256.`);
  console.log(`[csp] CSP: ${csp}`);
}

main().catch((err) => {
  console.error("[csp] Échec:", err);
  process.exit(1);
});
