# Changelog

Toutes les modifications notables de Velora sont documentées dans ce fichier.

Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet
adhere au [Versionnage Semantique](https://semver.org/lang/fr/).

## [0.3.0] — 2026-10-30

### Ajoute — Accessibilité WCAG 2.2 AA (PR #36)

- **Audit complet** de 49 composants et 15 pages, rapport dans `docs/A11Y.md`, 27 tests dédiés (`tests/unit/a11y.test.ts`).
- **Corrections** : lien d'évitement « Aller au contenu principal », Kanban utilisable au clavier (`KeyboardSensor`), focus trap sur les 3 modales (nouveau hook `useFocusTrap`), hiérarchie de titres corrigée (h1→h2), `scope="col"` sur tous les tableaux.

### Corrige — Fiabilité de la suite E2E (PR #36)

- **Build E2E dédié** (`npm run build:e2e`, flag `NEXT_PUBLIC_E2E_TEST_BUILD=1`) avec KDF allégé réservé aux tests : création du coffre 10-30 s → ~0,8 s en CI. Garde-fou unitaire (`tests/unit/e2e-build-guard.test.ts`) : le flag n'existe dans aucun workflow de déploiement, la production garde Argon2id 64 MiB / t=3.
- **Serveur statique E2E fidèle à Cloudflare** : `/candidatures` sert `candidatures.html` (contenu + CSP du bon fichier), plus de fallback `index.html` avec la mauvaise CSP (cause des pages vides interminables).
- **`CoverLetterGenerator` en import dynamique** : le chunk `@mlc-ai/web-llm` (6,1 Mo) ne bloque plus le rendu de `/candidatures`.
- Sélecteurs E2E durcis (headings doublons, regex date fr-FR, `#status`, vue Liste pour le badge de statut, test démo validé sur le bandeau + toast).
- **Résultat** : 37 tests E2E passent en ~41 s (contre 28 min et 9 échecs avant).

### Chore — Documentation

- README, ROADMAP, DEPLOYMENT, ARCHITECTURE alignés sur le Service Worker v3 réel (assets statiques uniquement, jamais les navigations HTML) ; accents corrigés dans la roadmap.

---

## [Non publie]

### Ajoute — Phase 2 : Intelligence (IA opt-in)

- **Fondations IA** (Lot 6) : consentement explicite avec modal de preview, service abstrait
  cloud (OpenAI-compatible : OpenAI, Anthropic, endpoint custom) / local (WebLLM, stub),
  anonymisation des donnees avant envoi, page de controle `/ia`, toggle dans les parametres,
  banniere d'activation, hook `useAi()`, composant `AiActionButton` reutilisable.
- **Analyse d'offre IA** (Lot 7.1) : depuis `/offres`, extraction des competences, contraintes,
  localisation, salaire, type de contrat ; pre-remplissage automatique du formulaire de
  candidature depuis l'analyse.
- **Comparaison CV ↔ Offre IA** (Lot 7.2) : depuis `/documents`, bouton « Comparer IA » sur les
  CV, extraction du texte du CV chiffre + collage de l'offre, score de correspondance
  (barre coloree), competences presentes/manquantes/transversales, points forts, suggestions.
- **Generation de lettre de motivation IA** (Lot 7.3) : depuis `/candidatures`, bouton
  « Generer une lettre (IA) » dans le formulaire d'edition, selection du CV chiffre,
  brouillon editable + copie, avertissement « informations reelles uniquement ».
- **Preparation d'entretien IA** (Lot 7.4) : depuis `/entretien`, bouton « Prepa IA » sur chaque
  fiche, questions par categorie (technique/comportementale/entreprise/motivation) avec
  suggestions de reponses depliables, questions a poser au recruteur, conseils generaux.
- **Securite IA** : `AiConsentModal` (preview avant chaque envoi), verification du consentement
  (redirection `/parametres#ia` si absent), `anonymizeText()` avant envoi cloud, gestion des
  erreurs avec toasts, aucune cle API stockee en clair (chiffree dans le vault).

### Ajoute — Phase 1 : Fonctionnalites avancees

- **Tableau avance** : vue Kanban avec drag & drop (@dnd-kit), recherche instantanee,
  filtres par statut, bascule Kanban/Liste.
- **Mode demo** : donnees fictives clairement identifiees (tag `__demo__`, bandeau « Mode
  demonstration »), entreprises fictives, emails `.invalid`, nettoyage automatique a la
  desactivation, detection des donnees demo legacy (tag `demo`).
- **Chronologie** : historique des evenements par candidature (creee, modifiee, changement
  de statut, relance, entretien).
- **Notifications locales** : rappels de relances et d'entretiens via l'API Notification.
- **Auto-lock** : verrouillage automatique apres inactivite (15 min par defaut, configurable),
  prolongement sur activite utilisateur, `forceLock()` avec redirection propre.
- **Relances** : suivi des relances par candidature avec dates et notes.
- **Page Offres** : gestion des offres sauvegardees avec lien vers candidature.
- **Parametres** : profil, securite (delai auto-lock, changement de phrase), objectifs,
  section IA dediee.
- **Journal de recherche** : notes personnelles chiffrees, liees au parcours.
- **Preparation d'entretiens** : fiches par candidature, questions, notes, checklist.
- **Palette de commandes** : recherche rapide (Cmd+K) dans toute l'app.
- **Annulation (undo)** : restauration des suppressions recentes avec toast.
- **Skeletons** : etats de chargement elegants sur toutes les pages.
- **Raccourcis clavier** : navigation rapide, actions courantes.
- **Onboarding** : parcours de premier lancement (creation coffre ou mode demo).

### Ajoute — Phase 0 : Vault chiffre + CRUD

- **Coffre-fort chiffre** : AES-256-GCM (Web Crypto), Argon2id (m=64MiB, t=3, p=1),
  cle maitresse non-extractable en session, KEK derivee de la phrase secretaire,
  phrase jamais stockee, verrouillage manuel + auto.
- **Candidatures CRUD** : creation, edition, suppression avec confirmation inline,
  statuts (brouillon → envoyee → en_attente → entretien → offre → acceptee/refusee/abandonnee),
  dates avec heure (creee/modifiee), tags, salaire, source, contact recruteur.
- **Documents chiffres** : upload PDF/DOC/DOCX/TXT/PNG/JPG (max 10 Mo), stockage chiffre
  dans IndexedDB, telechargement, suppression, detection de type par extension.
- **Sauvegardes `.velora`** : export archive chiffree (AES-256-GCM), manifeste SHA-256,
  import avec verification d'integrite, mode remplacer/fusionner.
- **Calendrier** : evenements (entretien/relance/echeance/preparation/personnel),
  export ICS (RFC 5545).
- **Analyses** : statistiques locales (taux de reponse, taux d'entretien, delai moyen,
  par source, par type, candidatures par semaine).

### Securite

- **CSP inline-script hashes** : script postbuild (`scripts/update-csp-hashes.mjs`) extrait
  les scripts inline de `out/*.html`, calcule les hashes SHA-256, les injecte dans
  `public/_headers`. Plus de `'unsafe-inline'` ni `'unsafe-eval'`.
- **Service worker** : network-first pour les navigations HTML, cache-first uniquement pour
  les assets immutables (`/_next/static/*`).
- **Fix auto-lock F5** : `touchActivity()` au deverrouillage, `autoLockMs` charge depuis les
  parametres chiffres, `getState()` pour `lastActivityAt` frais dans `visibilitychange`.
- **Fix nettoyage mode demo** : detection des donnees demo legacy (tag `demo`), nettoyage
  des 3 marqueurs (`__demo__`, `demo`, entreprises fictives).
- **Fix page blanche au verrouillage** : `forceLock()` (session=null + sync Zustand +
  redirection propre) au lieu de `lock()+reload()`.
- **CI** : workflows `ci.yml`, `security.yml`, `e2e.yml`, `release.yml`, `deploy.yml`,
  `deploy-preview.yml`. CodeQL, Gitleaks, `npm audit` (bloquant >= high en prod).
- **Supply chain** : lockfile committe, actions epinglees par SHA, permissions minimales.

### Corrige

- **Page blanche au verrouillage** : le `VaultGate` affichait une page blanche au lieu de
  rediriger vers l'ecran de deverrouillage. Remplace par `forceLock()` avec redirection
  controlee (`location.replace("/")` ou `reload()`).
- **Auto-lock immediat apres F5** : le timer n'etait pas reinitialise au rechargement.
  Correction : `touchActivity()` au unlock, chargement de `autoLockMs` depuis les settings
  chiffres, utilisation de `getState()` pour la fraicheur de `lastActivityAt`.
- **Donnees demo non nettoyees** : les anciennes donnees demo (tag `demo`) n'etaient pas
  detectees par `clearDemoData()`. Ajout de `LEGACY_DEMO_TAG` et `DEMO_COMPANIES`.
- **Deploiement Cloudflare** : erreur `pages-manifest.json` ENOENT (OpenNext vs Pages).
  Correction : Cloudflare **Pages** (pas Workers), build `npm run build`, output `out`.
- **Ecran blanc intermittent** : CSP `script-src 'self'` bloquait les scripts inline de
  Next.js (`output: "export"`). Correction : hashes SHA-256 dans `public/_headers`.

### Ajoute — Fondation (PR #2)

- **Design system Velora** : tokens prune-noir / rose poudre / lavande, typographie
  Cormorant Garamond (titres) + Inter (interface), cartes arrondies 20-28 px.
- **Shell applicatif** : sidebar, header, navigation mobile.
- **Dashboard « Aujourd'hui »** : vue personnalisee avec KPIs.
- **PWA** : service worker, manifest, icones.
- **Etat UI (Zustand)** : contrat de securite — jamais de cle ni de phrase dans le store.

---

## [0.1.0] — Fondation (historique)

*Criteres d'acceptation : voir le milestone
[v0.1.0 — MVP local-first](https://github.com/YFA-20/Caryon/milestones).*

- Design system, interface responsive, mode demonstration.
- Coffre-fort local chiffre (AES-256-GCM, Argon2id).
- Creation et modification des candidatures (Kanban + tableau).
- Documents chiffres, recherche, sauvegarde chiffree.
- Tests essentiels, deploiement Cloudflare.
