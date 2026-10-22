# ADR 0003 — Aucune télémétrie, architecture local-first stricte

- **Statut** : Adopté
- **Date** : 2026-10-22

## Contexte

La confidentialité est une exigence fondamentale. Toute donnée envoyée à un tiers réduit
la confiance et élargit la surface d'attaque.

## Décision

- **Aucune télémétrie**, aucun analytics, aucun tracker publicitaire, aucun outil tiers
  de monitoring dans l'application.
- **Aucun appel réseau** pour les opérations de base (création/consultation d'une
  candidature, coffre, documents).
- L'IA (Phase 3) est **opt-in** : consentement explicite, liste exacte des champs envoyés,
  envoi minimal, aucune clé API côté client.
- Les erreurs ne sont pas « rapportées » automatiquement ; l'utilisateur peut exporter une
  sauvegarde chiffrée s'il le souhaite.

## Conséquences

### Positives

- Minimisation des données (Privacy by Design), confiance utilisateur, conformité RGPD
  naturelle (aucune collecte).
- Critère d'acceptation n°7 (aucun appel réseau) vérifiable en E2E.

### Négatives

- Pas de métriques d'usage agrégées (choix assumé).
- Diagnostic des bugs plus difficile (pas de stack trace distante) → journal local
  optionnel, sans données sensibles, exportable manuellement.

## Alternatives rejetées

- Analytics « anonymisés » (Plausible, etc.) : toute donnée transmise est une fuite
  potentielle ; rejeté par principe pour cette application.

## Liens

- [docs/security/threat-model.md](../security/threat-model.md)
- [docs/security/data-flow.md](../security/data-flow.md)
