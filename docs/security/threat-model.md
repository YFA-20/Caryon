# Modèle de menace — Velora (STRIDE)

> La confidentialité est garantie par l'architecture. Ce document est la source de vérité
> pour les menaces ; il doit être mis à jour à chaque changement sensible.

## 1. Actifs à protéger

| #   | Actif                                                            | Sensibilité | Où                                                   |
| --- | ---------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| A1  | Candidatures (entreprise, poste, notes personnelles, historique) | Élevée      | IndexedDB (chiffré)                                  |
| A2  | Documents (CV, lettres, diplômes)                                | Très élevée | IndexedDB (chiffré, blobs)                           |
| A3  | Contacts recruteurs (email, téléphone)                           | Élevée      | IndexedDB (chiffré)                                  |
| A4  | Journal de recherche (notes intimes)                             | Très élevée | IndexedDB (chiffré)                                  |
| A5  | Phrase secrète de l'utilisateur                                  | Critique    | **Nulle part** (saisie uniquement, mémoire volatile) |
| A6  | Clé maîtresse du coffre                                          | Critique    | Mémoire (session uniquement)                         |
| A7  | Métadonnées techniques (ids, versions, horodatages)              | Modérée     | IndexedDB (clair, minimal)                           |
| A8  | Archive de sauvegarde                                            | Très élevée | Fichier exporté (chiffré)                            |
| A9  | Consentements IA                                                 | Élevée      | IndexedDB (chiffré)                                  |

## 2. Acteurs

| Acteur                                  | Confiance      | Capacités                                     |
| --------------------------------------- | -------------- | --------------------------------------------- |
| Utilisateur légitime                    | Haute          | Accès à son appareil, sa phrase secrète       |
| Attaquant local (appareil partagé/volé) | Méfiance       | Accès physique, navigateur ouvert             |
| Attaquant réseau (MITM)                 | Méfiance       | Interception, modification du trafic          |
| Serveur/CDN (Cloudflare)                | Semi-confiance | Servit l'app, voit les requêtes (métadonnées) |
| Fournisseur IA (Phase 3, opt-in)        | Méfiance       | Reçoit uniquement les champs consentis        |
| Auteur d'une dépendance (supply chain)  | Méfiance       | Code exécuté dans l'app                       |
| Extension de navigateur malveillante    | Méfiance       | Accès au DOM, au stockage, au réseau          |

## 3. Frontières de confiance

1. **Saisie utilisateur → App** : validation Zod systématique.
2. **App → IndexedDB** : chiffrement AES-256-GCM avant persistance.
3. **App → Réseau** : aucun appel par défaut ; IA : consentement explicite, champ par champ.
4. **App → Serveur (sync, Phase 4)** : chiffrement client obligatoire ; le serveur ne reçoit
   jamais les clés ni les données en clair.
5. **Archive exportée** : chiffrée, intégrité vérifiée (AEAD), versionnée.

## 4. Analyse STRIDE

### S — Spoofing (usurpation)

| Menace                                  | Mitigation                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- |
| Usurpation du service de sync (Phase 4) | Authentification dédiée (séparée du coffre), TLS, vérification de l'origine |
| Faux appareil associé                   | Procédure d'association explicite (QR/code), révocation possible            |

### T — Tampering (modification)

| Menace                                                   | Mitigation                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Modification d'un enregistrement chiffré                 | **AES-256-GCM** : toute modification invalide le tag → rejet (critère d'acceptation n°4)                                     |
| Modification d'une sauvegarde                            | AEAD + contrôle d'intégrité + format versionné                                                                               |
| Modification du code servi                               | Supply chain : lockfile, Dependabot, CI, revue ; HTTPS + SRI non requis (même origine)                                       |
| Modification d'IndexedDB par un autre onglet malveillant | CSP `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`, chiffrement (un autre onglet ne peut pas lire la clé en mémoire) |

### R — Repudiation (répudiation)

| Menace                             | Mitigation                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Nier une action (ex : suppression) | Historique chronologique local (ActivityEvent), tombstones en sync (Phase 4) |

### I — Information Disclosure (divulgation)

| Menace                                               | Mitigation                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lecture d'IndexedDB (appareil volé, session ouverte) | Chiffrement au repos ; **verrouillage automatique** après inactivité                                  |
| Lecture d'IndexedDB (coffre verrouillé)              | Clé absente de la mémoire et du stockage → ciphertext illisible                                       |
| Fuite via les logs                                   | **Aucun log de données sensibles** ; journalisation minimale, structurée, filtrée                     |
| Fuite via télémétrie                                 | **Aucune télémétrie**, aucun tracker tiers                                                            |
| Fuite via fournisseur IA                             | Consentement explicite, envoi minimal, suppression des identifiants possible, aucun envoi automatique |
| Fuite via en-têtes/référent                          | `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`                           |
| Fuite via cache navigateur                           | Données sensibles jamais en `localStorage` ni en cache HTTP (IndexedDB uniquement)                    |
| Métadonnées côté serveur (Phase 4)                   | Minimisation : ids opaques, versions, horodatages — jamais de contenu                                 |

### D — Denial of Service (déni de service)

| Menace                                | Mitigation                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Indisponibilité du CDN                | L'app est **local-first** : une fois installée (PWA), elle fonctionne hors ligne |
| Corruption locale des données         | Sauvegardes chiffrées exportables ; migrations testées                           |
| Blocage du déverrouillage (KDF lente) | Paramètres Argon2id calibrés (UX vs sécurité documentés)                         |

### E — Elevation of Privilege (élévation de privilèges)

| Menace                             | Mitigation                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| XSS dans l'app                     | CSP restrictive (`script-src 'self'`), pas de `dangerouslySetInnerHTML` non fiable, échappement React par défaut |
| Extension malveillante             | Hors périmètre (documenté comme limite) — défense : permissions minimales de l'app                               |
| Injection via import de sauvegarde | Validation Zod + AEAD : une archive invalide est rejetée avant tout traitement                                   |
| CSRF                               | Application statique sans session serveur ; `form-action 'self'`                                                 |

## 5. Risques résiduels acceptés (limites honnêtes)

1. **Appareil compromis** : un keylogger ou un accès physique avec session ouverte peut
   compromettre les données. Le verrouillage automatique réduit la fenêtre d'exposition.
2. **Mémoire JavaScript** : nous ne pouvons pas garantir l'effacement physique des clés en
   RAM ; le verrouillage efface les **références applicatives**.
3. **Perte de la phrase secrète** : par conception, les données deviennent irrécupérables.
   Aucune récupération côté serveur (c'est une propriété, pas un bug).
4. **Extensions malveillantes** : hors de notre contrôle.
5. **Side-channels navigateur** : hors de notre contrôle.

## 6. Exigences de vérification (liées aux critères d'acceptation)

Chaque menace « Information Disclosure » et « Tampering » doit être couverte par un test :
ciphertext illisible, mauvaise phrase rejetée, modification détectée, restauration valide,
aucun appel réseau pour les opérations de base, aucun log sensible.
