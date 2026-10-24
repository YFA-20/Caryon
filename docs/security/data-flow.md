# Flux de donnees — Velora

## Flux 1 : Creation d'une candidature (hors ligne)

```
Saisie (formulaire)
  → Validation Zod (schema Application)
  → Service applications.create()
  → Serialisation (JSON canonique)
  → Chiffrement AES-256-GCM (cle maitresse, nonce aleatoire, AAD = metadonnees)
  → Dexie/IndexedDB : { id, schemaVersion, updatedAt, ciphertext }
  → Historique (ActivityEvent) chiffre de la meme maniere
```

**Reseau : aucun appel.** (Critere d'acceptation n°7.)

## Flux 2 : Deverrouillage du coffre

```
Saisie phrase secrete (champ mot de passe, jamais loguee)
  → Argon2id(phrase, sel) → KEK (memoire)
  → Deballage (unwrap) de la cle maitresse chiffree
  → Verification via le challenge AEAD (succes/echec)
  → Cle maitresse conservee en memoire (session, non-extractable)
  → touchActivity() (reinitialise le timer d'auto-lock)
  → Effacement du buffer de la phrase (references)
```

**Echec** : message generique, delai anti-enumeration (KDF lente), aucune donnee revelee.

## Flux 3 : Auto-lock (verrouillage automatique)

```
Timer (15 min par defaut, configurable dans /parametres)
  → Prolongement sur activite utilisateur (touchActivity: clic, scroll, clavier, pointer)
  → visibilitychange : si l'onglet revient apres le delai → forceLock()
  → forceLock() :
      1. session = null (cle maitresse effacee de la memoire)
      2. Sync du store Zustand (isUnlocked = false)
      3. Redirection propre (location.replace("/") ou reload())
  → L'utilisateur voit l'ecran de deverrouillage (pas de page blanche)
```

**Bug connu** : le bouton de refresh du navigateur (↻) declenche un verrouillage
immediat car `lastActivityAt` n'est pas persiste entre les rechargements.
Fix prevu : persister dans `sessionStorage`.

## Flux 4 : Export de sauvegarde `.velora`

```
Donnees + documents + evenements + settings (dechiffres en memoire)
  → Serialisation JSON du payload complet
  → Chiffrement du payload entier (AES-256-GCM, cle maitresse)
  → Manifeste : { format: "velora-backup", version: 1, recordCount, exportedAt,
                   checksum: SHA-256(payload chiffre) }
  → Fichier .velora telecharge (Blob, jamais de reseau)
```

## Flux 5 : Restauration de sauvegarde `.velora`

```
Fichier importe (File API, validation MIME/taille)
  → parseBackup() : validation Zod du manifeste
  → Verification du checksum SHA-256
  → Dechiffrement AEAD du payload (echec = rejet total)
  → Validation Zod de chaque enregistrement
  → Mode "replace" (tout remplacer) ou "merge" (fusionner)
  → Ecriture dans IndexedDB (re-chiffrement individuel)
```

## Flux 6 : Mode demonstration

```
Activation (depuis l'onboarding ou /parametres)
  → seedDemoData() : cree des donnees fictives avec tag "__demo__"
  → Bandeau « Mode demonstration — donnees fictives » affiche
  → Entreprises fictives, emails .invalid
  → hasExistingData() ignore les donnees demo
Desactivation
  → clearDemoData() : supprime TOUTES les donnees avec tag "__demo__"
  → Detection legacy : tag "demo" + entreprises fictives (DEMO_COMPANIES)
  → Nettoyage des 3 marqueurs : __demo__, demo, entreprises fictives
```

## Flux 7 : Assistant IA — Analyse d'offre (cloud)

```
Utilisateur colle une offre (depuis /offres)
  → AiConsentModal : preview EXACTE des champs envoyes
  → Consentement explicite (checkbox + bouton)
  → requireAiConsent() verifie le consentement enregistre
  → anonymizeText(offre) : supprime emails, telephones, noms propres
  → buildSystemPrompt("analyze_offer")
  → callCloudAi() : POST vers le fournisseur (OpenAI-compatible)
     - Cle API : lue depuis le vault (chiffree), dechiffree en memoire
     - Jamais loguee, jamais stockee en clair
  → parseAiJson<OfferAnalysis>() : validation Zod de la reponse
  → Affichage du resultat + pre-remplissage du formulaire
```

**Sans consentement : aucun appel.** (Critere n°8.)

## Flux 8 : Assistant IA — Comparaison CV ↔ Offre

```
Depuis /documents, clic sur « Comparer IA » (document type CV)
  → Extraction du texte du CV (getDocumentContent → TextDecoder)
  → Zone de texte pour coller l'offre
  → Consentement (modal preview : CV + offre, anonymises)
  → anonymizeText(cvText) + anonymizeText(offre)
  → callCloudAi(task: "compare_cv_offer")
  → Resultat : score (barre coloree), competences (badges), points forts, suggestions
```

## Flux 9 : Assistant IA — Generation de lettre de motivation

```
Depuis /candidatures (formulaire edition), clic sur « Generer une lettre (IA) »
  → Selection du CV parmi les documents chiffres (type="cv")
  → Extraction texte CV + contexte (entreprise, poste, offre)
  → Consentement (modal preview)
  → anonymizeText() sur CV + offre
  → callCloudAi(task: "generate_letter")
  → Brouillon editable + bouton Copier
  → Avertissement : « informations reelles uniquement, ne pas inventer de faits »
```

## Flux 10 : Assistant IA — Preparation d'entretien

```
Depuis /entretien, clic sur « Prepa IA » (fiche de preparation)
  → Selection du CV + contexte (entreprise, poste, notes/offre)
  → Consentement (modal preview)
  → anonymizeText() sur toutes les entrees
  → callCloudAi(task: "prepare_interview")
  → Resultat : questions par categorie (technique/comportementale/entreprise/motivation)
    avec suggestions de reponses depliables, questions a poser, conseils generaux
```

## Flux 11 : Assistant IA — Mode local (WebLLM, stub)

```
callLocalAi() — actuellement un stub
  → Sera implemente avec @mlc-ai/web-llm (modele telecharge localement)
  → Aucune donnee ne quitte l'appareil
  → Meme interface que callCloudAi() (abstraction provider)
```

## Flux 12 (Phase 3) : Synchronisation chiffree

```
Donnees locales → chiffrement client (cle maitresse) → upload R2 (blobs chiffres)
Metadonnees minimales (ids opaques, versions) → D1 via Worker
Serveur : ne recoit JAMAIS la cle maitresse ni les donnees en clair.
```

## Flux 13 : Telemetrie

**Aucun.** Pas d'analytics, pas de tracker, pas de logs de donnees sensibles.
