# Déploiement Cloudflare — Velora

## Stratégie

Velora est un **frontend 100 % statique** (Next.js `output: "export"`). Il est déployé sur
**Cloudflare Pages**. Aucun serveur applicatif n'est requis pour les fonctionnalités
local-first.

| Environnement  | Source                                                          | Données                     | Secrets                                |
| -------------- | --------------------------------------------------------------- | --------------------------- | -------------------------------------- |
| **Preview**    | Chaque Pull Request                                             | Aucune donnée réelle        | Secrets de preview séparés             |
| **Production** | Release validée (tag `vX.Y.Z`) ou commit explicitement approuvé | Aucune donnée (local-first) | Secrets de production, OIDC privilégié |

## Prérequis

1. Un compte Cloudflare et un projet **Pages** connecté au dépôt GitHub `YFA-20/Caryon`.
2. Build command : `npm ci && npm run build` → répertoire de sortie : `out`.
3. Node.js 22 (fichier `.nvmrc` respecté par Cloudflare Pages).

## En-têtes de sécurité

Définis dans `next.config.ts` (`headers()`) et **dupliqués dans `public/_headers`**
(appliqués par Cloudflare Pages, indépendants du framework) :

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
```

> `style-src 'unsafe-inline'` est requis par les feuilles de style inline de certains
> composants ; aucun script inline n'est autorisé (`script-src 'self'` strict).

## Cache & PWA

- Assets statiques (`/_next/static/*`, polices, icônes) : `Cache-Control: public, max-age=31536000, immutable`.
- `manifest.webmanifest` et `sw.js` : `Cache-Control: no-cache` (mise à jour fiable de la PWA).
- Le service worker gère lui-même le cache runtime (offline-first).

## Déploiement Preview (par PR)

Cloudflare Pages déploie automatiquement chaque branche poussée (dont les PR) sur une URL
de preview (`*.pages.dev`). Aucune donnée de production n'y transite (l'app est local-first).

## Déploiement Production (manuel, contrôlé)

1. Créer une release via le workflow `release.yml` (déclenchement manuel, version SemVer
   vérifiée contre `package.json`) : vérifications bloquantes → tag annoté `vX.Y.Z` →
   GitHub Release (notes générées depuis `CHANGELOG.md`).
2. Le déploiement production est **manuel** (Cloudflare Pages : déploiement du commit taggé,
   ou workflow dédié avec approbation via GitHub Environments).
3. **Jamais de déploiement automatique d'une modification non testée.**

### Credentials

- **Préféré** : **OIDC** (Cloudflare Pages/Workers : jetons éphémères, aucun secret long).
- Sinon : `CLOUDFLARE_API_TOKEN` à **permissions minimales** (Pages:Edit uniquement),
  stocké dans les **secrets GitHub** — jamais dans le code ni dans un fichier suivi.
- `CLOUDFLARE_ACCOUNT_ID` en variable d'environnement du projet Pages.

## Rollback

1. Dans Cloudflare Pages, onglet **Deployments** : identifier le déploiement précédent
   stable.
2. Cliquer **Rollback to this deployment** (instantané, aucune perte de données —
   l'app est local-first, les données vivent sur les appareils).
3. Vérifier la santé : chargement de l'app, déverrouillage du coffre, création d'une
   candidature (tests E2E de fumée).
4. Communiquer l'incident et la version restaurée (voir
   [docs/security/incident-response.md](security/incident-response.md)).

## Vérifications post-déploiement

- [ ] L'app se charge en HTTPS, sans erreur console.
- [ ] Le manifest PWA est servi (`/manifest.webmanifest`) et l'installation est proposée.
- [ ] Le service worker s'enregistre ; l'app fonctionne hors ligne (DevTools → Offline).
- [ ] Les en-têtes de sécurité sont présents (`curl -I`).
- [ ] La CSP ne bloque pas l'app (aucune violation dans la console).
