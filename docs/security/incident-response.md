# Réponse aux incidents — Velora

## 1. Classification

| Niveau       | Exemples                                                                             | Délai de réponse |
| ------------ | ------------------------------------------------------------------------------------ | ---------------- |
| **Critique** | Fuite de clé maîtresse, contournement du chiffrement, exposition de données en clair | Immédiat (24 h)  |
| **Élevé**    | XSS exploitable, contournement CSP, vulnérabilité dépendance critique (RCE)          | 72 h             |
| **Moyen**    | Fuite de métadonnées, DoS, vulnérabilité modérée                                     | 7 jours          |
| **Faible**   | Hardening, mauvaises pratiques sans impact démontré                                  | 30 jours         |

## 2. Réception d'un rapport

1. Accusé de réception sous **72 h** (voir [SECURITY.md](../../SECURITY.md)).
2. Évaluation : gravité (CVSS si applicable), portée, reproductibilité.
3. **Ne jamais divulguer publiquement** avant correctif (divulgation coordonnée).

## 3. Containment (endiguement)

- **Fuite de données côté client** : publier un correctif ; recommander aux utilisateurs
  d'exporter une sauvegarde saine, de changer leur phrase secrète, et de révoquer les
  appareils (Phase 4).
- **Vulnérabilité dépendance** : mise à jour d'urgence (PR `fix/` ou `security/`),
  tests complets, déploiement contrôlé.
- **Compromission du déploiement** : rollback Cloudflare (voir
  [docs/DEPLOYMENT.md](../DEPLOYMENT.md) §Rollback), rotation des credentials.

## 4. Éradication & récupération

- Corriger la cause racine (pas le symptôme).
- Ajouter un test de régression (unitaire/crypto/E2E).
- Mettre à jour le modèle de menace et les ADR si pertinent.
- Vérifier l'intégrité des sauvegardes existantes (AEAD).

## 5. Post-incident

- Rétrospective : chronologie, cause racine, actions correctives.
- Mise à jour du CHANGELOG (section sécurité).
- Communication transparente aux utilisateurs concernés (sans exposer de détails
  exploitables).

## 6. Contacts

- Signalement : [Security Advisory privée](https://github.com/YFA-20/Caryon/security/advisories/new)
- Urgence : canaux privés du dépôt (voir SECURITY.md).

## 7. Spécificité local-first

Velora ne collecte **aucune donnée côté serveur** : un incident côté client n'expose pas
une base de données centrale. La réponse se concentre sur : le correctif, la
recommandation aux utilisateurs (changement de phrase, réinstallation), et la vérification
d'intégrité des données locales (AEAD).
