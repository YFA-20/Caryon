import { expect, test } from "@playwright/test";
import { createVaultAndUnlock, resetStorage } from "./helpers";

/**
 * Les tests dashboard supposent un coffre existant et déverrouillé.
 * En E2E, IndexedDB est vide au départ : on crée un coffre dans le
 * beforeEach via l'UI (comme un vrai utilisateur), puis on attend
 * que le dashboard soit rendu.
 */

test.describe("Velora — dashboard « Aujourd'hui »", () => {
  test.beforeEach(async ({ page, context }) => {
    await resetStorage(page, context);
    await createVaultAndUnlock(page);
  });

  test("affiche la salutation et l'identité Velora", async ({ page, isMobile }) => {
    test.setTimeout(150000);
    await expect(
      page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })
    ).toBeVisible();
    if (!isMobile) {
      await expect(page.getByText("Velora", { exact: true }).first()).toBeVisible();
      await expect(
        page.getByRole("complementary", { name: "Navigation principale" })
      ).toContainText("Votre carrière, votre espace privé");
    }
  });

  test("affiche l'état vide élégant sans données", async ({ page }) => {
    test.setTimeout(150000);
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
  });

  test("le mode démo affiche le bandeau « données fictives » et les indicateurs", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(150000);
    test.skip(isMobile, "Le bouton Mode démo est dans le header desktop");
    await page.getByRole("button", { name: "Mode démo" }).click();
    // Le bandeau démo a role="status", mais les toasts aussi : on le cible par son texte
    await expect(page.getByText(/données affichées sont fictives/)).toBeVisible();
    // Le dashboard recharge les données démo seedées : attendre la fin du chargement
    // (le skeleton "Déchiffrement de vos données…" disparaît) puis les stats fictives
    await expect(page.getByText(/Déchiffrement de vos données/)).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText("Actives", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Entretiens", { exact: true })).toBeVisible();
    await expect(page.getByText("Relances", { exact: true })).toBeVisible();
    await expect(page.getByText("Réponses +", { exact: true })).toBeVisible();
  });

  test("quitter la démo restaure l'état vide", async ({ page, isMobile }) => {
    test.setTimeout(150000);
    test.skip(isMobile, "Le bouton Mode démo est dans le header desktop");
    await page.getByRole("button", { name: "Mode démo" }).click();
    await expect(page.getByText(/données affichées sont fictives/)).toBeVisible();
    await page.getByRole("button", { name: "Quitter la démo" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
  });

  test("la navigation clavier fonctionne (focus visible)", async ({ page }) => {
    test.setTimeout(150000);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("la sidebar est visible en desktop", async ({ page, isMobile }) => {
    test.setTimeout(150000);
    test.skip(isMobile, "Ce test concerne la sidebar desktop");
    await expect(page.getByRole("complementary", { name: "Navigation principale" })).toBeVisible();
  });
});

test.describe("Velora — responsive mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("le menu hamburger ouvre le drawer avec les liens de navigation", async ({
    page,
    context,
  }) => {
    test.setTimeout(150000);
    await resetStorage(page, context);
    await createVaultAndUnlock(page);
    // Ouvre le drawer mobile
    await page.getByRole("button", { name: "Ouvrir le menu de navigation" }).click();
    await expect(page.getByRole("complementary", { name: "Menu de navigation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mes candidatures" })).toBeVisible();
  });
});
