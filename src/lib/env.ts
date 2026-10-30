/**
 * Velora — détection des builds de test.
 *
 * `NEXT_PUBLIC_E2E_TEST_BUILD` est inliné au moment du build par Next.js.
 * Il n'est défini QUE par le script `build:e2e` (voir package.json), utilisé
 * exclusivement par la CI E2E (`.github/workflows/e2e.yml`).
 *
 * SÉCURITÉ : aucun workflow de déploiement (deploy.yml, deploy-preview.yml)
 * ne définit cette variable. Le build de production utilise donc toujours
 * les paramètres KDF forts (Argon2id 64 MiB, t=3). Un test unitaire
 * (tests/unit/e2e-build-guard.test.ts) vérifie cette invariant en lisant
 * les workflows.
 */
export const E2E_TEST_BUILD =
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_E2E_TEST_BUILD === "1";

/**
 * Vrai uniquement dans un environnement de test (vitest : NODE_ENV=test)
 * ou dans un build E2E dédié (NEXT_PUBLIC_E2E_TEST_BUILD=1).
 * Ne JAMAIS utiliser pour désactiver une protection en production :
 * en production, cette fonction retourne toujours false.
 */
export function isTestBuild(): boolean {
  if (typeof process === "undefined") return false;
  return process.env?.NODE_ENV === "test" || E2E_TEST_BUILD;
}
