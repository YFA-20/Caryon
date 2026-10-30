import { test, expect } from "@playwright/test";
import {
  E2E_PASSPHRASE,
  closeTabAndReload,
  createVaultAndUnlock,
  gotoUnlocked,
  resetStorage,
} from "./helpers";

/**
 * Velora — E2E : parcours coffre-fort + candidatures.
 *
 * Scénarios :
 * 1. Onboarding : création du coffre (phrase secrète).
 * 2. Création d'une candidature.
 * 3. Modification d'une candidature (édition + dates affichées).
 * 4. Persistance après fermeture d'onglet (nécessite déverrouillage).
 * 5. Déverrouillage avec mauvaise phrase → erreur.
 * 6. Verrouillage manuel → retour à l'écran de connexion.
 */

test.describe("Velora — coffre-fort et candidatures", () => {
  test.beforeEach(async ({ page, context }) => {
    await resetStorage(page, context);
  });

  test("onboarding : création du coffre puis accès au dashboard", async ({ page }) => {
    test.setTimeout(120000);
    await createVaultAndUnlock(page);
  });

  test("création d'une candidature et affichage dans la liste", async ({ page }) => {
    test.setTimeout(120000);
    // Crée le coffre puis navigue vers candidatures via la sidebar
    await createVaultAndUnlock(page);
    await gotoUnlocked(page, "/candidatures", /Mes candidatures/i);

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

  test("persistance : après fermeture d'onglet, déverrouillage puis données retrouvées", async ({
    page,
  }) => {
    test.setTimeout(150000);
    await createVaultAndUnlock(page);

    await gotoUnlocked(page, "/candidatures", /Mes candidatures/i);
    await page
      .getByRole("button", { name: /Nouvelle candidature/i })
      .first()
      .click();
    await page.getByLabel(/Entreprise/i).fill("Studio Lumen");
    await page.getByLabel(/Poste/i).fill("Designer UI");
    await page.getByRole("button", { name: /Enregistrer/i }).click();
    await expect(page.getByText("Studio Lumen")).toBeVisible();

    // Fermeture d'onglet (sessionStorage vidé) → le coffre est verrouillé
    await closeTabAndReload(page);

    // Déverrouille avec la bonne phrase. On reste sur /candidatures : après
    // déverrouillage, VaultGate rend les enfants sans changer d'URL (fix F5),
    // le heading « Mes candidatures » apparaît directement.
    await page.getByLabel(/Phrase secrète/i).fill(E2E_PASSPHRASE);
    await page.getByRole("button", { name: /Déverrouiller/i }).click();
    await expect(page.getByRole("heading", { name: /Mes candidatures/i }).first()).toBeVisible({
      timeout: 30_000,
    });

    // Va sur candidatures via la sidebar → la donnée est toujours là
    await gotoUnlocked(page, "/candidatures", /Mes candidatures/i);
    await expect(page.getByText("Studio Lumen")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Designer UI")).toBeVisible();
  });

  test("déverrouillage avec une mauvaise phrase affiche une erreur", async ({ page }) => {
    test.setTimeout(150000);
    await createVaultAndUnlock(page);

    // Fermeture d'onglet → verrouillé
    await closeTabAndReload(page);

    // Mauvaise phrase
    await page.getByLabel(/Phrase secrète/i).fill("mauvaise-phrase-xxx");
    await page.getByRole("button", { name: /Déverrouiller/i }).click();

    // Erreur affichée (le route-announcer de Next a aussi role="alert", on cible le texte)
    await expect(page.getByText(/Phrase secrète incorrecte/i)).toBeVisible();
  });

  test("les autres pages sont accessibles (pas de 404)", async ({ page }) => {
    test.setTimeout(150000);
    await createVaultAndUnlock(page);

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
      await gotoUnlocked(page, url, title);
    }
  });

  test("modification d'une candidature : édition + dates de création/modification", async ({
    page,
  }) => {
    test.setTimeout(150000);
    await createVaultAndUnlock(page);

    // Crée une candidature
    await gotoUnlocked(page, "/candidatures", /Mes candidatures/i);
    await page
      .getByRole("button", { name: /Nouvelle candidature/i })
      .first()
      .click();
    await page.getByLabel(/Entreprise/i).fill("Atelier Nova");
    await page.getByLabel(/Poste/i).fill("Développeur front-end");
    await page.getByRole("button", { name: /Enregistrer/i }).click();
    await expect(page.getByText("Atelier Nova")).toBeVisible();

    // Les dates complètes ne sont affichées que dans le formulaire d'édition
    // (la carte kanban n'affiche que la date courte) : on ouvre le formulaire.
    await page
      .getByRole("button", { name: /Modifier/i })
      .first()
      .click();
    await expect(page.getByText(/Créée le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)).toBeVisible();
    await expect(
      page.getByText(/Dernière modification le \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/)
    ).toBeVisible();

    // Vérifie que le formulaire d'édition est pré-rempli
    await expect(page.getByLabel(/Entreprise/i)).toHaveValue("Atelier Nova");
    await expect(page.getByLabel(/Poste/i)).toHaveValue("Développeur front-end");

    // Modifie le poste et le statut
    await page.getByLabel(/Poste/i).fill("Développeur full-stack");
    await page.getByLabel(/Statut/i).selectOption("envoyee");

    // Enregistre
    await page.getByRole("button", { name: /Enregistrer les modifications/i }).click();

    // Vérifie que la modification est appliquée
    await expect(page.getByText("Développeur full-stack")).toBeVisible();
    await expect(page.getByText("Envoyée")).toBeVisible();
  });

  test("verrouillage manuel retourne à l'écran de connexion", async ({ page, isMobile }) => {
    test.setTimeout(120000);
    await createVaultAndUnlock(page);

    // Vérifie que le badge indique "Coffre déverrouillé" (sidebar desktop uniquement)
    if (!isMobile) {
      await expect(page.getByText("Coffre déverrouillé").first()).toBeVisible({ timeout: 10_000 });
    }

    // Clique sur le bouton "Verrouiller"
    await page.getByRole("button", { name: /Verrouiller/i }).click();

    // Vérifie qu'on revient à l'écran de déverrouillage
    await expect(page.getByRole("heading", { name: /Déverrouiller le coffre/i })).toBeVisible();
    await expect(page.getByLabel(/Phrase secrète/i)).toBeVisible();
  });
});
