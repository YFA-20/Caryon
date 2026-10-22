import type { NextConfig } from "next";

/**
 * Velora — configuration Next.js (sortie statique exportée pour Cloudflare Pages).
 *
 * Sécurité :
 * - `output: "export"` : frontend 100 % statique, aucune exécution serveur applicatif,
 *   surface d'attaque réduite au CDN (conforme au cahier des charges §8).
 * - En-têtes de sécurité injectés via `headers()` (appliqués par le CDN Cloudflare ;
 *   duplication recommandée dans `_headers` pour Cloudflare Pages).
 * - `trailingSlash: false` + `skipTrailingSlashRedirect` pour un routage PWA stable.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
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
              "upgrade-insecure-requests",
            ].join("; "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
