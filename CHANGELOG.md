# Changelog

Toutes les modifications notables de Velora sont documentées dans ce fichier.

Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet
adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- **Design system Velora** : tokens prune-noir / rose poudré / lavande, typographie
  Cormorant Garamond (titres) + Inter (interface), cartes arrondies 20–28 px, ombres
  douces, dégradé carte mise en avant, composants UI (Card, Badge, Button).
- **Shell applicatif** : sidebar gauche (Mon espace / Ma carrière / Mon coffre-fort),
  header (date, statut coffre, verrouillage, notifications, profil), barre de navigation
  inférieure responsive sur mobile.
- **Dashboard « Aujourd'hui »** : salutation personnalisée, carte principale en dégradé
  (candidatures actives, entretiens, réponses positives, relances), graphique circulaire
  du pipeline (Recharts), carte « Votre journée », section « À venir », état vide élégant.
- **Mode démonstration** : données fictives clairement identifiées (bandeau « Mode
  démonstration — données fictives »), entreprises fictives, emails `.invalid`, jamais
  persistées dans IndexedDB.
- **PWA** : enregistrement du service worker, manifest, icônes générées (192/512/maskable).
- **État UI (Zustand)** : contrat de sécurité — jamais de clé ni de phrase dans le store.

### Sécurité

- **CI corrigée après premier run** : CodeQL activé uniquement pour le propriétaire
  du dépôt (Advanced Security indisponible sinon, échec gracieux) ; audit des
  dépendances scindé en **production (bloquant ≥ high)** et **dev (informatif)** ;
  audit des permissions des workflows durci (regex YAML, faux positifs corrigés).
- **Supply chain** : override `postcss` → 8.5.31 (corrige 2 vulnérabilités dont 1 HIGH
  dans le bundle Next.js livré) ; `npm audit --omit=dev` = **0 vulnérabilité**.
- CSP test local assouplie uniquement pour les scripts inline d'hydratation Next.js
  (artefact du serveur de test) ; CSP de production stricte vérifiée par test E2E
  (`public/_headers` : `script-src 'self'` sans `unsafe-inline`).
- Test E2E : aucun appel réseau externe non documenté au chargement.

### Ajouté

- Architecture initiale du dépôt : gouvernance (README, CONTRIBUTING, SECURITY, CODEOWNERS),
  configuration TypeScript strict, ESLint, Prettier, Tailwind CSS.
- Workflows CI GitHub Actions : `ci.yml`, `security.yml`, `e2e.yml`, `release.yml`.
- Documentation : architecture, feuille de route, déploiement Cloudflare, modèle de menace
  (STRIDE), cryptographie, décisions de sécurité (ADR).
- Design system Velora (tokens prune-noir / rose poudré / lavande).

### Sécurité

- Politique CSP restrictive, en-têtes de sécurité, `nosniff`, HSTS, `Referrer-Policy`.
- Gitleaks + CodeQL + `npm audit` en CI ; actions épinglées par SHA ; permissions minimales.

---

## [0.1.0] — À venir (MVP local-first)

*Critères d'acceptation : voir le milestone
[v0.1.0 — MVP local-first](https://github.com/YFA-20/Caryon/milestones).*

- Design system, interface responsive, mode démonstration.
- Coffre-fort local chiffré (AES-256-GCM, Argon2id).
- Création et modification des candidatures (Kanban + tableau).
- Documents chiffrés, recherche, sauvegarde chiffrée.
- Tests essentiels, déploiement Cloudflare.
