# Guide utilisateur — Velora

Velora est votre espace privé pour gérer vos candidatures (stage, alternance, emploi).
Toutes vos données sont **chiffrées sur votre appareil** — personne d'autre n'y a accès, pas même le serveur.

---

## 1. Premiers pas

### Créer votre coffre

Au premier lancement, Velora vous demande de choisir une **phrase secrète** (minimum 12 caractères).

- Cette phrase est la **seule clé** de votre coffre.
- Elle n'est **jamais stockée**, jamais transmise, jamais sauvegardée.
- **Sans elle, vos données sont irrécupérables.** Il n'existe aucune récupération côté serveur.
- Choisissez une phrase que vous retiendrez facilement mais que personne ne devinera (ex: une phrase longue avec des mots du quotidien).

### Déverrouiller votre coffre

À chaque ouverture de l'application (ou après un verrouillage automatique), saisissez votre phrase secrète.

### Verrouillage automatique

Par défaut, le coffre se verrouille après **15 minutes d'inactivité**. Vous pouvez modifier ce délai dans **Paramètres** (5 min, 15 min, 30 min, 1 heure, ou désactivé).

> Le verrouillage efface les données de la mémoire. Vos données restent chiffrées sur l'appareil.

---

## 2. Vos candidatures

### Ajouter une candidature

1. Allez sur **Mes candidatures**.
2. Cliquez sur **Nouvelle candidature**.
3. Remplissez les informations : entreprise, poste, type (CDI, CDD, stage, alternance), lieu, salaire, source, contact, notes, tags.
4. Enregistrez.

### Vue Kanban

Vos candidatures sont organisées en colonnes selon leur statut :

| Colonne    | Signification                                      |
| ---------- | -------------------------------------------------- |
| À postuler | Offres identifiées, candidature pas encore envoyée |
| Envoyée    | Candidature transmise, en attente de réponse       |
| Entretien  | Entretien planifié ou en cours                     |
| Offre      | Offre reçue                                        |
| Refusée    | Candidature refusée                                |
| Archivées  | Candidatures terminées (refus, abandon)            |

Vous pouvez **glisser-déposer** une carte d'une colonne à l'autre pour changer le statut.

### Recherche et filtres

- **Recherche instantanée** : tapez dans la barre de recherche pour filtrer par entreprise, poste, lieu.
- **Filtres** : par statut, type, priorité, tags.
- **Tri** : par date de création, date d'envoi, entreprise, priorité.

> Votre vue (filtres, recherche, tri) est **mémorisée** entre les sessions.

### Recherche globale (Ctrl+K)

Appuyez sur **Ctrl+K** (ou **Cmd+K** sur Mac) pour ouvrir la palette de recherche globale.
Elle cherche dans toutes vos données : candidatures, documents, événements, objectifs, journal, fiches d'entretien.

---

## 3. Calendrier

- **Événements** : entretiens, relances, échéances, rendez-vous.
- **Export ICS** : chaque événement peut être exporté au format calendrier (compatible Google Calendar, Outlook, Apple Calendar).
- **Notifications** : recevez un rappel local avant chaque événement (si les notifications sont activées dans votre navigateur).

---

## 4. Documents

- **Formats acceptés** : PDF, DOC, DOCX, TXT, PNG, JPG.
- **Chiffrement** : chaque document est chiffré (AES-256-GCM) avant d'être stocké dans votre navigateur.
- **Taille maximale** : 20 Mo par document.
- **Organisation** : associez chaque document à une candidature.

---

## 5. Sauvegardes

### Exporter une sauvegarde

1. Allez sur **Sauvegardes**.
2. Cliquez sur **Exporter une sauvegarde**.
3. Un fichier `.velora` est téléchargé (chiffré, avec manifeste SHA-256).

> **Faites une sauvegarde régulièrement.** C'est votre seul filet de sécurité en cas de perte de l'appareil ou de corruption du navigateur.

### Restaurer une sauvegarde

1. Sur un nouvel appareil (ou après réinitialisation du navigateur), allez sur **Sauvegardes**.
2. Cliquez sur **Importer une sauvegarde**.
3. Sélectionnez votre fichier `.velora`.
4. Saisissez votre phrase secrète pour déverrouiller.

---

## 6. Synchronisation multi-appareils (Phase 3)

Velora peut synchroniser votre coffre entre plusieurs appareils (ordinateur, téléphone, tablette).

> **La synchronisation est désactivée par défaut.** Vous devez l'activer explicitement.

### Activer la synchronisation

1. Allez sur **Paramètres**.
2. Dans la carte **Synchronisation multi-appareils**, cochez **Activer la synchronisation**.
3. Enregistrez.

### Appairer un nouvel appareil

1. Sur l'appareil **déjà connecté**, allez sur **Appairage** (dans le menu « Mon coffre-fort »).
2. Cliquez sur **Cet appareil** → **Générer un code**.
3. Un code à **6 chiffres** s'affiche (valable 10 minutes). Copiez-le.
4. Sur le **nouvel appareil**, allez sur **Appairage** → **Nouvel appareil**.
5. Saisissez le code + le nom de l'appareil (ex: « iPhone de Yassine »).
6. Cliquez sur **Demander l'appairage**.
7. Sur l'appareil déjà connecté, la demande apparaît dans **Demandes en attente** → cliquez sur **Approuver**.
8. La synchronisation démarre automatiquement.

### Restaurer depuis le cloud (sans fichier .velora)

Si vous n'avez pas de fichier de sauvegarde mais que la sync est activée sur un autre appareil :

1. Sur le nouvel appareil, à l'écran de création du coffre, cliquez sur **Restaurer depuis un autre appareil (cloud)**.
2. Saisissez l'**identifiant du coffre** (visible sur la page Appairage de l'autre appareil, bouton « ID coffre »).
3. Saisissez votre **phrase secrète**.
4. Le coffre est recréé localement. Appairez ensuite cet appareil pour récupérer vos données.

### Révoquer un appareil

Sur la page **Appairage**, cliquez sur **Révoquer** à côté de l'appareil concerné.
Un appareil révoqué ne peut plus se synchroniser. Ses données locales restent intactes.

### Sécurité de la synchronisation

- Vos données sont **chiffrées avant d'être envoyées** (AES-256-GCM, clé maîtresse côté client).
- Le serveur de synchronisation ne reçoit que du **ciphertext illisible**.
- **Aucune clé, aucune phrase secrète** n'est jamais transmise.
- Sans votre phrase secrète, le serveur est incapable de déchiffrer quoi que ce soit.

---

## 7. Assistant IA (opt-in)

Velora intègre un assistant IA pour vous aider dans votre recherche. **Il est désactivé par défaut.**

### Activer l'IA

1. Allez sur **Paramètres** → section **Assistant IA**.
2. Cochez **J'ai compris et j'accepte**.
3. Choisissez un fournisseur :
   - **Local** (WebLLM, dans votre navigateur, nécessite WebGPU) — vos données ne quittent jamais votre appareil.
   - **Cloud** (API externe) — nécessite une clé API. Vos données sont **anonymisées** avant envoi.

### Ce que fait l'IA

| Fonction                | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| Analyse d'offre         | Extrait les compétences, contraintes, mots-clés d'une offre d'emploi |
| Comparaison CV ↔ Offre  | Score de correspondance, compétences présentes/manquantes            |
| Lettre de motivation    | Génère un brouillon à partir de votre profil et de l'offre           |
| Préparation d'entretien | Questions par catégorie, suggestions de réponses, conseils           |

> L'IA reçoit **uniquement le texte que vous choisissez d'analyser** (offre, CV, profil). Vos candidatures, documents et clés de chiffrement ne sont **jamais** envoyés.

---

## 8. Raccourcis clavier

| Raccourci          | Action                                          |
| ------------------ | ----------------------------------------------- |
| `Ctrl+K` / `Cmd+K` | Recherche globale                               |
| `N`                | Nouvelle candidature (sur la page candidatures) |
| `Echap`            | Fermer la palette / les modales                 |
| `?`                | Afficher les raccourcis                         |

---

## 9. Mode démonstration

Envie de découvrir Velora sans créer de compte ? Activez le **mode démonstration** depuis le header ou les paramètres.

- Des données fictives (candidatures, documents, événements) sont générées, **chiffrées comme vos vraies données**.
- Une bannière jaune indique que vous êtes en mode démo.
- Pour quitter : cliquez sur **Quitter la démo** (les données fictives sont supprimées).

---

## 10. Questions fréquentes (FAQ)

### J'ai oublié ma phrase secrète. Que faire ?

**Vos données sont irrécupérables.** Velora ne stocke jamais votre phrase. Si vous avez une sauvegarde `.velora`, vous pouvez la restaurer sur un nouvel appareil (la phrase reste nécessaire). Sans sauvegarde ni phrase, il n'y a aucun recours — c'est le prix de la confidentialité absolue.

### Puis-je utiliser Velora sur plusieurs appareils sans la sync ?

Oui : exportez une sauvegarde `.velora` sur l'appareil A, importez-la sur l'appareil B. Les deux appareils auront les mêmes données, mais ne se synchroniseront pas automatiquement. Pour la sync auto, activez la **Synchronisation multi-appareils**.

### Velora fonctionne-t-il hors ligne ?

**Oui, complètement.** C'est une PWA local-first : toutes les fonctionnalités de base (candidatures, calendrier, documents, journal) fonctionnent sans connexion. Seules la sync multi-appareils et l'IA cloud nécessitent Internet.

### Mes données sont-elles vraiment chiffrées ?

Oui. AES-256-GCM (authentifié), clé maîtresse en mémoire uniquement, dérivée de votre phrase via Argon2id. Le ciphertext est stocké dans IndexedDB. Sans votre phrase, il est illisible — même pour le serveur de sync.

### Puis-je supprimer toutes mes données ?

Oui : **Paramètres** → **Zone de danger** → **Supprimer toutes mes données**. C'est irréversible. Pensez à exporter une sauvegarde avant.

### Comment signaler un bug ?

Ouvrez une issue sur [GitHub](https://github.com/YFA-20/Caryon/issues).

---

## Licence

Velora est distribué sous licence **MIT**. Voir [LICENSE](../LICENSE).
