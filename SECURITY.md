# Politique de sécurité — Velora

La sécurité et la confidentialité sont des **exigences fondamentales** de Velora, jamais des
fonctionnalités secondaires.

## Signaler une vulnérabilité

**Ne créez pas d'issue publique** pour une vulnérabilité.

1. Ouvrez une **Security Advisory privée** :
   [github.com/YFA-20/Caryon/security/advisories/new](https://github.com/YFA-20/Caryon/security/advisories/new)
2. Ou contactez le mainteneur via les canaux privés du dépôt.

### Ce que nous considérons comme un rapport de qualité

- Étapes de reproduction précises et version/commit concerné.
- Impact potentiel (confidentialité, intégrité, disponibilité).
- Toute preuve de concept (PoC) strictement locale.

### Délais de réponse visés

| Étape                                     | Délai                               |
| ----------------------------------------- | ----------------------------------- |
| Accusé de réception                       | 72 h                                |
| Évaluation préliminaire (gravité, portée) | 7 jours                             |
| Correctif ou plan de mitigation           | selon gravité (critique : 14 jours) |

### Divulgation

Nous pratiquons la **divulgation coordonnée** : la vulnérabilité est rendue publique après
qu'un correctif est disponible, avec un crédit au rapporteur (si souhaité).

## Périmètre

- **En périmètre** : l'application web Velora (frontend, PWA, service worker), la couche
  cryptographique (AES-256-GCM, Argon2id), la sérialisation des sauvegardes, le pipeline CI/CD,
  la configuration Cloudflare.
- **Hors périmètre** : l'appareil de l'utilisateur compromis, les extensions de navigateur
  malveillantes, la perte de la phrase secrète par l'utilisateur (voir _Limitations connues_ dans
  [docs/security/threat-model.md](docs/security/threat-model.md)).

## Mesures en place

- Chiffrement authentifié AES-256-GCM pour toutes les données sensibles au repos.
- Dérivation de clé Argon2id (paramètres calibrés et documentés).
- CSP restrictive, `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy: no-referrer`.
- CI sécurité : CodeQL, Gitleaks (détection de secrets), `npm audit`, revue des permissions
  des workflows, actions épinglées par SHA.
- Aucun secret dans le code ; `.env*` ignorés ; pre-commit et CI anti-secrets.
- Principe du moindre privilège pour les tokens CI/CD et Cloudflare (OIDC privilégié).
- Journalisation sans données sensibles ; pas de télémétrie.

## Bonnes pratiques pour les contributeurs

- Ne commitez **aucun** secret, clé, phrase secrète, donnée utilisateur ou jeton.
- Ne désactivez jamais un contrôle de sécurité pour « faire passer la CI ».
- Toute modification sensible (crypto, clés, auth, sync, CSP, exports, suppressions) requiert
  une revue humaine indépendante et une mise à jour du modèle de menace.

## Remerciements

Merci aux chercheurs et contributeurs qui signalent des problèmes de manière responsable.
