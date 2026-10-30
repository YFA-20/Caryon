import { expect, test } from "@playwright/test";

test.describe("Velora — smoke", () => {
  test("la page d'accueil se charge avec l'identité Velora", async ({ page }) => {
    test.setTimeout(30000);
    await page.goto("/");
    // Attendre l'hydratation du VaultGate (IndexedDB vide en E2E = portail "Créer")
    await expect(
      page.getByRole("heading", { name: /Créer votre coffre-fort|Déverrouiller le coffre/ }).first()
    ).toBeVisible({ timeout: 15000 });
    // La marque Velora est dans le <title> de la page
    await expect(page).toHaveTitle(/Velora/);
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

  test("la CSP servie est stricte et par page (hashes sha256, pas d'unsafe-inline en script-src)", async ({
    page,
  }) => {
    test.setTimeout(30000);
    const res = await page.goto("/");
    const csp = res?.headers()["content-security-policy"] ?? "";
    const scriptSrc = csp.match(/script-src[^;]+/)?.[0] ?? "";
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("sha256-");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    // CSP différente sur une page profonde
    const res2 = await page.goto("/candidatures");
    const csp2 = res2?.headers()["content-security-policy"] ?? "";
    expect(csp2).toContain("sha256-");
    expect(csp2).not.toBe(csp);
  });

  test("aucun service worker n'est servi (supprimé, voir PR #27)", async ({ page }) => {
    const response = await page.goto("/sw.js");
    // Le serveur statique sert le fallback SPA (index.html) avec 200, mais ce
    // n'est PAS un service worker : on vérifie le Content-Type (HTML, pas JS).
    expect(response?.ok()).toBe(true);
    expect(response?.headers()["content-type"] ?? "").toContain("text/html");
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
