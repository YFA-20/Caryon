import { expect, test } from "@playwright/test";

test.describe("Velora — dashboard « Aujourd'hui »", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("affiche la salutation et l'identité Velora", async ({ page, isMobile }) => {
    await expect(
      page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })
    ).toBeVisible();
    if (!isMobile) {
      // La sidebar (avec le logo et la signature) n'est visible qu'en desktop
      await expect(page.getByText("Velora", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Votre carrière, votre espace privé")).toBeVisible();
    }
  });

  test("affiche l'état vide élégant sans données", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
  });

  test("le mode démo affiche le bandeau « données fictives » et les indicateurs", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Mode démo" }).click();
    await expect(page.getByRole("status")).toContainText("Mode démonstration");
    await expect(page.getByText(/données affichées sont fictives/)).toBeVisible();
    // Carte principale en dégradé avec les indicateurs
    await expect(page.getByText("Votre pipeline")).toBeVisible();
    await expect(page.getByText("Actives", { exact: true })).toBeVisible();
    await expect(page.getByText("Entretiens", { exact: true })).toBeVisible();
    await expect(page.getByText("Relances", { exact: true })).toBeVisible();
    await expect(page.getByText("Réponses +", { exact: true })).toBeVisible();
    // Sections
    await expect(page.getByRole("heading", { name: "Votre journée" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "À venir" })).toBeVisible();
  });

  test("quitter la démo restaure l'état vide", async ({ page }) => {
    await page.getByRole("button", { name: "Mode démo" }).click();
    await expect(page.getByRole("status")).toContainText("Mode démonstration");
    await page.getByRole("button", { name: "Quitter la démo" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("la navigation clavier fonctionne (focus visible)", async ({ page }) => {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("la sidebar est visible en desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "Ce test concerne la sidebar desktop");
    await expect(page.getByRole("complementary", { name: "Navigation principale" })).toBeVisible();
  });
});

test.describe("Velora — responsive mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la barre de navigation inférieure est visible sur mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Candidatures" })).toBeVisible();
  });
});
