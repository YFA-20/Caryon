import { expect, type BrowserContext, type Page } from "@playwright/test";

/**
 * Helpers E2E partagés : reset du stockage local + création du coffre.
 *
 * Piège historique : après `createVault()`, Argon2id (64 MiB, t=3) prend
 * plusieurs secondes avant que le wizard d'onboarding n'apparaisse. Un
 * `isVisible({ timeout: 5000 })` rate systématiquement sur les runners CI
 * lents, le dialog bloque ensuite tous les clics (aria-modal) et les tests
 * échouent en cascade. On attend donc le dialog avec un vrai expect.
 */
export const E2E_PASSPHRASE = "phrase-de-test-e2e-123456";

/** Supprime cookies + IndexedDB + sessionStorage, recharge, attend le portail. */
export async function resetStorage(page: Page, context: BrowserContext) {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => {
    sessionStorage.clear();
    return new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("velora");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Créer votre coffre-fort|Déverrouiller le coffre/ }).first()
  ).toBeVisible({ timeout: 15_000 });
}

/** Crée le coffre via l'UI, saute le wizard d'onboarding, attend le dashboard. */
export async function createVaultAndUnlock(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Créer votre coffre-fort" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel("Phrase secrète").first().fill(E2E_PASSPHRASE);
  await page.getByLabel("Confirmer la phrase").fill(E2E_PASSPHRASE);
  await page.getByRole("button", { name: "Créer le coffre" }).click();
  // Le wizard apparaît après le KDF : on l'attend explicitement (pas de isVisible).
  const skipBtn = page.getByRole("button", { name: "Passer le guide" });
  await expect(skipBtn).toBeVisible({ timeout: 30_000 });
  await skipBtn.click();
  await expect(page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })).toBeVisible(
    { timeout: 30_000 }
  );
}

/**
 * Simule une fermeture d'onglet (sessionStorage vidé) puis recharge :
 * la session persistée disparaît, le coffre redevient verrouillé.
 */
export async function closeTabAndReload(page: Page) {
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByRole("heading", { name: /Déverrouiller le coffre/i })).toBeVisible({
    timeout: 15_000,
  });
}

/** Libellé du lien de navigation pour une URL de page. */
const NAV_LABELS: Record<string, string> = {
  "/candidatures": "Mes candidatures",
  "/calendrier": "Calendrier",
  "/documents": "Mes documents",
  "/journal": "Journal de recherche",
  "/analyses": "Analyses",
  "/securite": "Sécurité et confidentialité",
  "/sauvegardes": "Sauvegardes",
  "/parametres": "Paramètres",
};

/**
 * Navigue vers une page profonde puis garantit qu'elle est déverrouillée.
 * Utilise la navigation client (lien sidebar/drawer) plutôt que page.goto :
 * un goto direct recharge le HTML, la restauration de session (sessionStorage
 * → IndexedDB → déchiffrement) peut dépasser le délai d'hydratation en CI lent,
 * et VaultGate retombe sur le portail. La navigation client garde la session
 * en mémoire vive, comme un vrai utilisateur qui clique dans la sidebar.
 */
export async function gotoUnlocked(
  page: Page,
  url: string,
  heading: string | RegExp
): Promise<void> {
  await page.goto("/");
  // Dashboard déverrouillé (session restaurée ou mémoire vive)
  await expect(page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })).toBeVisible(
    { timeout: 30_000 }
  );
  // Navigation client via le lien de la sidebar (desktop) ou du drawer (mobile)
  const label = NAV_LABELS[url];
  if (!label) throw new Error(`Pas de libellé de navigation pour ${url}`);
  await page.getByRole("link", { name: label, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`${url}$`));
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
}
