import { expect, test } from "@playwright/test";

test.describe("Velora — smoke", () => {
  test("la page d'accueil se charge avec l'identité Velora", async ({ page, isMobile }) => {
    await page.goto("/");
    if (!isMobile) {
      // Le logo « V » + le nom Velora + la signature sont dans la sidebar (desktop)
      await expect(page.getByText("Velora", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Votre carrière, votre espace privé")).toBeVisible();
    } else {
      // En mobile, la barre inférieure est présente
      await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
    }
  });

  test("le manifest PWA est servi", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.ok()).toBe(true);
    const manifest = await response?.json();
    expect(manifest.name).toContain("Velora");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#191119");
  });

  test("les en-têtes de sécurité sont présents", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("la CSP de production (public/_headers) est stricte", async () => {
    // Vérifie le fichier _headers déployé sur Cloudflare : script-src 'self' sans unsafe-inline.
    const { readFileSync } = await import("node:fs");
    const headers = readFileSync("public/_headers", "utf-8");
    const cspLine = headers
      .split("\n")
      .find((l) => l.trim().startsWith("Content-Security-Policy:"));
    expect(cspLine).toBeTruthy();
    expect(cspLine).toContain("script-src 'self'");
    expect(cspLine).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test("le service worker est servi", async ({ page }) => {
    const response = await page.goto("/sw.js");
    expect(response?.ok()).toBe(true);
  });

  test("aucun appel réseau externe n'est émis au chargement", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== "http://127.0.0.1:3100") {
        external.push(request.url());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Seules les requêtes de polices Google peuvent être émises (documentées) ;
    // aucune donnée utilisateur ni télémétrie ne doit partir.
    const nonFont = external.filter((u) => !u.includes("fonts.g"));
    expect(nonFont).toEqual([]);
  });
});
