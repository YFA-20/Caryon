# Feuille de route — Velora

Les jalons sont aussi suivis via les [Milestones GitHub](https://github.com/YFA-20/Caryon/milestones).
**Une version n'est publiee que lorsque ses criteres d'acceptation sont reellement satisfaits.**

> **Mise a jour** : Phases 0-2 sont terminees (PRs #2-#17). La roadmap reflete l'etat reel du projet.

---

## ✅ Phase 0 — Fondation (v0.1.0) — TERMINEE

- [x] Design system (tokens, typographie serif/sans, composants de base)
- [x] Interface responsive (sidebar → barre inferieure sur mobile)
- [x] Dashboard « Aujourd'hui » (KPIs, pipeline, evenements a venir)
- [x] PWA (service worker, manifest, icones)
- [x] Etat UI Zustand (contrat de securite : jamais de cle dans le store)
- [x] CI/CD (GitHub Actions : ci, security, e2e, release, deploy)
- [x] Deploiement Cloudflare Pages (statique, `output: "export"`)
- [x] CSP restrictive avec hashes SHA-256 pour scripts inline
- [x] Documentation (ARCHITECTURE, ROADMAP, DEPLOYMENT, threat model, crypto, ADR)

## ✅ Phase 1 — MVP local-first (v0.2.0) — TERMINEE

- [x] Coffre-fort local chiffre (Argon2id + AES-256-GCM, verrouillage auto)
- [x] Creation, modification, suppression des candidatures
- [x] Vues Kanban (drag & drop) et liste
- [x] Recherche instantanee + filtres par statut
- [x] Documents chiffres (upload PDF/DOC/DOCX/TXT/PNG/JPG, stockage chiffre IndexedDB)
- [x] Sauvegarde chiffree (export/restauration `.velora`, manifeste SHA-256)
- [x] Calendrier (evenements, export ICS)
- [x] Analyses (statistiques locales : taux de reponse, delai moyen, sources)
- [x] Mode demonstration (donnees fictives, nettoyage auto a la desactivation)
- [x] Notifications locales (rappels relances/entretiens)
- [x] Auto-lock (15 min configurable, prolongement sur activite)
- [x] Journal de recherche (notes chiffrees)
- [x] Preparation d'entretiens (fiches, questions, checklist)
- [x] Palette de commandes (Cmd+K)
- [x] Annulation (undo) des suppressions
- [x] Skeletons + raccourcis clavier + onboarding
- [x] Tests unitaires (355 tests, 34 fichiers)

**Critères de sortie atteints** : persistance hors ligne, illisibilite du ciphertext,
detection de modification (GCM), restauration, aucun appel reseau pour les operations de base.

## ✅ Phase 2 — Intelligence / IA (v0.3.0) — TERMINEE

- [x] Fondations IA : consentement explicite (modal preview), service cloud/local abstrait
- [x] Analyse d'offre IA (extraction competences, contraintes, pre-remplissage candidature)
- [x] Comparaison CV ↔ Offre IA (score, competences presentes/manquantes, suggestions)
- [x] Generation de lettre de motivation IA (brouillon editable, copie)
- [x] Preparation d'entretien IA (questions par categorie, suggestions, conseils)
- [x] Page de controle IA (`/ia`) + parametres IA (`/parametres#ia`)
- [x] Anonymisation des donnees avant envoi cloud
- [x] Cle API chiffree dans le vault (jamais en clair)
- [ ] Mode local WebLLM (stub — a implementer si besoin 100% offline)

## 🔲 Phase 3 — Multi-appareils (v0.4.0) — A VENIR

- [ ] Backend sync (Cloudflare Workers + R2 + D1)
- [ ] Chiffrement client avant envoi (AES-256-GCM, le serveur ne voit que du ciphertext)
- [ ] Appairage appareils (QR code / code 6 chiffres)
- [ ] Sync incrementale (deltas, last-write-wins)
- [ ] Gestion des conflits (tombstones, pas de perte silencieuse)
- [ ] Indicateur de sync dans le header
- [ ] Revocation d'appareils
- [ ] Restauration multi-appareils

## 🔲 Phase 4 — Production & Release (v1.0.0)

- [ ] Protection de la branche `main` (GitHub branch protection)
- [ ] Dependabot configure (`.github/dependabot.yml`)
- [ ] Tag `v0.2.0` + release GitHub (notes de release auto)
- [ ] Audit de securite externe (optionnel)
- [ ] Accessibilite WCAG 2.2 AA (audit complet)
- [ ] Documentation utilisateur (guide, FAQ)
- [ ] Choix de licence (actuellement proprietaire — voir #1)

## 🐛 Bugs connus (différés)

| Bug                             | Description                                                                                                                                                      | Priorite            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Auto-lock au refresh navigateur | Le bouton ↻ du navigateur declenche un verrouillage immediat (meme mecanisme que F5). Fix prevu : persister `lastActivityAt` dans `sessionStorage` ou IndexedDB. | Moyenne             |
| npm audit zod                   | 1 advisory high (CVE-2023-54404) — affecte zod v4 uniquement. Tous les schemas Velora utilisent `.max()` sur les tableaux.                                       | Faible (cosmetique) |
| E2E local                       | Playwright Chromium ne tourne pas dans le sandbox (lib manquante). E2E en CI uniquement.                                                                         | Info                |

---

## Prochaines priorites recommandees

1. **Phase 3 — Multi-appareils** (le gros morceau restant)
2. **Dependabot + protection branche main** (hygiene repo)
3. **Tag v0.2.0 + release GitHub** (premiere version partageable)
4. **WebLLM local** (si besoin IA 100% offline)
