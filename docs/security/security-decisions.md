# Décisions de sécurité — Velora

Journal traçable des décisions de sécurité significatives (voir aussi `docs/adr/`).

| ID     | Date       | Décision                                                                             | Justification                                                                                         | Statut                                                 |
| ------ | ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| SD-001 | 2026-10-22 | Frontend 100 % statique (`output: "export"`) sur Cloudflare Pages                    | Réduit drastiquement la surface d'attaque : pas de serveur applicatif pour les opérations local-first | Adopté                                                 |
| SD-002 | 2026-10-22 | AES-256-GCM (Web Crypto) pour tout enregistrement sensible                           | AEAD standard, authentification intégrée, natif navigateur                                            | Adopté                                                 |
| SD-003 | 2026-10-22 | Argon2id pour la dérivation de clé (fallback PBKDF2 documenté)                       | Recommandé OWASP, résistant aux attaques matérielles                                                  | Adopté                                                 |
| SD-004 | 2026-10-22 | Clé maîtresse aléatoire par coffre, enveloppée par la KEK dérivée de la phrase       | La phrase n'est jamais stockée ; la clé maîtresse ne l'est pas en clair                               | Adopté                                                 |
| SD-005 | 2026-10-22 | Nonce aléatoire 96 bits, unique par opération de chiffrement                         | Règle absolue du GCM (jamais de réutilisation de nonce)                                               | Adopté                                                 |
| SD-006 | 2026-10-22 | AAD = métadonnées (type, id, version de schéma) authentifiées                        | Détection de substitution d'enregistrements                                                           | Adopté                                                 |
| SD-007 | 2026-10-22 | Format de ciphertext versionné (`v`, `alg`, `iv`, `ct`, `aad`)                       | Migrations contrôlées, compatibilité sauvegardes                                                      | Adopté                                                 |
| SD-008 | 2026-10-22 | Verrouillage automatique après 15 min d'inactivité (configurable)                    | Limite la fenêtre d'exposition d'une session ouverte                                                  | Adopté                                                 |
| SD-009 | 2026-10-22 | CSP restrictive (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`) | Défense en profondeur contre XSS                                                                      | Adopté                                                 |
| SD-010 | 2026-10-22 | IA 100 % opt-in, consentement explicite, envoi minimal, aucune clé API client        | Aucune donnée ne part sans consentement ; pas de secret exposé                                        | Adopté (design)                                        |
| SD-011 | 2026-10-22 | Aucune télémétrie, aucun tracker, logs sans données sensibles                        | Minimisation des données (Privacy by Design)                                                          | Adopté                                                 |
| SD-012 | 2026-10-22 | Sync (Phase 4) : chiffrement client obligatoire, serveur « aveugle »                 | Le serveur ne reçoit jamais clés ni données en clair                                                  | Prévu Phase 4                                          |
| SD-013 | 2026-10-22 | Pas de récupération serveur de la phrase secrète                                     | Propriété fondamentale : perte de phrase = perte des données (documentée)                             | Adopté                                                 |
| SD-014 | 2026-10-22 | CI : permissions minimales, actions épinglées par SHA, Gitleaks + CodeQL + audit     | Supply chain & détection précoce                                                                      | Adopté                                                 |
| SD-015 | 2026-10-22 | Dépôt GitHub privé par défaut                                                        | Le code source n'est pas public sans autorisation explicite                                           | En cours (limite token App : à compléter manuellement) |

## Procédure de changement

Toute modification de ces décisions est un **changement sensible** : tests spécifiques,
mise à jour du modèle de menace, revue humaine indépendante avant production.
