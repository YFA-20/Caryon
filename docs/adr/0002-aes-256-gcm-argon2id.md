# ADR 0002 — AES-256-GCM (Web Crypto) + Argon2id pour le coffre-fort

- **Statut** : Adopté
- **Date** : 2026-10-22

## Contexte

Toutes les données sensibles doivent être chiffrées au repos (IndexedDB) avec
authentification, et la phrase secrète doit résister aux attaques hors ligne.

## Décision

- **Chiffrement** : AES-256-GCM via Web Crypto, nonce aléatoire 96 bits **unique par
  opération**, AAD = métadonnées authentifiées, format versionné.
- **KDF** : Argon2id (m=64 MiB, t=3, p=1, sortie 256 bits, sel 128 bits unique par coffre),
  via bibliothèque auditée compatible navigateur. Fallback PBKDF2-HMAC-SHA-256 documenté
  et explicitement présenté comme moins résistant si Argon2id est indisponible.
- **Hiérarchie** : phrase → Argon2id → KEK → unwrap → clé maîtresse (DEK, 256 bits aléatoire)
  → chiffre les données. Phrase jamais stockée ; DEK jamais stockée en clair.

## Conséquences

### Positives

- AEAD : confidentialité + intégrité + détection de toute modification.
- Argon2id : résistance GPU/ASIC/mémoire-dure, recommandé OWASP.
- Clé maîtresse indépendante de la phrase : permet (Phase 4) de changer de phrase sans
  rechiffrer toutes les données.

### Négatives / risques

- WASM requis pour Argon2id (taille de bundle, chargement) ; fallback nécessaire.
- KDF lente : UX au déverrouillage (calibration documentée).
- Ne protège pas contre un appareil compromis ou une extension malveillante (documenté).

## Alternatives rejetées

- **AES-CBC + HMAC séparé** : plus d'erreurs possibles (padding, ordre MAC) ; GCM est
  l'AEAD standard.
- **PBKDF2 seul** : moins résistant aux attaques matérielles qu'Argon2id.
- **Chiffrement « maison »** : interdit par principe.

## Liens

- [docs/security/cryptography.md](../security/cryptography.md)
- [docs/security/threat-model.md](../security/threat-model.md)
