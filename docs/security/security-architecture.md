# Architecture de sécurité — Velora

Voir aussi : [threat-model.md](threat-model.md), [cryptography.md](cryptography.md),
[data-flow.md](data-flow.md), [trust-boundaries.md](trust-boundaries.md),
[security-decisions.md](security-decisions.md), [incident-response.md](incident-response.md).

## Couches de défense (Defense in Depth)

```
Couche 6  Gouvernance      CI sécurité (CodeQL, Gitleaks, audit), revue humaine, ADR
Couche 5  Supply chain    Lockfile, Dependabot, actions épinglées par SHA, SBOM (release)
Couche 4  Transport       HTTPS (Cloudflare), HSTS, en-têtes de sécurité, CSP
Couche 3  Application     Validation Zod, échappement React, pas de dangerouslySetInnerHTML
Couche 2  Stockage        Chiffrement au repos (AES-256-GCM), IndexedDB uniquement
Couche 1  Clés           Argon2id, clé maîtresse en mémoire (session), verrouillage auto
```

## Contrôles par surface

| Surface             | Contrôles                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Entrées utilisateur | Zod à chaque frontière, échappement React, longueur/type contraints                                                      |
| Fichiers importés   | Validation MIME + taille, chiffrement avant stockage, prévisualisation isolée (blob URL, pas d'URL publique)             |
| Sauvegardes         | AEAD, manifeste signé/intégré, format versionné, rejet total si invalide                                                 |
| IA (opt-in)         | Consentement explicite par requête, liste exacte des champs envoyés, pas d'envoi automatique, aucune clé API côté client |
| Service worker      | Périmètre `self`, cache maîtrisé, pas de code dynamique (`eval` interdit)                                                |
| Réseau              | Aucun appel par défaut ; `connect-src 'self'` ; sync (Phase 4) chiffrée client                                           |
| Logs                | Aucun log de données sensibles ; erreurs génériques côté UI                                                              |

## États de sécurité de l'interface

- **Verrouillé** (par défaut) : aucune donnée affichée, écran de déverrouillage.
- **Déverrouillé** : session active, indicateur visible dans le header.
- **Verrouillage imminent** : avertissement avant auto-lock (configurable).
