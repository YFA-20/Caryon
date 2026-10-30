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
    // Ferme d'abord toutes les connexions ouvertes (Dexie) sinon deleteDatabase
    // reste bloqué en onblocked et la base n'est jamais supprimée.
    return new Promise<void>((resolve) => {
      const req = indexedDB.open("velora");
      req.onsuccess = () => {
        const db = req.result;
        db.close();
        const del = indexedDB.deleteDatabase("velora");
        del.onsuccess = () => resolve();
        del.onerror = () => resolve();
        del.onblocked = () => resolve();
      };
      req.onerror = () => {
        const del = indexedDB.deleteDatabase("velora");
        del.onsuccess = () => resolve();
        del.onerror = () => resolve();
        del.onblocked = () => resolve();
      };
      req.onupgradeneeded = () => {
        req.result.close();
        const del = indexedDB.deleteDatabase("velora");
        del.onsuccess = () => resolve();
        del.onerror = () => resolve();
        del.onblocked = () => resolve();
      };
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
  // Le wizard apparaît après le KDF (Argon2id, >5s en CI) : on l'attend explicitement.
  const dialog = page.getByRole("dialog", { name: "Guide de démarrage" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Passer le guide" }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ })).toBeVisible(
    { timeout: 30_000 }
  );
}

/**
 * Ferme le wizard d'onboarding s'il est ouvert (bouton X aria-label="Passer le guide"
 * ou bouton "Passer" en bas). Indispensable avant toute navigation : le dialog
 * est modal (aria-modal) et bloque tous les clics sur la sidebar.
 */
export async function skipOnboardingIfOpen(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog", { name: "Guide de démarrage" });
  if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const skip = page.getByRole("button", { name: "Passer le guide" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
    } else {
      await page.getByRole("button", { name: "Passer" }).click();
    }
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
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
  // Si on est déjà sur le dashboard déverrouillé (après createVaultAndUnlock),
  // ne pas recharger : la session est en mémoire vive et un goto casserait tout.
  const dashboard = page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ });
  const portal = page.getByRole("heading", { name: /Déverrouiller le coffre/i });
  if (!(await dashboard.isVisible({ timeout: 1_000 }).catch(() => false))) {
    await page.goto("/");
    // Attendre que le VaultGate ait tranché : portail OU dashboard déverrouillé.
    await Promise.race([
      dashboard.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null),
      portal.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null),
    ]);
    if (await portal.isVisible().catch(() => false)) {
      // Session pas restaurée à temps : déverrouillage manuel (Argon2id lent en CI)
      await page.getByLabel(/Phrase secrète/i).fill(E2E_PASSPHRASE);
      await page.getByRole("button", { name: /Déverrouiller/i }).click();
      await expect(dashboard).toBeVisible({ timeout: 30_000 });
    }
  }
  // Le wizard d'onboarding est modal et bloque la sidebar : on le ferme si ouvert
  await skipOnboardingIfOpen(page);
  // Navigation client via le lien de la sidebar (desktop) ou du drawer (mobile)
  const label = NAV_LABELS[url];
  if (!label) throw new Error(`Pas de libellé de navigation pour ${url}`);
  const link = page.getByRole("link", { name: label, exact: true }).first();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${url}$`));
  // Attendre le heading de la page. Sur certaines pages (candidatures), le h1
  // est toujours dans le DOM mais le contenu est en skeleton : attendre que le
  // skeleton disparaisse d'abord, sinon toBeVisible peut rater selon le timing.
  const content = page.getByRole("heading", { name: heading });
  await expect(content).toBeAttached({ timeout: 15_000 });
  await expect(content).toBeVisible({ timeout: 30_000 });
}
