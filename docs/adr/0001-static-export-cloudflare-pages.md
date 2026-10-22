# ADR 0001 — Frontend 100 % statique (export Next.js) sur Cloudflare Pages

- **Statut** : Adopté
- **Date** : 2026-10-22
- **Contexte** : Velora est local-first ; les opérations courantes ne nécessitent aucun
  serveur applicatif. Le cahier des charges impose de privilégier une application statique
  lorsque compatible, et d'héberger sur Cloudflare.

## Décision

Next.js avec `output: "export"` (répertoire `out/`), déployé sur **Cloudflare Pages**.
Aucun serveur Node en production pour l'application. Cloudflare Workers ne seront introduits
qu'en Phase 4 (synchronisation opt-in) et pour l'IA (proxy sans secret côté client).

## Conséquences

### Positives

- Surface d'attaque minimale (pas de serveur à compromettre pour les données métier).
- Coût nul, CDN mondial, HTTPS/HSTS natifs.
- Fonctionnement hors ligne naturel (PWA).
- Les données ne quittent jamais l'appareil (hors sync opt-in Phase 4).

### Négatives / risques

- Pas de rendu serveur (SEO non pertinent pour une app privée ; métadonnées de base suffisent).
- Pas de secret côté serveur possible → l'IA en Phase 3 nécessitera un **Worker proxy**
  (aucune clé API dans le frontend) ou un modèle local.
- La CSP et les en-têtes de sécurité doivent être servis par le CDN (`public/_headers`).

## Alternatives rejetées

- **Next.js serveur (Node/SSR)** : surface d'attaque inutile pour une app local-first.
- **Vercel/Netlify** : Cloudflare est la cible imposée ; Workers/R2/D1 offrent la suite
  cohérente pour la Phase 4.

## Liens

- [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/DEPLOYMENT.md](../DEPLOYMENT.md)
- [docs/security/threat-model.md](../security/threat-model.md)
