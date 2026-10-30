# Cryptographie — Velora

> **Règle d'or** : n'utilisez que des primitives éprouvées. N'inventez jamais un algorithme.

## 1. Objectifs de sécurité

- **Confidentialité** des données au repos (IndexedDB) et en transit (archives exportées).
- **Intégrité** : détection de toute modification (authentification AEAD).
- **Résistance hors ligne** : KDF lente contre la force brute sur la phrase secrète.

## 2. Primitives retenues

| Usage                                        | Primitive                                    | Justification                                                         |
| -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- |
| Chiffrement des données                      | **AES-256-GCM** (Web Crypto)                 | AEAD standard, authentification intégrée, support natif navigateur    |
| Dérivation de clé (phrase → clé d'enveloppe) | **Argon2id**                                 | Recommandé OWASP, résistant GPU/ASIC, mémoire-dure                    |
| Fallback (si WASM indisponible)              | **PBKDF2-HMAC-SHA-256** (itérations élevées) | Uniquement si Argon2id indisponible ; documenté comme moins résistant |
| Génération aléatoire                         | **`crypto.getRandomValues`**                 | CSPRNG du navigateur                                                  |
| Hachage d'intégrité (archive)                | SHA-256 (via Web Crypto)                     | Complément de l'AEAD pour l'enveloppe de sauvegarde                   |

## 3. Hiérarchie des clés

```
Phrase secrète (utilisateur, saisie, jamais stockée)
        │  Argon2id (sel aléatoire 128 bits, paramètres calibrés)
        ▼
Clé d'enveloppe (KEK — Key Encryption Key, mémoire volatile)
        │  AES-256-GCM (unwrap, nonce aléatoire 96 bits)
        ▼
Clé maîtresse du coffre (DEK — Data Encryption Key, 256 bits, aléatoire)
        │  AES-256-GCM par enregistrement (nonce aléatoire 96 bits, unique)
        ▼
Données chiffrées (ciphertext + tag) → IndexedDB
```

- **Clé maîtresse (DEK)** : générée aléatoirement à la création du coffre
  (`crypto.getRandomValues`, 32 octets). C'est elle qui chiffre les données.
- **Clé d'enveloppe (KEK)** : dérivée de la phrase secrète via Argon2id. Elle ne quitte
  jamais la mémoire et sert uniquement à **envelopper/déballer** la clé maîtresse.
- **La phrase secrète n'est jamais stockée.** La clé maîtresse chiffrée (wrapped) est
  stockée avec un **verifier** (challenge AEAD) permettant de valider la phrase sans
  stocker de dérivé réutilisable.

## 4. Format de ciphertext (versionné)

Tout enregistrement chiffré suit un format versionné sérialisé (JSON binaire-compatible) :

```json
{
  "v": 1,
  "alg": "AES-256-GCM",
  "iv": "<base64url — 96 bits, aléatoire, unique par opération>",
  "ct": "<base64url — ciphertext + tag GCM (128 bits)>",
  "aad": "<base64url — métadonnées authentifiées (ex: recordType, recordId, schemaVersion)>"
}
```

- **Nonce unique** : généré aléatoirement (`crypto.getRandomValues`) à **chaque** opération
  de chiffrement sous une même clé. Jamais de nonce réutilisé (règle absolue du GCM).
- **AAD** : les métadonnées pertinentes (type d'enregistrement, id, version de schéma)
  sont authentifiées : une substitution d'enregistrement est détectée.
- **Versionnement** : `v` permet des migrations de format contrôlées et testées.

## 5. Paramètres Argon2id (calibrés et documentés)

| Paramètre          | Valeur                                  | Note                                                    |
| ------------------ | --------------------------------------- | ------------------------------------------------------- |
| Mémoire (m)        | 64 MiB (65536 KiB)                      | Équilibre sécurité / appareils mobiles milieu de gamme  |
| Itérations (t)     | 3                                       | Standard OWASP pour 64 MiB                              |
| Parallélisme (p)   | 1                                       | Compatibilité navigateur (WASM single-thread)           |
| Longueur de sortie | 32 octets (256 bits)                    | Taille de la KEK                                        |
| Sel                | 16 octets aléatoires, unique par coffre | Stocké en clair (son rôle est l'unicité, pas le secret) |

> Ces paramètres sont **calibrés pour l'expérience utilisateur** tout en restant dans les
> recommandations OWASP. Ils sont revus à chaque release et tout changement est un
> **changement sensible** (revue + migration). Un calibrage sur l'appareil (benchmark au
> premier déverrouillage) est envisagé en Phase 2 — jamais de dégradation silencieuse.

### Paramètres allégés réservés aux tests (jamais en production)

Pour que la suite E2E Playwright reste rapide en CI (Argon2id 64 MiB, t=3 prend
10-30 s sur les runners partagés), un **build dédié** (`npm run build:e2e`,
flag `NEXT_PUBLIC_E2E_TEST_BUILD=1`) active `TEST_KDF_PARAMS` (64 KiB, t=1) via
`src/lib/env.ts`. Ce flag n'est défini **que** dans `.github/workflows/e2e.yml` ;
les workflows de déploiement ne l'utilisent jamais, et le test unitaire
`tests/unit/e2e-build-guard.test.ts` vérifie cet invariant. Le build de production
et `next dev` utilisent toujours les paramètres forts ci-dessus. Aucun coffre
réel n'est jamais créé avec des paramètres faibles.

## 6. Gestion des clés en session

- La clé maîtresse déverrouillée vit **uniquement en mémoire** (CryptoKey non extractible
  si possible, ou ArrayBuffer en session).
- **Verrouillage manuel** : bouton dédié.
- **Verrouillage automatique** après inactivité (par défaut 15 min, configurable).
- Au verrouillage : les références applicatives aux clés sont effacées
  (`crypto.subtle` CryptoKey + buffers). **Limite honnête** : l'effacement physique en mémoire
  JavaScript n'est pas garanti (voir modèle de menace §5).
- **Aucun secret** dans `localStorage`, `sessionStorage`, les logs, les cookies ou
  l'analytics.

## 7. Sauvegardes chiffrées

- Archive = conteneur versionné (`velora-backup-v1`) contenant :
  - manifeste (liste des enregistrements, versions, horodatage, SHA-256 du contenu)
  - enregistrements chiffrés (format §4)
  - documents chiffrés (blobs, même format)
- L'archive elle-même est chiffrée avec une clé de sauvegarde dérivée (Argon2id) de la
  phrase secrète **ou** d'une phrase de sauvegarde dédiée (à confirmer en Phase 1).
- **Restauration** : vérification AEAD de chaque enregistrement + manifeste ; rejet total
  si l'archive est invalide (jamais de restauration partielle silencieuse).

## 8. Ce que Velora ne fait PAS (et ne prétendra jamais faire)

- ❌ Aucun algorithme « maison » ou obscurci.
- ❌ Aucun stockage de la phrase secrète ou de la clé maîtresse en clair.
- ❌ Aucun chiffrement « simulé » (pas de booléen `isEncrypted`).
- ❌ Aucun fallback « pour faire joli » présenté comme sécurisé.
- ❌ Aucune promesse de « zero knowledge » pour la sync tant que non vérifiée (Phase 4).
- ❌ Aucune récupération secrète côté serveur.

## 8bis. CSP et scripts inline (Next.js `output: "export"`)

- Next.js en mode export statique injecte **6 scripts inline** dans `index.html` /
  `404.html` (payload RSC + hydratation React).
- La CSP `script-src 'self'` bloquait ces scripts → ecran blanc (hydratation echouee).
- **Solution** : script postbuild (`scripts/update-csp-hashes.mjs`) :
  1. Extrait les scripts inline de `out/*.html`.
  2. Calcule le SHA-256 base64 de chacun.
  3. Reecrit `out/_headers` avec `script-src 'self' 'sha256-...' ...` (11 hashes).
- **Aucune** directive `'unsafe-inline'` ni `'unsafe-eval'`.
- Test unitaire (`tests/unit/csp-hashes.test.ts`) verifie la presence des hashes.

## 9. Tests cryptographiques

- Vecteurs de test connus (NIST AES-GCM) pour valider l'implémentation.
- Test : mauvaise phrase → déverrouillage rejeté (critère n°3).
- Test : modification d'un octet du ciphertext → rejet (critère n°4).
- Test : restauration d'une sauvegarde sur un « nouveau navigateur » (critère n°5).
- Test : unicité des nonces sur N chiffrements (jamais de réutilisation).
