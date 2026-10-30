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
  // Chargement complet de la page (fiable) : le serveur statique E2E sert
  // désormais le bon .html par route (comme Cloudflare), donc un goto direct
  // rend la bonne page avec la bonne CSP. Le KDF est allégé en build E2E
  // (NEXT_PUBLIC_E2E_TEST_BUILD=1), la restauration de session est rapide.
  await page.goto(url);
  const portal = page.getByRole("heading", { name: /Déverrouiller le coffre/i });
  const dashboard = page.getByRole("heading", { name: /Bonjour|Bonsoir|Bonne après-midi/ });
  await Promise.race([
    portal.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null),
    dashboard.waitFor({ state: "visible", timeout: 30_000 }).catch(() => null),
    page
      .getByRole("heading", { name: heading })
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => null),
  ]);
  if (await portal.isVisible().catch(() => false)) {
    // Coffre verrouillé (pas de session restaurée) : déverrouillage manuel
    await page.getByLabel(/Phrase secrète/i).fill(E2E_PASSPHRASE);
    await page.getByRole("button", { name: /Déverrouiller/i }).click();
    await expect(dashboard).toBeVisible({ timeout: 30_000 });
  }
  await skipOnboardingIfOpen(page);
  // .first() : certaines pages ont un h1 + un sous-titre de même nom (ex: Calendrier)
  const content = page.getByRole("heading", { name: heading }).first();
  await expect(content).toBeVisible({ timeout: 60_000 });
}
