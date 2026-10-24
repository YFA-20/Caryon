# Modele de menace — Velora (STRIDE)

> La confidentialite est garantie par l'architecture. Ce document est la source de verite
> pour les menaces ; il doit etre mis a jour a chaque changement sensible.

## 1. Actifs a proteger

| #   | Actif                                                            | Sensibilite | Ou                                                   |
| --- | ---------------------------------------------------------------- | ----------- | ---------------------------------------------------- |
| A1  | Candidatures (entreprise, poste, notes personnelles, historique) | Elevee      | IndexedDB (chiffre)                                  |
| A2  | Documents (CV, lettres, diplomes)                                | Tres elevee | IndexedDB (chiffre, blobs)                           |
| A3  | Contacts recruteurs (email, telephone)                           | Elevee      | IndexedDB (chiffre)                                  |
| A4  | Journal de recherche (notes intimes)                             | Tres elevee | IndexedDB (chiffre)                                  |
| A5  | Phrase secrete de l'utilisateur                                  | Critique    | **Nulle part** (saisie uniquement, memoire volatile) |
| A6  | Cle maitresse du coffre                                          | Critique    | Memoire (session uniquement, non-extractable)        |
| A7  | Metadonnees techniques (ids, versions, horodatages)              | Moderee     | IndexedDB (clair, minimal)                           |
| A8  | Archive de sauvegarde `.velora`                                  | Tres elevee | Fichier exporte (chiffre, SHA-256)                   |
| A9  | Consentements IA                                                 | Elevee      | IndexedDB (chiffre, dans les settings)               |
| A10 | Cle API fournisseur IA                                           | Critique    | IndexedDB (chiffree dans le vault, jamais en clair)  |
| A11 | Modele IA choisi + provider                                      | Moderee     | IndexedDB (chiffre, dans les settings)               |
| A12 | Evenements calendrier, relances, objectifs                       | Elevee      | IndexedDB (chiffre)                                  |
| A13 | Fiches de preparation d'entretien                                | Elevee      | IndexedDB (chiffre)                                  |

## 2. Acteurs

| Acteur                                  | Confiance      | Capacites                                           |
| --------------------------------------- | -------------- | --------------------------------------------------- |
| Utilisateur legitime                    | Haute          | Acces a son appareil, sa phrase secrete             |
| Attaquant local (appareil partage/vole) | Mefiance       | Acces physique, navigateur ouvert                   |
| Attaquant reseau (MITM)                 | Mefiance       | Interception, modification du trafic                |
| Serveur/CDN (Cloudflare)                | Semi-confiance | Sert l'app, voit les requetes (metadonnees)         |
| Fournisseur IA (opt-in, cloud)          | Mefiance       | Recoit uniquement les champs consentis + anonymises |
| Auteur d'une dependance (supply chain)  | Mefiance       | Code execute dans l'app                             |
| Extension de navigateur malveillante    | Mefiance       | Acces au DOM, au stockage, au reseau                |

## 3. Frontieres de confiance

1. **Saisie utilisateur → App** : validation Zod systematique.
2. **App → IndexedDB** : chiffrement AES-256-GCM avant persistance.
3. **App → Reseau (IA cloud)** : consentement explicite (modal preview) + anonymisation
   (`anonymizeText()`) + envoi minimal. Sans consentement : **aucun appel**.
4. **App → Reseau (sync, Phase 3)** : chiffrement client obligatoire ; le serveur ne recoit
   jamais les cles ni les donnees en clair.
5. **Archive exportee `.velora`** : chiffree (AES-256-GCM), integrite verifiee (SHA-256),
   versionnee. Rejet total si invalide.
6. **Auto-lock** : `forceLock()` efface la session + sync Zustand + redirection propre.
   Le delai est configurable (15 min par defaut).

## 4. Analyse STRIDE

### S — Spoofing (usurpation)

| Menace                                  | Mitigation                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- |
| Usurpation du service de sync (Phase 3) | Authentification dediee (separee du coffre), TLS, verification de l'origine |
| Faux appareil associe                   | Procedure d'association explicite (QR/code), revocation possible            |
| Usurpation du fournisseur IA            | Cle API personnelle (chiffree dans le vault), TLS, endpoint configurable    |
| Fausse page de consentement IA          | CSP `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`                  |

### T — Tampering (modification)

| Menace                                                   | Mitigation                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Modification d'un enregistrement chiffre                 | **AES-256-GCM** : toute modification invalide le tag → rejet                                                                 |
| Modification d'une sauvegarde `.velora`                  | AEAD + SHA-256 (manifeste) + format versionne                                                                                |
| Modification du code servi                               | Supply chain : lockfile, CI, revue ; HTTPS (meme origine)                                                                    |
| Modification d'IndexedDB par un autre onglet malveillant | CSP `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy`, chiffrement (un autre onglet ne peut pas lire la cle en memoire) |
| Modification de la cle API IA stockee                    | Chiffree dans le vault (AES-256-GCM), AAD = {collection, id}                                                                 |
| Rejeu d'une reponse IA (cache)                           | Pas de cache persistant des reponses IA ; chaque appel est frais                                                             |

### R — Repudiation (repudiation)

| Menace                             | Mitigation                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Nier une action (ex : suppression) | Historique chronologique local (ActivityEvent), tombstones en sync (Phase 3) |
| Nier un consentement IA            | Consentement enregistre (date, tache, provider) dans les settings chiffres   |

### I — Information Disclosure (divulgation)

| Menace                                               | Mitigation                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Lecture d'IndexedDB (appareil vole, session ouverte) | Chiffrement au repos ; **verrouillage automatique** apres inactivite (15 min configurable)             |
| Lecture d'IndexedDB (coffre verrouille)              | Cle absente de la memoire et du stockage → ciphertext illisible                                        |
| Fuite via les logs                                   | **Aucun log de donnees sensibles** ; journalisation minimale, structuree, filtree                      |
| Fuite via telemetrie                                 | **Aucune telemetrie**, aucun tracker tiers                                                             |
| Fuite via fournisseur IA (cloud)                     | Consentement explicite (modal preview), envoi minimal, `anonymizeText()` avant envoi, aucun envoi auto |
| Fuite de la cle API IA                               | Chiffree dans le vault (AES-256-GCM), jamais en clair, jamais dans les logs                            |
| Fuite via en-tetes/referent                          | `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`                            |
| Fuite via cache navigateur                           | Donnees sensibles jamais en `localStorage` ni en cache HTTP (IndexedDB uniquement)                     |
| Fuite via mode demo                                  | Donnees fictives clairement identifiees (tag `__demo__`), emails `.invalid`, nettoyage auto            |
| Metadonnees cote serveur (Phase 3)                   | Minimisation : ids opaques, versions, horodatages — jamais de contenu                                  |

### D — Denial of Service (deni de service)

| Menace                                | Mitigation                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Indisponibilite du CDN                | L'app est **local-first** : une fois installee (PWA), elle fonctionne hors ligne |
| Corruption locale des donnees         | Sauvegardes chiffrees exportables ; migrations testees                           |
| Blocage du deverrouillage (KDF lente) | Parametres Argon2id calibres (UX vs securite documentes)                         |
| Rate-limit du fournisseur IA          | Gestion d'erreur avec toast, retry manuel, pas de boucle automatique             |
| Epuisement quota API IA               | Cle personnelle, l'utilisateur controle son usage                                |

### E — Elevation of Privilege (elevation de privileges)

| Menace                             | Mitigation                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| XSS dans l'app                     | CSP restrictive (`script-src 'self' 'sha256-...'`), pas de `dangerouslySetInnerHTML` non fiable, echappement React |
| Extension malveillante             | Hors perimetre (documente comme limite) — defense : permissions minimales de l'app                                 |
| Injection via import de sauvegarde | Validation Zod + AEAD + SHA-256 : une archive invalide est rejetee avant tout traitement                           |
| Injection via reponse IA           | La reponse IA est affichee comme texte brut (pas de `dangerouslySetInnerHTML`), jamais executee                    |
| CSRF                               | Application statique sans session serveur ; `form-action 'self'`                                                   |

## 5. Risques residuels acceptes (limites honnêtes)

1. **Appareil compromis** : un keylogger ou un acces physique avec session ouverte peut
   compromettre les donnees. Le verrouillage automatique reduit la fenetre d'exposition.
2. **Memoire JavaScript** : nous ne pouvons pas garantir l'effacement physique des cles en
   RAM ; le verrouillage efface les **references applicatives**.
3. **Perte de la phrase secrete** : par conception, les donnees deviennent irrecuperables.
   Aucune recuperation cote serveur (c'est une propriete, pas un bug).
4. **Extensions malveillantes** : hors de notre controle.
5. **Side-channels navigateur** : hors de notre controle.
6. **Fournisseur IA malveillant ou compromis** : l'anonymisation reduit l'impact, mais le
   fournisseur voit le contenu anonymise envoye. L'utilisateur choisit son fournisseur.
7. **Bug connu — auto-lock au refresh navigateur** : le bouton ↻ du navigateur declenche un
   verrouillage immediat (meme mecanisme que F5). Fix prevu : persister `lastActivityAt`
   dans `sessionStorage` ou IndexedDB.

## 6. Exigences de verification (liees aux criteres d'acceptation)

Chaque menace « Information Disclosure » et « Tampering » doit etre couverte par un test :
ciphertext illisible, mauvaise phrase rejetee, modification detectee, restauration valide,
aucun appel reseau pour les operations de base, aucun log sensible, consentement IA requis.
