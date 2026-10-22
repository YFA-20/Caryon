import { test, expect } from "@playwright/test";

/**
 * Velora — E2E : parcours coffre-fort + candidatures.
 *
 * Scénarios :
 * 1. Onboarding : création du coffre (phrase secrète).
 * 2. Création d'une candidature.
 * 3. Persistance après rechargement (nécessite déverrouillage).
 * 4. Déverrouillage avec mauvaise phrase → erreur.
 * 5. Verrouillage manuel.
 */

const PASSPHRASE = "phrase-de-test-e2e-123456";

test.describe("Velora — coffre-fort et candidatures", () => {
  test.beforeEach(async ({ page, context }) => {
    // Nettoie IndexedDB entre les tests
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
    await page.reload();
  });

  test("onboarding : création du coffre puis accès au dashboard", async ({ page }) => {
    await page.goto("/");

    // Écran de création du coffre
    await expect(page.getByRole("heading", { name: /Créer votre coffre-fort/i })).toBeVisible();

    // Remplit le formulaire de création
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();

    // Après création, le dashboard s'affiche
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test("création d'une candidature et affichage dans la liste", async ({ page }) => {
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 15000,
    });

    // Va sur la page candidatures
    await page.goto("/candidatures");
    await expect(page.getByRole("heading", { name: /Mes candidatures/i })).toBeVisible();

    // Ouvre le formulaire
    await page
      .getByRole("button", { name: /Nouvelle candidature/i })
      .first()
      .click();

    // Remplit le formulaire
    await page.getByLabel(/Entreprise/i).fill("Atelier Nova");
    await page.getByLabel(/Poste/i).fill("Développeur front-end");
    await page.getByLabel(/Localisation/i).fill("Paris");
    await page.getByLabel(/Notes personnelles/i).fill("Candidature de test E2E");
    await page.getByRole("button", { name: /Enregistrer/i }).click();

    // Vérifie que la candidature apparaît
    await expect(page.getByText("Atelier Nova")).toBeVisible();
    await expect(page.getByText("Développeur front-end")).toBeVisible();
    await expect(page.getByText("1 candidature enregistrée")).toBeVisible();
  });

  test("persistance : après rechargement, déverrouillage puis données retrouvées", async ({
    page,
  }) => {
    // Crée le coffre et une candidature
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/candidatures");
    await page
      .getByRole("button", { name: /Nouvelle candidature/i })
      .first()
      .click();
    await page.getByLabel(/Entreprise/i).fill("Studio Lumen");
    await page.getByLabel(/Poste/i).fill("Designer UI");
    await page.getByRole("button", { name: /Enregistrer/i }).click();
    await expect(page.getByText("Studio Lumen")).toBeVisible();

    // Recharge la page → le coffre est verrouillé (session en mémoire perdue)
    await page.reload();
    await expect(page.getByRole("heading", { name: /Déverrouiller le coffre/i })).toBeVisible();

    // Déverrouille avec la bonne phrase
    await page.getByLabel(/Phrase secrète/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Déverrouiller/i }).click();

    // Va sur candidatures → la donnée est toujours là
    await page.goto("/candidatures");
    await expect(page.getByText("Studio Lumen")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Designer UI")).toBeVisible();
  });

  test("déverrouillage avec une mauvaise phrase affiche une erreur", async ({ page }) => {
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 15000,
    });

    // Recharge → verrouillé
    await page.reload();
    await expect(page.getByRole("heading", { name: /Déverrouiller le coffre/i })).toBeVisible();

    // Mauvaise phrase
    await page.getByLabel(/Phrase secrète/i).fill("mauvaise-phrase-xxx");
    await page.getByRole("button", { name: /Déverrouiller/i }).click();

    // Erreur affichée
    await expect(page.getByRole("alert")).toContainText(/incorrecte/i);
  });

  test("les autres pages sont accessibles (pas de 404)", async ({ page }) => {
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 15000,
    });

    const pages = [
      { url: "/candidatures", title: "Mes candidatures" },
      { url: "/calendrier", title: "Calendrier" },
      { url: "/documents", title: "Mes documents" },
      { url: "/journal", title: "Journal de recherche" },
      { url: "/analyses", title: "Analyses" },
      { url: "/securite", title: "Sécurité et confidentialité" },
      { url: "/sauvegardes", title: "Sauvegardes" },
      { url: "/parametres", title: "Paramètres" },
    ];

    for (const { url, title } of pages) {
      await page.goto(url);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
    }
  });
});
