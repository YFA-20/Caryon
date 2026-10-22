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

## Configuration Cloudflare Pages (dashboard)

Lors de la création du projet Pages connecté à Git :

| Paramètre              | Valeur                         |
| ---------------------- | ------------------------------ |
| Production branch      | `main`                         |
| Framework preset       | `Next.js (Static HTML Export)` |
| Build command          | `npm run build`                |
| Build output directory | `out`                          |
| Node.js version        | `22`                           |

> ⚠️ **Le dossier de sortie est `out`** (généré par `output: "export"`), pas `.next`.

## CSP et scripts inline (critique)

Next.js `output: "export"` injecte des **scripts inline** dans le HTML (payload RSC /
hydratation React). Une CSP stricte `script-src 'self'` **bloque ces scripts** →
**page blanche intermittente** (l'hydratation échoue silencieusement).

### Solution : hashes SHA-256

Le script `scripts/update-csp-hashes.mjs` (exécuté via `postbuild`) :

1. Lit `out/index.html` et `out/404.html`.
2. Extrait chaque `<script>...</script>` inline.
3. Calcule le hash SHA-256 (base64) de chacun.
4. Réécrit `out/_headers` avec `script-src 'self' 'sha256-...' 'sha256-...'`.

**Avantage** : seuls les scripts inline générés par le build sont autorisés.
Aucun `'unsafe-inline'`, aucun `'unsafe-eval'`.

```
script-src 'self' 'sha256-OBTN3RiyCV4Bq7dFqZ5a2pAXjnCcCYeTJMO2I/LYKeo=' ...
```

> Les hashes changent à chaque build si le contenu des scripts inline change
> (build ID Next.js). Le `postbuild` les recalcule automatiquement.

## En-têtes de sécurité

Définis dans `next.config.ts` (`headers()`) et **dupliqués dans `out/_headers`**
(appliqués par Cloudflare Pages, indépendants du framework) :

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-...'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
```

> `style-src 'unsafe-inline'` est requis par les feuilles de style inline de certains
> composants ; aucun script inline non hashé n'est autorisé.

## Cache & PWA

- Assets statiques (`/_next/static/*`, polices, icônes) : `Cache-Control: public, max-age=31536000, immutable`.
- `manifest.webmanifest` et `sw.js` : `Cache-Control: no-cache` (mise à jour fiable de la PWA).
- Le service worker gère lui-même le cache runtime (offline-first, network-first pour le HTML).

## Déploiement automatique (GitHub Actions)

Deux workflows :

### `deploy.yml` — Production

- **Déclencheur** : push sur `main` + `workflow_dispatch` (manuel).
- **Vérifications** : typecheck, lint, tests unitaires, build, validation CSP.
- **Déploiement** : `wrangler pages deploy out --project-name=caryon --branch=main`.
- **Environnement** : `production` (URL : `https://caryon.pages.dev`).

### `deploy-preview.yml` — Preview (PR)

- **Déclencheur** : ouverture/synchronisation de PR.
- **Vérifications** : identiques à la production.
- **Déploiement** : `wrangler pages deploy out --project-name=caryon --branch=pr-<numéro>`.
- **Commentaire** : poste l'URL de preview sur la PR.

### Secrets requis (GitHub → Settings → Secrets)

| Secret                  | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token Cloudflare avec permission `Cloudflare Pages:Edit` uniquement |
| `CLOUDFLARE_ACCOUNT_ID` | Identifiant du compte Cloudflare                                    |

> **Préféré** : OIDC (Cloudflare Workers/Pages) — jetons éphémères, aucun secret long terme.
> Le workflow actuel utilise un API token à permissions minimales en attendant.

## Déploiement manuel (Cloudflare Dashboard)

Si tu préfères ne pas utiliser GitHub Actions :

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Sélectionne `YFA-20/Caryon`.
3. Configure (voir tableau ci-dessus).
4. **Save and Deploy**.

Cloudflare Pages déploie automatiquement chaque push sur `main` (production) et
chaque branche/PR (preview `*.pages.dev`).

## Rollback

1. Dans Cloudflare Pages, onglet **Deployments** : identifier le déploiement précédent stable.
2. Cliquer **Rollback to this deployment** (instantané, aucune perte de données —
   l'app est local-first, les données vivent sur les appareils).
3. Vérifier la santé : chargement de l'app, déverrouillage du coffre, création d'une
   candidature (tests E2E de fumée).
4. Communiquer l'incident et la version restaurée (voir
   [docs/security/incident-response.md](security/incident-response.md)).

## Vérifications post-déploiement

- [ ] L'app se charge en HTTPS, sans erreur console.
- [ ] **La page n'est PAS blanche** (vérifier que l'hydratation React fonctionne).
- [ ] Le manifest PWA est servi (`/manifest.webmanifest`) et l'installation est proposée.
- [ ] Le service worker s'enregistre ; l'app fonctionne hors ligne (DevTools → Offline).
- [ ] Les en-têtes de sécurité sont présents (`curl -I`).
- [ ] La CSP contient des hashes `sha256-` et ne bloque pas l'app (aucune violation dans la console).

## Dépannage

### Page blanche intermittente

**Cause** : la CSP bloque les scripts inline de Next.js (hydratation React échoue).

**Vérification** :

```bash
curl -sI https://caryon.pages.dev | grep -i content-security-policy
# Doit contenir: script-src 'self' 'sha256-...'
```

**Solution** : le `postbuild` doit avoir généré les hashes. Vérifier `out/_headers`.
Si tu déploies manuellement, assure-toi de builder avec `npm run build` (qui inclut `postbuild`).

### Ancien déploiement servi (cache navigateur)

**Cause** : le navigateur ou le SW a mis en cache l'ancienne version.

**Solution** :

1. Hard refresh : `Ctrl+Shift+R` (ou `Cmd+Shift+R` sur Mac).
2. DevTools → Application → Service Workers → **Unregister**.
3. DevTools → Application → Cache Storage → supprimer tous les caches.
4. Recharger.

### Build échoue sur Cloudflare Pages

**Cause** : `wrangler deploy` (Workers) est appelé au lieu de Pages, ou le dossier
de sortie est mal configuré.

**Solution** : utiliser **Pages** (pas Workers), dossier de sortie `out`.
