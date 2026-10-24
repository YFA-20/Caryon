# ADR — Architecture Decision Records (Velora)

Les decisions d'architecture significatives sont documentees ici, de maniere tracable.

| ID                                             | Titre                                            | Statut |
| ---------------------------------------------- | ------------------------------------------------ | ------ |
| [0001](0001-static-export-cloudflare-pages.md) | Frontend 100 % statique sur Cloudflare Pages     | Adopte |
| [0002](0002-aes-256-gcm-argon2id.md)           | AES-256-GCM + Argon2id pour le coffre-fort       | Adopte |
| [0003](0003-no-telemetry-local-first.md)       | Aucune telemetrie, local-first strict            | Adopte |
| [0004](0004-ai-opt-in-consent-cloud-local.md)  | Assistant IA : opt-in, consentement, cloud/local | Adopte |
| [0005](0005-auto-lock-session.md)              | Verrouillage automatique (auto-lock) et session  | Adopte |

## Format

Chaque ADR contient : Statut, Date, Contexte, Decision, Consequences (positives/negatives),
Alternatives rejetees, Liens.

## Procedure

Toute decision de securite significative doit etre ajoutee ici et referencee dans
[../security/security-decisions.md](../security/security-decisions.md).
