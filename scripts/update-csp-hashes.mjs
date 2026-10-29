/**
 * Velora — génère une CSP par URL dans `out/_headers`.
 *
 * Next.js `output: "export"` injecte des scripts inline (payload RSC/hydratation)
 * DIFFÉRENTS sur chaque page exportée. Une CSP globale `/*` avec les hashes de
 * `index.html` + `404.html` bloque les scripts inline des pages profondes
 * (`/candidatures`, `/calendrier`, …) → l'hydratation React échoue → écran vierge.
 *
 * Ce script :
 * 1. Parcourt récursivement tous les fichiers `.html` de `out/`.
 * 2. Extrait chaque `<script>…</script>` inline de chaque page.
 * 3. Calcule le hash SHA-256 (base64) de chacun.
 * 4. Écrit une règle `_headers` par alias d'URL (ex: `/candidatures`,
 *    `/candidatures/`, `/candidatures.html`) avec la CSP propre à cette page.
 * 5. Injecte une balise `<meta http-equiv="Content-Security-Policy">` dans
 *    `404.html` car Cloudflare sert ce fichier pour N'IMPORTE quelle URL 404 —
 *    la règle `_headers` `/404.html` ne s'applique qu'à l'URL littérale.
 *
 * Contraintes Cloudflare Pages :
 * - Max 2 000 caractères par ligne d'en-tête (vérifié pour chaque règle).
 * - Max 100 règles de chemin (vérifié au total).
 *
 * Sécurité : seuls les scripts inline générés par le build sont autorisés.
 * Aucun `'unsafe-inline'`, aucun `'unsafe-eval'` pour `script-src`.
 * La confidentialité de l'app n'est pas affectée : la CSP contrôle uniquement
 * quels scripts peuvent s'exécuter, pas le stockage ou le chiffrement des données.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "out");
const HEADERS_PATH = join(OUT_DIR, "_headers");

// Limites Cloudflare Pages (https://developers.cloudflare.com/pages/configuration/headers/)
const MAX_HEADER_LINE_LENGTH = 2000;
const MAX_HEADER_RULES = 100;

const INLINE_SCRIPT_RE = /<script>([\s\S]*?)<\/script>/g;

function sha256Base64(content) {
  return createHash("sha256").update(content, "utf8").digest("base64");
}

async function extractHashes(html) {
  const hashes = new Set();
  let match;
  INLINE_SCRIPT_RE.lastIndex = 0;
  while ((match = INLINE_SCRIPT_RE.exec(html)) !== null) {
    const content = match[1];
    if (content.trim().length === 0) continue;
    hashes.add(`'sha256-${sha256Base64(content)}'`);
  }
  return [...hashes];
}

/**
 * Parcourt récursivement un répertoire et retourne tous les fichiers `.html`
 * avec leur chemin relatif (ex: `"candidatures.html"`, `"nested/page/index.html"`).
 */
async function listHtmlFiles(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listHtmlFiles(join(directory, entry.name), relative)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(relative);
    }
  }
  return files.sort();
}

/**
 * Retourne tous les alias d'URL Cloudflare pour un fichier HTML exporté.
 * Cloudflare peut servir `/candidatures`, `/candidatures/`, ou `/candidatures.html`
 * — chacun doit avoir sa propre règle `_headers`.
 */
function urlsFor(file) {
  if (file === "index.html") return ["/", "/index.html"];
  if (file.endsWith("/index.html")) {
    const route = `/${file.slice(0, -"/index.html".length)}`;
    return [route, `${route}/`, `/${file}`];
  }
  const route = `/${file.slice(0, -".html".length)}`;
  return [route, `${route}/`, `/${file}`];
}

/**
 * Construit la chaîne CSP complète pour un ensemble de hashes.
 */
function buildCsp(hashes) {
  const hashList = hashes.join(" ");
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' : autorise WebAssembly (WebLLM) sans autoriser eval() JS.
    // C'est le compromis CSP3 standard pour les moteurs WASM (WebLLM, ONNX, etc.).
    `script-src 'self' 'wasm-unsafe-eval' ${hashList}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // connect-src : Hugging Face pour le téléchargement des modèles WebLLM.
    // Restreint aux hôtes HF uniquement (pas de wildcard ouvert).
    "connect-src 'self' https://huggingface.co https://*.hf.co https://cas-bridge.xethub.hf.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.hf.co",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// En-têtes communs (sans CSP) appliqués globalement via /*
const HEADER_TEMPLATE = `/*
  Cache-Control: no-cache
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/sw.js
  Cache-Control: no-cache

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
  const files = await listHtmlFiles(OUT_DIR);

  // Vérification : l'export doit contenir au minimum index.html et 404.html
  if (!files.includes("index.html") || !files.includes("404.html")) {
    throw new Error("Export incomplet : index.html et 404.html sont requis.");
  }

  const rules = [];
  const seenUrls = new Set();

  for (const file of files) {
    const filePath = join(OUT_DIR, file);
    let html = await readFile(filePath, "utf8");
    const hashes = await extractHashes(html);

    if (hashes.length === 0) {
      throw new Error(`${file} : aucun script inline trouvé — CSP impossible.`);
    }

    const csp = buildCsp(hashes);
    const cspLine = `  Content-Security-Policy: ${csp}`;

    // Vérification : chaque ligne CSP doit respecter la limite Cloudflare
    if (cspLine.length > MAX_HEADER_LINE_LENGTH) {
      throw new Error(
        `${file} : la ligne CSP fait ${cspLine.length} caractères (> ${MAX_HEADER_LINE_LENGTH}).`
      );
    }

    // Génère une règle _headers par alias d'URL
    for (const url of urlsFor(file)) {
      if (seenUrls.has(url)) {
        throw new Error(`URL CSP en double : ${url}`);
      }
      seenUrls.add(url);
      rules.push(`${url}\n${cspLine}\n`);
    }

    // Cas spécial : 404.html est servi par Cloudflare pour N'IMPORTE quelle URL
    // inconnue. La règle _headers `/404.html` ne s'applique qu'à l'URL littérale.
    // On injecte donc une balise <meta http-equiv="Content-Security-Policy">
    // dans le HTML lui-même. `frame-ancestors` n'est pas supporté en meta, on
    // le retire (X-Frame-Options: DENY reste actif via l'en-tête global).
    if (file === "404.html") {
      // Idempotent : supprime une éventuelle balise précédente
      html = html.replace(/<meta data-velora-csp="404"[^>]*>/g, "");
      if (!html.includes("<head>")) {
        throw new Error("404.html : balise <head> introuvable.");
      }
      const metaCsp = csp.replace("; frame-ancestors 'none'", "").replaceAll('"', "&quot;");
      html = html.replace(
        "<head>",
        `<head><meta data-velora-csp="404" http-equiv="Content-Security-Policy" content="${metaCsp}">`
      );
      await writeFile(filePath, html, "utf8");
    }

    console.log(`[csp] ${file}: ${hashes.length} script(s) inline autorisé(s).`);
  }

  // Les règles communes (/*) ne doivent PAS définir de CSP : quand plusieurs
  // règles _headers matchent, les politiques CSP s'intersectent (AND), elles
  // ne se remplacent pas. Une CSP globale sans hashes bloquerait tout.
  const headers = `${HEADER_TEMPLATE}\n${rules.join("\n")}`;

  // Vérification : nombre total de règles Cloudflare
  const ruleCount = headers.split("\n").filter((line) => line.startsWith("/")).length;
  if (ruleCount > MAX_HEADER_RULES) {
    throw new Error(`Limite Cloudflare de ${MAX_HEADER_RULES} règles dépassée (${ruleCount}).`);
  }

  await writeFile(HEADERS_PATH, headers, "utf8");
  console.log(`[csp] ${files.length} page(s) protégée(s), ${ruleCount} règle(s) Cloudflare.`);
}

main().catch((err) => {
  console.error("[csp] Échec:", err);
  process.exit(1);
});
