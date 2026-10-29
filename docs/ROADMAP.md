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
- [x] Tests unitaires (421 tests, 40 fichiers)

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
- [x] Mode local WebLLM (intégré — @mlc-ai/web-llm, WebGPU, modèles Hugging Face)

## 🔄 Phase 3 — Multi-appareils (v0.4.0) — EN COURS

- [x] Fondations sync : schémas Zod (enveloppes, pairing, devices) — `src/lib/sync/schema.ts`
- [x] Store Zustand sync (état UI uniquement, jamais de clé) — `src/store/sync-store.ts`
- [x] Service sync client (push/pull/pairing/revoke) — `src/lib/sync/sync-service.ts`
- [x] Chiffrement client avant envoi (AES-256-GCM, le serveur ne voit que du ciphertext)
- [x] Backend sync (Cloudflare Workers + R2 + D1) — `worker/`
- [x] UI : carte Synchronisation dans les paramètres
- [x] Indicateur de sync dans le header (badge)
- [x] CSP : domaine Worker dans `connect-src`
- [x] CI : workflow de déploiement du Worker
- [x] UI appairage : page `/appairage` (génération code 6 chiffres + saisie + polling)
- [x] Preuve de possession (HMAC dérivée du coffre) — `src/lib/sync/pairing-proof.ts`
- [x] Liste des appareils appairés + révocation (UI)
- [x] Sync automatique : hook `useAutoSync` (périodique 5 min + focus + visibilité)
- [x] Navigation : item « Appairage » + recherche globale (Ctrl+K)
- [x] Appairage : approbation/refus des demandes côté appareil A (endpoint `/pairing/pending` + UI)
- [ ] Restauration multi-appareils (nouvel appareil depuis un backup cloud)

## 🔲 Phase 4 — Production & Release (v1.0.0)

- [ ] Protection de la branche `main` (GitHub branch protection)
- [ ] Dependabot configure (`.github/dependabot.yml`)
- [ ] Tag `v0.2.0` + release GitHub (notes de release auto)
- [ ] Audit de securite externe (optionnel)
- [ ] Accessibilite WCAG 2.2 AA (audit complet)
- [ ] Documentation utilisateur (guide, FAQ)
- [ ] Choix de licence (actuellement proprietaire — voir #1)

## 🐛 Bugs connus (différés)

| Bug           | Description                                                                                                                                                                                                    | Priorite            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| npm audit zod | Faux positif confirmé : la CVE GHSA-mrhx-c7xc-m3w5 affecte zod v4 (< 4.6.6). Velora utilise zod v3.25.76. Vérifié par `scripts/check-zod-cve.mjs` en CI. Tous les schemas utilisent `.max()` sur les tableaux. | Faible (cosmetique) |
| npm audit dev | 9 vulnérabilités en dev uniquement (vitest, vite, esbuild, serve/compression, tinypool). Aucune en production. Suivies via Dependabot.                                                                         | Faible              |
| E2E local     | Playwright Chromium ne tourne pas dans le sandbox (lib manquante). E2E en CI uniquement.                                                                                                                       | Info                |

---

## Prochaines priorites recommandees

1. **Phase 3 — Multi-appareils** (le gros morceau restant)
2. **Protection branche main** (hygiene repo — à faire manuellement sur GitHub)
3. **Phase 4 — Production v1.0.0** (accessibilité WCAG, doc utilisateur, audit externe)
