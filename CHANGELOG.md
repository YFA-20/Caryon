# Changelog

Toutes les modifications notables de Velora sont documentées dans ce fichier.

Le format est inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet
adhère au [Versionnage Sémantique](https://semver.org/lang/fr/).

## [Non publié]

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
