import { test, expect } from "@playwright/test";

/**
 * Velora — E2E : parcours coffre-fort + candidatures.
 *
 * Scénarios :
 * 1. Onboarding : création du coffre (phrase secrète).
 * 2. Création d'une candidature.
 * 3. Modification d'une candidature (édition + dates affichées).
 * 4. Persistance après rechargement (nécessite déverrouillage).
 * 5. Déverrouillage avec mauvaise phrase → erreur.
 * 6. Verrouillage manuel → retour à l'écran de connexion.
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
    // Attendre que le VaultGate ait fini sa résolution async (IndexedDB)
    await expect(
      page.getByRole("heading", { name: /Créer votre coffre-fort|Déverrouiller le coffre/ }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test("onboarding : création du coffre puis accès au dashboard", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");

    // Écran de création du coffre (attend l'hydratation)
    await expect(page.getByRole("heading", { name: /Créer votre coffre-fort/i })).toBeVisible({
      timeout: 15000,
    });

    // Remplit le formulaire de création
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }

    // Après création, le dashboard s'affiche
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
    });
  });

  test("création d'une candidature et affichage dans la liste", async ({ page }) => {
    test.setTimeout(60000);
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
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
    test.setTimeout(60000);
    // Crée le coffre et une candidature
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
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
    test.setTimeout(60000);
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
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
    test.setTimeout(60000);
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
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

  test("modification d'une candidature : édition + dates de création/modification", async ({
    page,
  }) => {
    test.setTimeout(60000);
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
    });

    // Crée une candidature
    await page.goto("/candidatures");
    await page
      .getByRole("button", { name: /Nouvelle candidature/i })
      .first()
      .click();
    await page.getByLabel(/Entreprise/i).fill("Atelier Nova");
    await page.getByLabel(/Poste/i).fill("Développeur front-end");
    await page.getByRole("button", { name: /Enregistrer/i }).click();
    await expect(page.getByText("Atelier Nova")).toBeVisible();

    // Vérifie que les dates sont affichées (création + modification)
    await expect(page.getByText(/Créée le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/)).toBeVisible();
    await expect(page.getByText(/Modifiée le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/)).toBeVisible();

    // Clique sur "Modifier"
    await page.getByRole("button", { name: /Modifier/i }).click();

    // Vérifie que le formulaire d'édition est pré-rempli
    await expect(page.getByLabel(/Entreprise/i)).toHaveValue("Atelier Nova");
    await expect(page.getByLabel(/Poste/i)).toHaveValue("Développeur front-end");

    // Vérifie l'affichage des dates dans le formulaire d'édition
    await expect(page.getByText(/Créée le/)).toBeVisible();
    await expect(page.getByText(/Dernière modification le/)).toBeVisible();

    // Modifie le poste et le statut
    await page.getByLabel(/Poste/i).fill("Développeur full-stack");
    await page.getByLabel(/Statut/i).selectOption("envoyee");

    // Enregistre
    await page.getByRole("button", { name: /Enregistrer les modifications/i }).click();

    // Vérifie que la modification est appliquée
    await expect(page.getByText("Développeur full-stack")).toBeVisible();
    await expect(page.getByText("Envoyée")).toBeVisible();
  });

  test("verrouillage manuel retourne à l'écran de connexion", async ({ page }) => {
    test.setTimeout(60000);
    // Crée le coffre
    await page.goto("/");
    await page
      .getByLabel(/Phrase secrète/i)
      .first()
      .fill(PASSPHRASE);
    await page.getByLabel(/Confirmer la phrase/i).fill(PASSPHRASE);
    await page.getByRole("button", { name: /Créer le coffre/i }).click();
    // Saute l'onboarding wizard s'il apparaît
    const skipBtn = page.getByRole("button", { name: "Passer le guide" });
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click();
    }
    await expect(page.getByRole("heading", { name: /Bonjour|Bonne|Bonsoir/i })).toBeVisible({
      timeout: 30000,
    });

    // Vérifie que le badge indique "Coffre déverrouillé"
    await expect(page.getByText("Coffre déverrouillé")).toBeVisible();

    // Clique sur le bouton "Verrouiller"
    await page.getByRole("button", { name: /Verrouiller/i }).click();

    // Vérifie qu'on revient à l'écran de déverrouillage
    await expect(page.getByRole("heading", { name: /Déverrouiller le coffre/i })).toBeVisible();
    await expect(page.getByLabel(/Phrase secrète/i)).toBeVisible();
  });
});
