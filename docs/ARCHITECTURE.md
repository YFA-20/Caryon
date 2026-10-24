# Architecture — Velora

## 1. Vue d'ensemble

Velora est une **PWA local-first** : le frontend est une application **100 % statique**
(Next.js, `output: "export"`) deployee sur **Cloudflare Pages**. Il n'existe **aucun serveur
applicatif** pour les operations courantes : tout se deroule dans le navigateur de
l'utilisateur, sur son appareil.

```
┌─────────────────────────────────── Navigateur (appareil utilisateur) ───────────────────────────────────┐
│                                                                                                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────────────────────────────────────────┐   │
│  │  UI React   │ → │  Zustand    │ → │  Services (vault, applications, documents, calendrier,     │   │
│  │  (Next.js)  │   │  (etat UI)  │   │   journal, entretien, stats, objectifs, IA)                  │   │
│  └─────────────┘   └─────────────┘   └─────────────────────────────┬───────────────────────────────┘   │
│                                                                 │                                       │
│                                                  ┌──────────────┴──────────────┐                        │
│                                                  │  Couche cryptographique     │                        │
│                                                  │  AES-256-GCM (Web Crypto)   │                        │
│                                                  │  Cle maitresse : memoire    │                        │
│                                                  │  KDF : Argon2id (phrase)    │                        │
│                                                  └──────────────┬──────────────┘                        │
│                                                                 │                                       │
│                                                  ┌──────────────┴──────────────┐                        │
│                                                  │  Dexie.js → IndexedDB       │                        │
│                                                  │  (ciphertext + metadonnees) │                        │
│                                                  └─────────────────────────────┘                        │
│                                                                                                       │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────┐   │
│  │  Assistant IA (opt-in) : consentement explicite → anonymisation → cloud (OpenAI-compatible)  │   │
│  │  ou local (WebLLM, stub) — aucune donnee ne part sans consentement                               │   │
│  └───────────────────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
        │  (Phase 3, opt-in) chiffrement client → blobs chiffres
        ▼
┌───────────────────────────── Cloudflare (aucune donnee en clair) ─────────────────────────────────────┐
│  Pages (UI statique)  ·  Workers (API sync, Phase 3)  ·  R2 (objets chiffres, Phase 3)              │
│  D1 (metadonnees minimales, versions, index — Phase 3)                                              │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Principes directeurs

| Principe                           | Application concrete                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| **Local-first**                    | Toutes les operations courantes s'executent sur l'appareil ; l'app fonctionne hors ligne.    |
| **Privacy by Design**              | Minimisation des donnees, chiffrement au repos, aucune telemetrie.                           |
| **Secure by Default**              | Le coffre est verrouille par defaut ; l'IA est desactivee par defaut.                        |
| **Defense in depth**               | CSP restrictive, validation Zod, chiffrement authentifie, en-tetes de securite, CI securite. |
| **Moindre privilege**              | Permissions minimales pour les tokens CI/CD et Cloudflare (OIDC privilegie).                 |
| **Separation des responsabilites** | UI / etat / services / crypto / persistance strictement separes.                             |
| **IA opt-in**                      | Consentement explicite avant chaque envoi, preview des donnees, anonymisation.               |

## 3. Structure des dossiers

```
.
├── src/
│   ├── app/                        # Routes Next.js (App Router) — export statique
│   │   ├── layout.tsx              # Layout racine (fonts, providers, VaultGate)
│   │   ├── page.tsx                # Dashboard « Aujourd'hui »
│   │   ├── candidatures/           # Kanban + liste + CRUD
│   │   ├── documents/              # Documents chiffres (upload/download)
│   │   ├── calendrier/             # Calendrier + evenements + ICS
│   │   ├── journal/                # Journal de recherche
│   │   ├── entretien/              # Preparation d'entretiens
│   │   ├── offres/                 # Offres sauvegardees + analyse IA
│   │   ├── analyses/               # Statistiques locales
│   │   ├── objectifs/              # Objectifs de recherche
│   │   ├── parametres/             # Parametres (profil, securite, IA)
│   │   ├── sauvegardes/            # Export/import .velora
│   │   ├── securite/               # Vue securite du coffre
│   │   └── ia/                     # Centre de controle IA
│   ├── components/                 # Composants UI
│   │   ├── ai/                     # AiConsentModal, AiConsentBanner, AiActionButton,
│   │   │                           #   CvOfferComparison, CoverLetterGenerator, InterviewPrepAi
│   │   ├── applications/           # Kanban board/column/card, formulaires
│   │   ├── common/                 # EmptyPage, Skeletons, Toasts
│   │   ├── dashboard/              # Widgets du tableau de bord
│   │   ├── layout/                 # AppShell, Header, Sidebar, MobileNav
│   │   ├── onboarding/             # Parcours premier lancement
│   │   ├── ui/                     # Card, Badge, Button (design system)
│   │   └── vault/                  # VaultGate (create/unlock portal)
│   ├── hooks/                      # Hooks React
│   │   ├── use-ai.ts               # Hook IA (consentement + appels)
│   │   ├── use-auto-lock.ts        # Verrouillage automatique
│   │   ├── use-global-shortcuts.ts # Raccourcis clavier
│   │   └── use-notification-scheduler.ts
│   ├── lib/
│   │   ├── ai/                     # Service IA
│   │   │   ├── ai-service.ts       # Abstraction cloud/local, consentement, prompts
│   │   │   └── offer-analyzer.ts   # 4 taches IA (analyse, comparaison, lettre, entretien)
│   │   ├── crypto/                 # AES-256-GCM, KDF (Argon2id), serialisation
│   │   ├── db/                     # Dexie (IndexedDB) — vault, records, documents
│   │   ├── demo/                   # Mode demonstration (seed, cleanup)
│   │   ├── notifications/          # Notifications locales
│   │   ├── schema/                 # Schemas Zod + types TS
│   │   ├── search/                 # Recherche instantanee
│   │   ├── security/               # CSP, en-tetes
│   │   ├── utils/                  # Utilitaires purs (dates, ics, uuid)
│   │   └── vault/                  # Services metier chiffres
│   │       ├── vault-service.ts        # Creation/deverrouillage/verrouillage
│   │       ├── application-repository.ts
│   │       ├── document-repository.ts
│   │       ├── calendar-repository.ts
│   │       ├── journal-repository.ts
│   │       ├── interview-repository.ts
│   │       ├── goal-repository.ts
│   │       ├── followup-service.ts     # Relances
│   │       ├── goal-progress-service.ts
│   │       ├── stats-service.ts        # Statistiques
│   │       ├── backup-service.ts       # Export/import .velora
│   │       └── demo-data-service.ts    # Seed/cleanup mode demo
│   └── store/                      # Zustand (etat UI : coffre, demo, preferences)
│       # JAMAIS de cles ni de phrases dans le store
├── public/
│   ├── manifest.webmanifest        # PWA
│   ├── sw.js                       # Service worker (network-first HTML, cache-first assets)
│   └── _headers                    # CSP + en-tetes de securite (hashes SHA-256 auto)
├── scripts/
│   ├── update-csp-hashes.mjs       # Postbuild : calcule les hashes des scripts inline
│   ├── serve-static.mjs            # Serveur statique local pour E2E
│   └── make-icons.mjs              # Generation des icones PWA
├── tests/
│   ├── unit/                       # Vitest (355 tests, 34 fichiers)
│   └── e2e/                        # Playwright (CI uniquement)
├── docs/
│   ├── ARCHITECTURE.md             # ce document
│   ├── ROADMAP.md
│   ├── DEPLOYMENT.md
│   ├── adr/                        # Decisions d'architecture (ADR)
│   │   ├── 0001-static-export-cloudflare-pages.md
│   │   ├── 0002-aes-256-gcm-argon2id.md
│   │   ├── 0003-no-telemetry-local-first.md
│   │   ├── 0004-ai-opt-in-consent-cloud-local.md
│   │   └── 0005-auto-lock-session.md
│   └── security/                   # Modele de menace, crypto, flux de donnees...
└── .github/workflows/              # CI, securite, E2E, release, deploy
```

## 4. Couches et responsabilites

### 4.1 UI (`src/components`, `src/app`)

- Composants presentatifs, accessibles (WCAG 2.2 AA vise), responsive, `prefers-reduced-motion`.
- **Aucune logique metier** : la UI consomme les services et le store.
- Jamais de `dangerouslySetInnerHTML` avec du contenu non fiable.

### 4.2 Etat UI (`src/store` — Zustand)

- Etat de session : coffre verrouille/deverrouille, mode demonstration, preferences UI,
  derniere activite (`lastActivityAt` pour l'auto-lock).
- **Ne contient jamais de cles** : un drapeau d'etat oui/non, jamais la cle elle-meme.

### 4.3 Services (`src/lib/vault`, `src/lib/ai`)

- Logique metier : CRUD candidatures, documents, statistiques, calendrier, journal,
  entretien, objectifs, relances, sauvegardes.
- Orchestrent crypto + persistance. Validations Zod en entree.
- **IA** (`src/lib/ai`) : consentement explicite, anonymisation, abstraction cloud/local.

### 4.4 Cryptographie (`src/lib/crypto`)

- AES-256-GCM via Web Crypto. Nonce aleatoire unique par operation (96 bits).
- KDF : Argon2id (parametres documentes dans `docs/security/cryptography.md`).
- Format de ciphertext **versionne** (`v` + `alg` + `nonce` + `ciphertext` + `tag` via GCM).
- Voir [docs/security/cryptography.md](security/cryptography.md).

### 4.5 Persistance (`src/lib/db` — Dexie)

- IndexedDB ne contient **que** des enregistrements chiffres, a l'exception de metadonnees
  techniques minimales (id, version de schema, horodatage) necessaires a l'indexation.
- Tables : `vault`, `records` (donnees metier chiffrees), `documents` (blobs chiffres).
- Migrations de schema versionnees et testees.

### 4.6 Assistant IA (`src/lib/ai`)

- **Consentement explicite** : modal de preview avant chaque envoi (liste exacte des champs).
- **Abstraction provider** : cloud (OpenAI-compatible) ou local (WebLLM, stub).
- **Anonymisation** : `anonymizeText()` supprime les identifiants avant envoi cloud.
- **4 taches** : `analyze_offer`, `compare_cv_offer`, `generate_letter`, `prepare_interview`.
- **Cle API** : stockee chiffree dans le vault, jamais en clair.
- Voir [docs/adr/0004-ai-opt-in-consent-cloud-local.md](adr/0004-ai-opt-in-consent-cloud-local.md).

## 5. Flux de donnees

Voir [docs/security/data-flow.md](security/data-flow.md) pour le detail des flux et des
frontieres de confiance.

## 6. PWA & hors ligne

- **Service worker** : network-first pour les navigations HTML, cache-first uniquement
  pour les assets immutables (`/_next/static/*`).
- **Manifeste** : icones, theme prune-noir, `display: "standalone"`.
- **Persistance** : IndexedDB (chiffre) — les donnees survivent a la fermeture du navigateur.
- **Notifications locales** via l'API Notification (avec degradation explicite).

## 7. Deploiement

Frontend statique sur **Cloudflare Pages** (voir [docs/DEPLOYMENT.md](DEPLOYMENT.md)) :

- Build : `npm run build` → `out/` (export statique).
- Script postbuild : `scripts/update-csp-hashes.mjs` calcule les hashes SHA-256 des
  scripts inline et les injecte dans `out/_headers`.
- En-tetes de securite + CSP restrictive (dupliques dans `public/_headers`).
- Deploiement automatique via Git integration Cloudflare Pages.

## 8. Securite applicative

- **CSP** : `script-src 'self' 'sha256-...'` (hashes des scripts inline Next.js),
  `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- **Auto-lock** : verrouillage apres inactivite (15 min par defaut, configurable),
  prolongement sur activite utilisateur, `forceLock()` avec redirection propre.
- **Validation** : Zod a chaque frontiere de confiance.
- **Lint** : ESLint strict (pas de `no-alert`, `no-eval`, `no-explicit-any`).
- Voir [docs/security/security-architecture.md](security/security-architecture.md).

## 9. Limites connues (honnêteté technique)

- Le JavaScript ne permet pas d'effacer **garanti** de la memoire (cles en RAM) ; le
  verrouillage efface les references applicatives et le navigateur reste le dernier
  rempart. Voir [docs/security/threat-model.md](security/threat-model.md).
- XSS : la CSP reduit l'impact, mais un appareil compromis ou une extension malveillante
  reste hors de portee.
- Perte de la phrase secrete = perte des donnees (par conception, aucune recuperation
  serveur).
- Argon2id necessite WASM (fallback PBKDF2 en test uniquement, documente comme moins
  resistant, jamais presente comme equivalent).
- **Bug connu** : le bouton de refresh du navigateur declenche un verrouillage immediat
  (meme mecanisme que F5). Fix prevu : persister `lastActivityAt` dans `sessionStorage`.
- **WebLLM local** : `callLocalAi()` est un stub — a implementer si besoin IA 100% offline.
