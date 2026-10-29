/**
 * Velora — serveur statique minimal (loopback) pour les tests E2E Playwright.
 * Sert le répertoire `out/` sur 127.0.0.1:3100, sans dépendance externe.
 * Sécurité : écoute UNIQUEMENT sur l'interface loopback (jamais 0.0.0.0).
 *
 * La CSP est lue depuis `out/_headers` (générée par postbuild) EN RESPECTANT
 * LES RÈGLES PAR CHEMIN comme Cloudflare Pages : chaque page a sa propre CSP
 * avec les hashes SHA-256 de ses scripts inline. Le global `/*` ne définit
 * pas de CSP (sinon il bloquerait les pages profondes par intersection AND).
 * Si `_headers` est absent, fallback sur une CSP stricte sans 'unsafe-inline'.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(process.cwd(), "out");
const PORT = Number(process.env.VELORA_TEST_PORT ?? 3100);
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const FALLBACK_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * Parse `out/_headers` en règles par chemin, comme Cloudflare Pages.
 * Retourne une Map<path, cspString>.
 */
async function loadCspRules() {
  try {
    const raw = await readFile(join(ROOT, "_headers"), "utf8");
    const rules = new Map();
    let currentPath = null;
    for (const line of raw.split("\n")) {
      if (line.startsWith("/")) {
        currentPath = line.trim();
      } else if (line.trim().startsWith("Content-Security-Policy:") && currentPath) {
        rules.set(currentPath, line.replace("Content-Security-Policy:", "").trim());
      }
    }
    if (rules.size > 0) return rules;
  } catch {
    // fallback ci-dessous
  }
  return new Map([["/*", FALLBACK_CSP]]);
}

const CSP_RULES = await loadCspRules();
console.log(`[serve-static] ${CSP_RULES.size} règle(s) CSP _headers chargée(s).`);

/**
 * Retourne la CSP applicable à un chemin, en essayant les alias Cloudflare :
 * /chemin, /chemin/, /chemin.html, /chemin/index.html, puis /* en fallback.
 */
function cspForPath(pathname) {
  const candidates = [
    pathname,
    `${pathname}/`,
    `${pathname}.html`,
    `${pathname}/index.html`,
    "/",
    "/*",
  ];
  for (const c of candidates) {
    const csp = CSP_RULES.get(c);
    if (csp) return csp;
  }
  // Dernier recours : première règle avec CSP
  for (const csp of CSP_RULES.values()) return csp;
  return FALLBACK_CSP;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const filePath = normalize(join(ROOT, pathname));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    let data;
    try {
      data = await readFile(filePath);
    } catch {
      data = await readFile(join(ROOT, "index.html"));
    }
    const headers = {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": cspForPath(pathname),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    };
    res.writeHead(200, headers);
    res.end(data);
  } catch {
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Velora static server: http://${HOST}:${PORT}`);
});
