import { expect, test } from "@playwright/test";

test.describe("Velora — smoke", () => {
  test("la page d'accueil se charge avec l'identité Velora", async ({ page, isMobile }) => {
    test.setTimeout(30000);
    await page.goto("/");
    // Attendre l'hydratation : le VaultGate résout async (vaultExists) puis affiche
    // soit le portail de connexion, soit l'app. On attend le titre de la page de connexion
    // (cas no-vault en E2E, IndexedDB vide) avant de vérifier quoi que ce soit.
    await expect(
      page
        .getByRole("heading", {
          name: /Créer votre coffre-fort|Déverrouiller le coffre|Bonjour|Bonsoir|Bonne après-midi/,
        })
        .first()
    ).toBeVisible({ timeout: 15000 });
    if (!isMobile) {
      await expect(page.getByText("Velora", { exact: true }).first()).toBeVisible();
    }
  });

  test("le manifest PWA est servi", async ({ page }) => {
    test.setTimeout(30000);
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.ok()).toBe(true);
    const manifest = await response?.json();
    expect(manifest.name).toContain("Velora");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#191119");
  });

  test("les en-têtes de sécurité sont présents", async ({ page }) => {
    test.setTimeout(30000);
    const response = await page.goto("/");
    const headers = response?.headers() ?? {};
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  test("la CSP servie par le serveur de test est stricte et par page", async ({ page }) => {
    // Vérifie que le serveur local applique bien une CSP par chemin (comme Cloudflare)
    // avec des hashes sha256 et sans unsafe-inline pour script-src.
    const res = await page.goto("/");
    const csp = res?.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("sha256-");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    // La CSP de /candidatures doit contenir des hashes différents de ceux de /
    const res2 = await page.goto("/candidatures");
    const csp2 = res2?.headers()["content-security-policy"] ?? "";
    expect(csp2).toContain("sha256-");
    expect(csp2).not.toBe(csp);
  });

  test("le service worker est servi", async ({ page }) => {
    test.setTimeout(30000);
    const response = await page.goto("/sw.js");
    expect(response?.ok()).toBe(true);
  });

  test("aucun appel réseau externe n'est émis au chargement", async ({ page }) => {
    test.setTimeout(30000);
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
