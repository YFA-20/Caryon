# ADR 0004 — Assistant IA : opt-in, consentement explicite, cloud ou local

## Statut

Adopte (2026-10-23) — Phase 2 (IA) terminee.

## Contexte

Velora est une application de suivi de candidatures contenant des donnees **tres
sensibles** (CV, lettres de motivation, notes personnelles, contacts recruteurs).
L'ajout d'un assistant IA souleve des questions de confidentialite fondamentales :

- Quelles donnees quittent l'appareil ?
- Qui les recoit ?
- L'utilisateur controle-t-il chaque envoi ?

Les principes directeurs de Velora exigent : **Privacy by Design**, **Secure by
Default**, et **aucune donnee ne part sans consentement explicite**.

## Decision

L'assistant IA est concu selon 5 piliers :

### 1. Opt-in total (desactive par defaut)

- L'IA est **desactivee par defaut** dans `/parametres#ia`.
- Sans activation + consentement, **aucun appel reseau** n'est possible.
- Une banniere (`AiConsentBanner`) invite l'utilisateur a activer l'IA s'il le souhaite.

### 2. Consentement explicite avant CHAQUE envoi

- Une **modal de preview** (`AiConsentModal`) s'affiche avant chaque appel IA.
- Elle liste **exactement** les champs qui seront envoyes.
- L'utilisateur doit cocher une case et cliquer sur « Autoriser cet envoi ».
- Le consentement est enregistre (date, tache, provider) dans les settings chiffres.

### 3. Anonymisation systematique avant envoi cloud

- `anonymizeText()` supprime : emails, telephones, noms propres, adresses.
- Seul le contenu anonymise est envoye au fournisseur cloud.
- **Exception** : la comparaison CV ↔ offre et la generation de lettre necessitent
  le contenu reel (c'est le but de la fonctionnalite) — le consentement est alors
  explicite et la modal le mentionne clairement.

### 4. Abstraction provider : cloud ou local

```
┌─────────────────┐     ┌──────────────────────┐
│   AiActionButton │────→│     runAiTask()       │
│  (UI, consentement)    │  (orchestration)      │
└─────────────────┘     └──────────┬───────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
            ┌─────────────┐               ┌─────────────┐
            │ callCloudAi()│               │ callLocalAi()│
            │ (OpenAI-     │               │ (WebLLM,     │
            │  compatible) │               │  stub)       │
            └─────────────┘               └─────────────┘
```

- **Cloud** : OpenAI, Anthropic, ou endpoint custom (OpenAI-compatible).
- **Local** : WebLLM (`@mlc-ai/web-llm`) — **stub** actuellement, a implementer.
- L'utilisateur choisit son fournisseur et son modele dans `/parametres#ia`.

### 5. Cle API chiffree dans le vault

- La cle API du fournisseur est stockee **chiffree** (AES-256-GCM) dans le vault.
- Elle est dechiffree en memoire uniquement au moment de l'appel.
- **Jamais** en clair dans IndexedDB, `localStorage`, ou les logs.

## 4 taches IA implementees

| Tache               | Source          | Description                                                      |
| ------------------- | --------------- | ---------------------------------------------------------------- |
| `analyze_offer`     | `/offres`       | Extraction competences, contraintes, pre-remplissage candidature |
| `compare_cv_offer`  | `/documents`    | Score de correspondance CV ↔ offre, competences, suggestions     |
| `generate_letter`   | `/candidatures` | Brouillon de lettre de motivation (editable, copiable)           |
| `prepare_interview` | `/entretien`    | Questions par categorie, suggestions, conseils                   |

## Mesures de securite complementaires

| Mesure                 | Implementation                                                           |
| ---------------------- | ------------------------------------------------------------------------ |
| Reponses en texte brut | Jamais de `dangerouslySetInnerHTML` avec une reponse IA                  |
| Gestion d'erreurs      | Toasts generiques, pas de fuite de la cle API dans les messages          |
| Rate-limit             | Gestion cote client (retry manuel, pas de boucle auto)                   |
| Pas de cache           | Les reponses IA ne sont pas mises en cache (fraicheur + confidentialite) |
| CSP                    | `connect-src` restreint ; l'appel cloud passe par le fournisseur choisi  |

## Consequences

### Positives

- **Confidentialite maximale** : l'utilisateur controle chaque envoi, champ par champ.
- **Flexibilite** : cloud (rapide, puissant) ou local (100% prive, offline).
- **Confiance** : le consentement est renouvele a chaque appel, pas une fois pour toutes.
- **Zero-knowledge cote fournisseur** : l'anonymisation reduit les donnees exposees.

### Negatives / compromis

- **UX** : la modal de consentement ajoute un clic avant chaque appel IA.
  C'est **intentionnel** (friction de securite).
- **WebLLM local** : pas encore implemente (stub). Necessite le telechargement d'un
  modele (plusieurs Go) — a evaluer.
- **Cout** : l'utilisateur paie sa propre cle API (pas de proxy serveur).

## Alternatives rejetees

| Alternative                          | Raison du rejet                                                         |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Proxy serveur (cle API cote serveur) | Expose une cle partagee ; le serveur voit les requetes ; complexite ops |
| Consentement global (une fois)       | Moins securise ; l'utilisateur oublie ce qu'il a autorise               |
| IA 100% locale uniquement            | Trop lourd pour mobile ; WebLLM immature                                |
| Envoi sans anonymisation             | Violation du principe de minimisation des donnees                       |

## Voir aussi

- [docs/security/threat-model.md](../security/threat-model.md) — section IA
- [docs/security/data-flow.md](../security/data-flow.md) — flux 7-11
- [src/lib/ai/ai-service.ts](../../src/lib/ai/ai-service.ts)
- [src/lib/ai/offer-analyzer.ts](../../src/lib/ai/offer-analyzer.ts)
- [src/components/ai/ai-consent-modal.tsx](../../src/components/ai/ai-consent-modal.tsx)
