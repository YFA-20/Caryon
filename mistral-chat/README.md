# Chat Mistral — démo locale

App web **minimale** qui appelle l'API Mistral avec le SDK TypeScript officiel
[`@mistralai/mistralai`](https://www.npmjs.com/package/@mistralai/mistralai).

- **Interface de chat simple** : `public/` (HTML/CSS/JS vanilla, aucun framework front).
- **Modèle** : `mistral-large-4` par défaut (surchargeable via `MISTRAL_MODEL`).
- **Clé secrète côté serveur uniquement** : `MISTRAL_API_KEY` est lue par `src/server.ts`
  depuis `.env` (jamais commité, jamais envoyée au navigateur). Le front n'appelle que
  l'endpoint local `POST /api/chat` ; le serveur relaie la conversation à l'API Mistral.

## Prérequis

- Node.js 22 (voir `.nvmrc` à la racine du dépôt) et npm 10.
- Une clé API Mistral, à créer sur <https://console.mistral.ai> (section « API keys »).

## Installation

```bash
cd mistral-chat
npm install
```

## Configuration

```bash
cp .env.example .env
# Éditez .env et renseignez MISTRAL_API_KEY=... (et éventuellement MISTRAL_MODEL / PORT)
```

## Lancer localement (développement)

```bash
npm run dev
# → interface sur http://localhost:3001
```

## Lancer en mode production

```bash
npm run build
npm start
# → http://localhost:3001 (PORT configurable dans .env)
```

## Vérifications

```bash
npm run typecheck   # TypeScript strict
curl http://localhost:3001/api/health
# → {"ok":true,"model":"mistral-large-4"}  (aucun secret exposé)
```

## Fonctionnement

| Endpoint      | Méthode | Rôle                                                                                                                                                                                |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`           | GET     | Sert l'interface de chat (`public/`).                                                                                                                                               |
| `/api/health` | GET     | Sonde : renvoie `{ ok, model }` — **aucune clé** n'est jamais renvoyée.                                                                                                             |
| `/api/chat`   | POST    | Reçoit `{ "messages": [{ "role": "user", "content": "…" }] }`, appelle `client.chat.complete({ model, messages })` via le SDK officiel et renvoie `{ "reply": "…", "model": "…" }`. |

Le serveur écoute sur `127.0.0.1` uniquement, limite la taille des requêtes (64 Ko) et des
messages (50 messages, 8000 caractères par contenu), et applique des en-têtes de sécurité
(CSP, `nosniff`, etc.). En cas d'erreur de l'API Mistral, le client reçoit un message
générique (les détails restent dans les logs serveur).

## Arborescence

```
mistral-chat/
├── package.json      # dépendances + scripts (dev / build / start / typecheck)
├── tsconfig.json     # TypeScript strict (NodeNext)
├── .env.example      # modèle de configuration (MISTRAL_API_KEY, MISTRAL_MODEL, PORT)
├── src/server.ts     # serveur Node (sans framework) : statique + POST /api/chat (SDK Mistral)
└── public/           # interface de chat (index.html, app.js, style.css)
```
