/**
 * Velora — serveur statique minimal (loopback) pour les tests E2E Playwright.
 * Sert le répertoire `out/` sur 127.0.0.1:3100, sans dépendance externe.
 * Sécurité : écoute UNIQUEMENT sur l'interface loopback (jamais 0.0.0.0).
 *
 * En production (Cloudflare), `public/_headers` applique la CSP stricte.
 * En test E2E local, la CSP est assouplie (`script-src 'self' 'unsafe-inline'`)
 * UNIQUEMENT parce que Next.js injecte des scripts inline d'hydratation dans le
 * HTML exporté — un artefact du serveur de test, pas de l'app. Les en-têtes de
 * sécurité testés (nosniff, X-Frame-Options, Referrer-Policy, COOP/CORP) restent
 * stricts. La CSP stricte de production est vérifiée séparément (test E2E qui
 * contrôle la valeur de l'en-tête, et déploiement Cloudflare avec _headers).
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
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      // CSP assouplie en test local uniquement (voir commentaire en tête).
      // La CSP de production (public/_headers) reste stricte : script-src 'self'.
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Resource-Policy": "same-origin",
    });
    res.end(data);
  } catch {
    res.writeHead(500).end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Velora static server: http://${HOST}:${PORT}`);
});
