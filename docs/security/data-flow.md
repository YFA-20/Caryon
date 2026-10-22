# Flux de données — Velora

## Flux 1 : Création d'une candidature (hors ligne)

```
Saisie (formulaire)
  → Validation Zod (schéma Application)
  → Service applications.create()
  → Sérialisation (JSON canonique)
  → Chiffrement AES-256-GCM (clé maîtresse, nonce aléatoire, AAD = métadonnées)
  → Dexie/IndexedDB : { id, schemaVersion, updatedAt, ciphertext }
  → Historique (ActivityEvent) chiffré de la même manière
```

**Réseau : aucun appel.** (Critère d'acceptation n°7.)

## Flux 2 : Déverrouillage du coffre

```
Saisie phrase secrète (champ mot de passe, jamais loguée)
  → Argon2id(phrase, sel) → KEK (mémoire)
  → Déballage (unwrap) de la clé maîtresse chiffrée
  → Vérification via le challenge AEAD (succès/échec)
  → Clé maîtresse conservée en mémoire (session)
  → Effacement du buffer de la phrase (références)
```

**Échec** : message générique, délai anti-énumération (KDF lente), aucune donnée révélée.

## Flux 3 : Export de sauvegarde

```
Données + documents (déchiffrés en mémoire)
  → Re-chiffrement dans l'archive (clé de sauvegarde, Argon2id)
  → Manifeste (SHA-256, versions, horodatage)
  → Téléchargement local (jamais de réseau)
```

## Flux 4 : Restauration de sauvegarde

```
Fichier importé (File API, validation MIME/taille)
  → Validation Zod du manifeste
  → Déchiffrement (AEAD — échec = rejet total)
  → Vérification d'intégrité par enregistrement
  → Migration de schéma si nécessaire (versionnée, testée)
  → Écriture dans IndexedDB
```

## Flux 5 : Assistant IA (opt-in, Phase 3)

```
Utilisateur colle une offre / sélectionne un CV
  → Écran de consentement : liste EXACTE des champs envoyés
  → Consentement explicite (AIRequestConsent enregistré, horodaté)
  → Envoi minimal (champs cochés uniquement)
  → Réponse affichée, aucune donnée IA stockée en clair au-delà du consentement
```

**Sans consentement : aucun appel.** (Critère n°8.) Aucune clé API côté client
(proxy Cloudflare Worker en Phase 3, ou modèle local).

## Flux 6 (Phase 4) : Synchronisation chiffrée

```
Données locales → chiffrement client (clé maîtresse) → upload R2 (blobs chiffrés)
Métadonnées minimales (ids opaques, versions) → D1 via Worker
Serveur : ne reçoit JAMAIS la clé maîtresse ni les données en clair.
```

## Flux 7 : Télémétrie

**Aucun.** Pas d'analytics, pas de tracker, pas de logs de données sensibles.
