# Velora — Votre carrière, votre espace privé

> **Velora** est une application web progressive (PWA) **local-first** et **chiffrée de bout en bout**,
> conçue pour accompagner une recherche de stage, d'alternance ou d'emploi : candidatures,
> entreprises, contacts, documents, entretiens, relances, statistiques — le tout dans un coffre
> numérique personnel dont **vous seul détenez la clé**.

[![CI](https://github.com/YFA-20/Caryon/actions/workflows/ci.yml/badge.svg)](https://github.com/YFA-20/Caryon/actions/workflows/ci.yml)
[![Security](https://github.com/YFA-20/Caryon/actions/workflows/security.yml/badge.svg)](https://github.com/YFA-20/Caryon/actions/workflows/security.yml)

---

## Sommaire

- [Philosophie](#philosophie)
- [Fonctionnalités](#fonctionnalités)
- [Stack technique](#stack-technique)
- [Architecture & confidentialité](#architecture--confidentialité)
- [Installation](#installation)
- [Développement](#développement)
- [Tests](#tests)
- [Déploiement Cloudflare](#déploiement-cloudflare)
- [Sécurité](#sécurité)
- [Feuille de route](#feuille-de-route)
- [Licence](#licence)

## Philosophie

Velora repose sur une exigence fondamentale : **la confidentialité est garantie par l'architecture,
pas annoncée par l'interface**.

- **Local-first** : toutes les opérations courantes s'exécutent sur votre appareil.
- **Chiffrement réel** : AES-256-GCM (Web Crypto) pour les données, Argon2id pour la dérivation de
  clé depuis votre phrase secrète. Aucune donnée sensible n'est jamais stockée en clair.
- **Zéro confiance envers le serveur** : le futur mode de synchronisation (Phase 4) chiffre côté
  client avant tout transfert ; le serveur ne reçoit jamais vos clés ni vos données en clair.
- **IA facultative** : aucune donnée n'est envoyée à un fournisseur d'IA sans votre consentement
  explicite, champ par champ.
- **Aucune télémétrie** : pas de tracker publicitaire, pas d'analytics tiers, pas de journaux
  contenant des données sensibles.

## Fonctionnalités

| Domaine                         | Description                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Tableau de bord « Aujourd'hui » | Vue personnalisée : candidatures actives, entretiens, relances, actions prioritaires   |
| Candidatures                    | Kanban, tableau filtrable, chronologie ; statuts configurables ; recherche instantanée |
| Coffre-fort documentaire        | CV, lettres, diplômes chiffrés au repos (AES-256-GCM) dans IndexedDB                   |
| Calendrier                      | Entretiens, relances, échéances ; notifications locales ; export ICS                   |
| Journal de recherche            | Notes personnelles chiffrées, liées à votre parcours                                   |
| Analyses                        | Statistiques calculées localement (taux de réponse, temps moyen, sources)              |
| Assistant IA (opt-in)           | Analyse d'offres, comparaison CV/offre, aide à la rédaction, préparation d'entretien   |
| Sauvegarde                      | Archive chiffrée portable, versionnée, avec contrôle d'intégrité                       |
| PWA hors ligne                  | Fonctionnement complet sans connexion après installation                               |

> **Mode démonstration** : des données fictives clairement identifiées sont proposées à
> l'onboarding. Elles sont isolées et jamais présentées comme réelles.

## Stack technique

| Couche      | Technologie                                               |
| ----------- | --------------------------------------------------------- |
| Framework   | Next.js (App Router, sortie statique `output: "export"`)  |
| Langage     | TypeScript **strict** (`noUncheckedIndexedAccess`, etc.)  |
| UI          | React 19, Tailwind CSS, Lucide Icons                      |
| État        | Zustand                                                   |
| Stockage    | Dexie.js (IndexedDB), enregistrements chiffrés            |
| Crypto      | Web Crypto API (AES-256-GCM) + Argon2id (phase coffre)    |
| Validation  | Zod (à chaque frontière de confiance)                     |
| Graphiques  | Recharts                                                  |
| PWA         | Manifest + Service Worker (cache maîtrisé, offline-first) |
| Tests       | Vitest (unitaires), Playwright (E2E)                      |
| Déploiement | Cloudflare Pages (statique)                               |

## Architecture & confidentialité

```
┌──────────────────────── Navigateur (votre appareil) ────────────────────────┐
│  UI (React/Next)  →  État (Zustand)  →  Services (applications, documents)   │
│                                          ↓                                  │
│                          Couche cryptographique (Web Crypto, AES-256-GCM)    │
│                          Clé maîtresse en mémoire (session uniquement)       │
│                                          ↓                                  │
│                          Dexie / IndexedDB (ciphertext uniquement)          │
└─────────────────────────────────────────────────────────────────────────────┘
        │  (Phase 3, opt-in) chiffrement client → Cloudflare Workers + R2
        ▼
┌────────────────────── Serveur (aucune donnée en clair) ─────────────────────┐
│  Cloudflare Pages (UI statique)  ·  Workers (API sync, Phase 3)  ·  R2 (objets chiffrés)│
└─────────────────────────────────────────────────────────────────────────────┘
```

Pour le détail complet : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/security/threat-model.md](docs/security/threat-model.md),
[docs/security/cryptography.md](docs/security/cryptography.md).

## Installation

```bash
# Prérequis : Node.js 22 (voir .nvmrc)
nvm use

# Installation reproductible (lockfile commité)
npm ci

# Lancement en développement
npm run dev
```

## Développement

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint (0 warning toléré)
npm run format      # Prettier
npm run test        # Tests unitaires (Vitest)
npm run build       # Build de production (export statique)
npm run verify      # typecheck + lint + format + tests + build
```

Conventions : [CONTRIBUTING.md](CONTRIBUTING.md) · Commits : Conventional Commits ·
Branches : GitHub Flow (`feature/`, `fix/`, `security/`, `refactor/`, `docs/`, `chore/`).

## Tests

```bash
npm run test                # Unitaires + crypto (Vitest)
npm run test:e2e            # E2E Playwright (build prod servie en local)
```

Les critères d'acceptation incluent notamment : persistance hors ligne, illisibilité du
ciphertext dans IndexedDB, détection de toute modification du ciphertext (GCM), restauration
d'une sauvegarde chiffrée, et absence de tout appel réseau pour créer/consulter une candidature.

## Déploiement Cloudflare

Guide complet : [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

- **Preview** : déploiement automatique de chaque Pull Request (aucune donnée réelle).
- **Production** : déploiement manuel depuis une release validée (tag `vX.Y.Z`), en-têtes de
  sécurité, CSP restrictive, cache compatible PWA, procédure de rollback documentée.

## Sécurité

Signalez toute vulnérabilité de manière responsable : consultez [SECURITY.md](SECURITY.md).

- Modèle de menace (STRIDE) : [docs/security/threat-model.md](docs/security/threat-model.md)
- Cryptographie : [docs/security/cryptography.md](docs/security/cryptography.md)
- CI sécurité : CodeQL, Gitleaks, `npm audit`, permissions minimales des workflows
  ([.github/workflows/security.yml](.github/workflows/security.yml))

## Feuille de route

Voir [docs/ROADMAP.md](docs/ROADMAP.md) et les [Milestones GitHub](https://github.com/YFA-20/Caryon/milestones).

| Version | Jalon                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| v0.1.0  | MVP local-first : design system, coffre chiffré, candidatures, documents, sauvegarde |
| v0.2.0  | Gestion documentaire complète                                                        |
| v0.3.0  | Calendrier et analyses, PWA hors ligne complète                                      |
| v0.4.0  | IA facultative (consentement explicite)                                              |
| v0.5.0  | Synchronisation chiffrée multi-appareils                                             |
| v1.0.0  | Première version stable                                                              |

## Licence

**Aucune licence n'a encore été choisie.** Le projet est actuellement propriétaire
(tous droits réservés). Le choix de licence fera l'objet d'une décision explicite et
d'un commit dédié. Voir [#1](https://github.com/YFA-20/Caryon/issues/1).
