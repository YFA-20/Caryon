# Architecture — Velora

## 1. Vue d'ensemble

Velora est une **PWA local-first** : le frontend est une application **100 % statique**
(Next.js, `output: "export"`) déployée sur **Cloudflare Pages**. Il n'existe **aucun serveur
applicatif** pour les opérations courantes : tout se déroule dans le navigateur de
l'utilisateur, sur son appareil.

```
┌─────────────────────── Navigateur (appareil utilisateur) ───────────────────────┐
│                                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────────────────────────┐   │
│  │  UI React   │ → │  Zustand     │ → │  Services (applications, documents, │   │
│  │  (Next.js)  │   │  (état UI)   │   │  calendrier, journal, analyses)     │   │
│  └─────────────┘   └──────────────┘   └──────────────┬──────────────────────┘   │
│                                                       │                        │
│                                        ┌──────────────▼───────────────────┐    │
│                                        │  Couche cryptographique          │    │
│                                        │  AES-256-GCM (Web Crypto)        │    │
│                                        │  Clé maîtresse : mémoire (session)│   │
│                                        │  KDF : Argon2id (phrase secrète) │    │
│                                        └──────────────┬───────────────────┘    │
│                                                       │                        │
│                                        ┌──────────────▼───────────────────┐    │
│                                        │  Dexie.js → IndexedDB            │    │
│                                        │  (ciphertext + métadonnées tech) │    │
│                                        └──────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────┘
          │  Phase 4 (opt-in) : chiffrement client → blobs chiffrés
          ▼
┌────────────────────── Cloudflare (aucune donnée en clair) ─────────────────────┐
│  Pages (UI statique) · Workers (API sync, Phase 4) · R2 (objets chiffrés, P4)   │
│  D1 (métadonnées minimales, versions, index — Phase 4)                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Principes directeurs

| Principe                           | Application concrète                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| **Local-first**                    | Toutes les opérations courantes s'exécutent sur l'appareil ; l'app fonctionne hors ligne.    |
| **Privacy by Design**              | Minimisation des données, chiffrement au repos, aucune télémétrie.                           |
| **Secure by Default**              | Le coffre est verrouillé par défaut ; l'IA est désactivée par défaut.                        |
| **Defense in depth**               | CSP restrictive, validation Zod, chiffrement authentifié, en-têtes de sécurité, CI sécurité. |
| **Moindre privilège**              | Permissions minimales pour les tokens CI/CD et Cloudflare (OIDC privilégié).                 |
| **Séparation des responsabilités** | UI / état / services / crypto / persistance strictement séparés.                             |

## 3. Structure des dossiers

```
.
├── src/
│   ├── app/                    # Routes Next.js (App Router) — export statique
│   │   ├── layout.tsx          # Layout racine (fonts, providers, métadonnées)
│   │   ├── page.tsx            # Tableau de bord « Aujourd'hui »
│   │   └── globals.css         # Tokens CSS + base
│   ├── components/             # Composants UI (sidebar, header, cartes, états vides…)
│   ├── lib/
│   │   ├── schema/             # Schémas Zod + types TS (contrats de données)
│   │   ├── crypto/             # AES-256-GCM, KDF, sérialisation versionnée
│   │   ├── vault/              # Coffre-fort : création, déverrouillage, verrouillage
│   │   ├── storage/            # Dexie / IndexedDB (ciphertext)
│   │   ├── services/           # Logique métier (applications, documents, stats…)
│   │   ├── backup/             # Export/import d'archives chiffrées
│   │   ├── ai/                 # Assistant IA (opt-in, consentement explicite)
│   │   └── utils/              # Utilitaires purs (cn, dates, uuid…)
│   ├── store/                  # Zustand (état UI : coffre, démo, préférences)
│   └── styles/                 # Design tokens si besoin
├── public/
│   ├── manifest.webmanifest    # PWA
│   └── sw.js                   # Service worker (cache maîtrisé, offline-first)
├── tests/
│   ├── unit/                   # Vitest
│   └── e2e/                    # Playwright
├── docs/
│   ├── ARCHITECTURE.md         # ce document
│   ├── ROADMAP.md
│   ├── DEPLOYMENT.md
│   ├── adr/                    # Décisions d'architecture (ADR)
│   └── security/               # Modèle de menace, crypto, flux de données…
└── .github/workflows/          # CI, sécurité, E2E, release
```

## 4. Couches et responsabilités

### 4.1 UI (`src/components`, `src/app`)

- Composants présentatifs, accessibles (WCAG 2.2 AA visé), responsive, `prefers-reduced-motion`.
- **Aucune logique métier** : la UI consomme les services et le store.
- Jamais de `dangerouslySetInnerHTML` avec du contenu non fiable.

### 4.2 État UI (`src/store` — Zustand)

- État de session : coffre verrouillé/déverrouillé, mode démonstration, préférences UI.
- **Ne contient jamais de clés** : un drapeau d'état oui/non, jamais la clé elle-même.

### 4.3 Services (`src/lib/services`)

- Logique métier : CRUD candidatures, documents, statistiques, calendrier.
- Orchestrent crypto + persistance. Validations Zod en entrée.

### 4.4 Cryptographie (`src/lib/crypto`)

- AES-256-GCM via Web Crypto. Nonce aléatoire unique par opération (96 bits).
- KDF : Argon2id (paramètres documentés dans `docs/security/cryptography.md`).
- Format de ciphertext **versionné** (`v` + `alg` + `nonce` + `ciphertext` + `tag` via GCM).
- Voir [docs/security/cryptography.md](security/cryptography.md).

### 4.5 Persistance (`src/lib/storage` — Dexie)

- IndexedDB ne contient **que** des enregistrements chiffrés, à l'exception de métadonnées
  techniques minimales (id, version de schéma, horodatage) nécessaires à l'indexation.
- Migrations de schéma versionnées et testées (critère d'acceptation n°10).

## 5. Flux de données

Voir [docs/security/data-flow.md](security/data-flow.md) pour le détail des flux et des
frontières de confiance.

## 6. PWA & hors ligne

- **Service worker** : stratégie cache-first pour les assets de l'app shell, network-first
  pour les mises à jour, avec **skipWaiting** contrôlé et page de mise à jour proposée.
- **Manifeste** : icônes, thème prune-noir, `display: "standalone"`.
- **Persistance** : IndexedDB (chiffré) — les données survivent à la fermeture du navigateur.
- **Notifications locales** via l'API Notification (avec dégradation explicite).

## 7. Déploiement

Frontend statique sur **Cloudflare Pages** (voir [docs/DEPLOYMENT.md](DEPLOYMENT.md)) :

- Preview automatique par PR (aucune donnée réelle).
- Production : déploiement contrôlé depuis une release validée.
- En-têtes de sécurité + CSP restrictive (dupliqués dans `public/_headers`).

## 8. Limites connues (honnêteté technique)

- Le JavaScript ne permet pas d'effacer **garanti** de la mémoire (clés en RAM) ; le
  verrouillage efface les références applicatives et le navigateur reste le dernier
  rempart. Voir [docs/security/threat-model.md](security/threat-model.md).
- XSS : la CSP réduit l'impact, mais un appareil compromis ou une extension malveillante
  reste hors de portée.
- Perte de la phrase secrète = perte des données (par conception, aucune récupération
  serveur).
- Argon2id nécessite WASM (fallback PBKDF2 documenté et moins résistant, jamais présenté
  comme équivalent).
