# Frontières de confiance — Velora

## Vue d'ensemble

```
 ┌──────────── Zone de confiance ÉLEVÉE (appareil utilisateur) ────────────┐
 │                                                                         │
 │   ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌─────────────────────┐   │
 │   │  Saisie  │→ │  Zod     │→ │  Services  │→ │  Crypto (AES-GCM)   │   │
 │   │  (UI)    │  │(validation│  │  (métier)  │  │  + clé maîtresse    │   │
 │   └──────────┘  └──────────┘  └────────────┘  │  (mémoire, session) │   │
 │                                                └─────────┬───────────┘   │
 │                                                          ↓               │
 │                                                ┌─────────────────────┐   │
 │                                                │  IndexedDB (Dexie)  │   │
 │                                                │  ciphertext + métadonnées│
 │                                                └─────────────────────┘   │
 └─────────────────────────────────────────────────────────────────────────┘
        │  HTTPS (TLS) — frontière réseau
        ▼
 ┌──────────── Zone SEMI-CONFIBLE (hébergeur) ────────────┐
 │  Cloudflare Pages : sert les assets (code applicatif)  │
 │  Cloudflare Workers/R2/D1 (Phase 4) : blobs chiffrés,  │
 │  métadonnées minimales — jamais de clés, jamais de clair│
 └────────────────────────────────────────────────────────┘
        │  Internet (méfiance)
        ▼
 ┌──────────── Zone MÉFIANCE ────────────┐
 │  Fournisseur IA (opt-in, consentements) │
 │  Auteurs de dépendances (supply chain)  │
 │  Extensions navigateur, appareil compromis│
 └─────────────────────────────────────────┘
```

## Règles aux frontières

| Frontière            | Règle                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| Saisie → App         | Validation Zod systématique ; longueurs, types, formats contraints                 |
| App → IndexedDB      | Chiffrement AEAD **avant** persistance ; métadonnées techniques minimales en clair |
| App → Réseau         | **Aucun appel par défaut** ; IA : consentement explicite + envoi minimal           |
| App → Archive        | Re-chiffrement + intégrité (AEAD + manifeste)                                      |
| Archive → App        | Validation + AEAD ; rejet total si invalide                                        |
| Appareil → Hébergeur | TLS ; le serveur ne reçoit jamais les clés ni le clair                             |
| Hébergeur → App      | Code servi = code audité (CI, supply chain) ; CSP en profondeur                    |

## Données pouvant transiter en clair (et pourquoi c'est acceptable)

- **Métadonnées techniques minimales** dans IndexedDB (id, `schemaVersion`, `updatedAt`) :
  nécessaires à l'indexation Dexie ; elles ne révèlent pas le contenu.
- **Métadonnées côté serveur (Phase 4)** : ids opaques, versions, horodatages — jamais de
  contenu métier. C'est la limite de tout système de sync ; documentée honnêtement.
- **Sel Argon2id** : stocké en clair par conception (son rôle est l'unicité, pas la
  confidentialité).
