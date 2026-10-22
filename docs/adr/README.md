# ADR — Architecture Decision Records (Velora)

Les décisions d'architecture significatives sont documentées ici, de manière traçable.

| ID                                             | Titre                                        | Statut |
| ---------------------------------------------- | -------------------------------------------- | ------ |
| [0001](0001-static-export-cloudflare-pages.md) | Frontend 100 % statique sur Cloudflare Pages | Adopté |
| [0002](0002-aes-256-gcm-argon2id.md)           | AES-256-GCM + Argon2id pour le coffre-fort   | Adopté |
| [0003](0003-no-telemetry-local-first.md)       | Aucune télémétrie, local-first strict        | Adopté |

## Format

Chaque ADR contient : Statut, Date, Contexte, Décision, Conséquences (positives/négatives),
Alternatives rejetées, Liens.

## Procédure

Toute décision de sécurité significative doit être ajoutée ici et référencée dans
[../security/security-decisions.md](../security/security-decisions.md).
