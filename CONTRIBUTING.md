# Contribuer à Velora

Merci de votre intérêt pour Velora. Ce guide décrit le workflow de contribution.

## Principes non négociables

1. **Sécurité d'abord** : aucune fonctionnalité ne sacrifie la confidentialité. Le chiffrement
   est réel, jamais simulé (pas de booléen `isEncrypted` comme substitut).
2. **Ne développez jamais directement sur `main`.** Utilisez GitHub Flow.
3. **Ne masquez jamais une erreur** avec `any` ou `@ts-ignore` sans justification documentée.
4. **Ne créez pas de fonctionnalités factices** : chaque écran a ses états chargement / erreur /
   succès, et les données fictives (mode démo) sont clairement identifiées.

## Workflow (GitHub Flow)

1. **Issue** : créez (ou prenez) une issue décrivant le besoin et les critères d'acceptation
   vérifiables.
2. **Branche** : créez une branche dédiée depuis `main` :

   | Type           | Convention       | Exemple                   |
   | -------------- | ---------------- | ------------------------- |
   | Fonctionnalité | `feature/<nom>`  | `feature/encrypted-vault` |
   | Correction     | `fix/<nom>`      | `fix/reminder-scheduling` |
   | Sécurité       | `security/<nom>` | `security/csp-hardening`  |
   | Refactoring    | `refactor/<nom>` | `refactor/storage-layer`  |
   | Documentation  | `docs/<nom>`     | `docs/threat-model`       |
   | Maintenance    | `chore/<nom>`    | `chore/dependencies`      |

3. **Commits atomiques** en [Conventional Commits](https://www.conventionalcommits.org/fr/) :

   ```
   feat: implement application tracking
   fix: correct reminder scheduling
   security: strengthen vault key derivation
   test: add encrypted storage tests
   docs: document threat model
   chore: update dependencies
   ```

4. **Vérifications locales obligatoires** avant push :

   ```bash
   npm ci
   npm run verify   # typecheck + lint + format + tests + build
   ```

5. **Push + Pull Request** : décrivez les changements, les risques, les tests effectués, et
   liez l'issue (`Closes #N`).
6. **Revue** : la CI doit être verte (typecheck, lint, tests, build, sécurité). Les changements
   sensibles (crypto, clés, auth, sync, CSP, exports, suppressions) exigent une **revue humaine
   indépendante** — l'auteur ne peut pas s'auto-approuver.
7. **Fusion** : Squash and Merge par un humain, après validation des contrôles obligatoires.

## Changements sensibles (revue humaine requise)

Toute modification touchant : la cryptographie, la gestion des clés, l'authentification, la
synchronisation, les permissions, la politique CSP, les exports de données, la suppression de
données. Ces PR doivent être labelisées `type:security` / `area:crypto` et mettre à jour le
modèle de menace si nécessaire.

## Standards de code

- **TypeScript strict** (voir `tsconfig.json` : `noUncheckedIndexedAccess`, etc.).
- **Zod** pour toute validation aux frontières de confiance (imports, restauration, entrées
  utilisateur non sûres).
- **Pas de `dangerouslySetInnerHTML`** avec du contenu non fiable.
- **Pas de secrets** dans le code, les logs, `localStorage` ou les outils d'analyse.
- **Accessibilité** : WCAG 2.2 AA visé — navigation clavier, contrastes, `prefers-reduced-motion`.
- **Pas de données sensibles dans les logs.**

## Tests

- Unitaires (Vitest) pour la logique métier et la cryptographie (vecteurs connus).
- E2E (Playwright) pour les parcours critiques : onboarding, déverrouillage du coffre,
  création d'une candidature, persistance hors ligne, sauvegarde/restauration.

## Questions

Ouvrez une [Discussion](https://github.com/YFA-20/Caryon/discussions) ou une issue `question`.
