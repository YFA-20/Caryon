# Feuille de route — Velora

Les jalons sont aussi suivis via les [Milestones GitHub](https://github.com/YFA-20/Caryon/milestones).
**Une version n'est publiée que lorsque ses critères d'acceptation sont réellement satisfaits.**

## Phase 1 — MVP utilisable (v0.1.0)

- [ ] Design system (tokens, typographie serif/sans, composants de base)
- [ ] Interface responsive (sidebar → barre inférieure sur mobile)
- [ ] Mode démonstration (données fictives clairement identifiées et isolées)
- [ ] Coffre-fort local chiffré (Argon2id + AES-256-GCM, verrouillage auto)
- [ ] Création et modification des candidatures
- [ ] Vues Kanban et tableau
- [ ] Documents chiffrés (import PDF/DOCX, stockage chiffré)
- [ ] Recherche locale
- [ ] Sauvegarde chiffrée (export/restauration)
- [ ] Tests essentiels (unitaires + crypto + E2E de base)
- [ ] Déploiement Cloudflare (preview + production)

**Critères de sortie de phase** : les 12 critères d'acceptation du cahier des charges §17
passent en CI, dont : persistance hors ligne, illisibilité du ciphertext, détection de
modification (GCM), restauration, aucun appel réseau pour créer/consulter une candidature.

## Phase 2 — Productivité (v0.3.0, v0.2.0)

- [ ] Calendrier (mois/semaine/jour), relances, échéances
- [ ] Notifications locales + export ICS
- [ ] Journal de recherche
- [ ] Statistiques locales (taux de réponse, temps moyen, sources)
- [ ] PWA hors ligne complète (service worker, cache maîtrisé)
- [ ] Préparation des entretiens (fiches, questions)

## Phase 3 — Intelligence (v0.4.0)

- [ ] Analyse d'offres (extraction compétences, contraintes)
- [ ] Comparaison CV / offre
- [ ] Génération assistée (lettres, reformulations) — jamais d'invention de faits
- [ ] Préparation d'entretien interactive
- [ ] Paramètres de confidentialité IA (consentement explicite, champ par champ)

## Phase 4 — Multi-appareils (v0.5.0)

- [ ] Authentification (séparée du déverrouillage du coffre)
- [ ] Synchronisation chiffrée (Workers + R2 + D1)
- [ ] Association d'appareils, révocation
- [ ] Gestion des conflits (pas de perte silencieuse), tombstones
- [ ] Restauration multi-appareils

## v1.0.0 — Version stable

Validation complète : sécurité (audit crypto), accessibilité (WCAG 2.2 AA), restauration
testée, documentation à jour, toutes les CI vertes.
