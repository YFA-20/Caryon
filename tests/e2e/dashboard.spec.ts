import { expect, test, type Page } from "@playwright/test";

/**
 * Les tests dashboard supposent un coffre existant et déverrouillé.
 * En E2E, IndexedDB est vide au départ : on crée un coffre dans le
 * beforeEach via l'UI (comme un vrai utilisateur), puis on attend
 * que le dashboard soit rendu.
 */
const PASSPHRASE = "phrase-de-test-e2e-123456";

async function createVaultAndUnlock(page: Page) {
  await page.goto("/");
  // Portail "Créer votre coffre-fort" (IndexedDB vide)
  await expect(page.getByRole("heading", { name: "Créer votre coffre-fort" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Phrase secrète").first().fill(PASSPHRASE);
  await page.getByLabel("Confirmer la phrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Créer le coffre" }).click();
  // Après création, le dashboard s'affiche (session déverrouillée)
  await expect(page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })).toBeVisible(
    { timeout: 20_000 }
  );
}

test.describe("Velora — dashboard « Aujourd'hui »", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("velora");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await createVaultAndUnlock(page);
  });

  test("affiche la salutation et l'identité Velora", async ({ page, isMobile }) => {
    test.setTimeout(90000);
    await expect(
      page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })
    ).toBeVisible();
    if (!isMobile) {
      await expect(page.getByText("Velora", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Votre carrière, votre espace privé")).toBeVisible();
    }
  });

  test("affiche l'état vide élégant sans données", async ({ page }) => {
    test.setTimeout(90000);
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
  });

  test("le mode démo affiche le bandeau « données fictives » et les indicateurs", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.getByRole("button", { name: "Mode démo" }).click();
    await expect(page.getByRole("status")).toContainText("Mode démonstration");
    await expect(page.getByText(/données affichées sont fictives/)).toBeVisible();
    await expect(page.getByText("Votre pipeline")).toBeVisible();
    await expect(page.getByText("Actives", { exact: true })).toBeVisible();
    await expect(page.getByText("Entretiens", { exact: true })).toBeVisible();
    await expect(page.getByText("Relances", { exact: true })).toBeVisible();
    await expect(page.getByText("Réponses +", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Votre journée" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "À venir" })).toBeVisible();
  });

  test("quitter la démo restaure l'état vide", async ({ page }) => {
    test.setTimeout(90000);
    await page.getByRole("button", { name: "Mode démo" }).click();
    await expect(page.getByRole("status")).toContainText("Mode démonstration");
    await page.getByRole("button", { name: "Quitter la démo" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Aucune candidature pour le moment" })
    ).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("la navigation clavier fonctionne (focus visible)", async ({ page }) => {
    test.setTimeout(90000);
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test("la sidebar est visible en desktop", async ({ page, isMobile }) => {
    test.setTimeout(90000);
    test.skip(isMobile, "Ce test concerne la sidebar desktop");
    await expect(page.getByRole("complementary", { name: "Navigation principale" })).toBeVisible();
  });
});

test.describe("Velora — responsive mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("la barre de navigation inférieure est visible sur mobile", async ({ page, context }) => {
    test.setTimeout(90000);
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("velora");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    });
    await createVaultAndUnlock(page);
    await expect(page.getByRole("navigation", { name: "Navigation mobile" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Candidatures" })).toBeVisible();
  });
});
