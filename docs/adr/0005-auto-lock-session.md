# ADR 0005 — Verrouillage automatique (auto-lock) et gestion de session

## Statut

Adopte (2026-10-23).

## Contexte

La cle maitresse du coffre vit en memoire (CryptoKey non-extractable) pendant la
session. Si l'utilisateur laisse son appareil ouvert sans surveillance, un attaquant
physique pourrait acceder aux donnees dechiffrees.

Le verrouillage automatique apres inactivite est une mesure standard (OWASP ASVS :
session timeout).

## Decision

### 1. Delai configurable (15 min par defaut)

- Stocké dans les settings chiffres (`autoLockMinutes`).
- Configurable dans `/parametres#securite`.
- Valeur par defaut : **15 minutes** (equilibre UX / securite).

### 2. Prolongement sur activite

- `touchActivity()` est appele sur : clic, scroll, clavier, pointermove (throttle).
- Met a jour `lastActivityAt` dans le store Zustand.
- Le timer est reprogramme a chaque activite.

### 3. `forceLock()` — verrouillage propre

```typescript
// src/lib/vault/vault-service.ts
export async function forceLock(): Promise<void> {
  // 1. Efface la session (cle maitresse = null)
  session = null;
  // 2. Sync le store Zustand (isUnlocked = false)
  const { useVaultStore } = await import("@/store/vault-store");
  useVaultStore.getState().lock();
  // 3. Redirection propre
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
```

**Pourquoi pas `lock() + reload()` ?** Parce que `reload()` peut afficher une page
blanche si le `VaultGate` ne reagit pas assez vite. `forceLock()` garantit la
synchronisation du store **avant** la redirection.

### 4. Gestion du retour d'onglet (`visibilitychange`)

```typescript
// src/hooks/use-auto-lock.ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    const { lastActivityAt, isUnlocked } = useVaultStore.getState();
    const elapsed = Date.now() - lastActivityAt;
    if (isUnlocked && elapsed >= autoLockMs) {
      forceLock();
    } else if (isUnlocked) {
      // Reprogramme le timer pour le temps restant
      scheduleLock(autoLockMs - elapsed);
    }
  }
});
```

### 5. Initialisation au deverrouillage

- `touchActivity()` est appele immediatement apres un unlock/create reussi.
- `autoLockMs` est charge depuis les settings chiffres (`getSettings()`).
- Le timer demarre proprement (pas de verrouillage immediat apres F5).

## Bugs corrigés (historique)

| Bug                          | Cause                                                             | Fix                                                       |
| ---------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| Page blanche au verrouillage | `lock() + reload()` — le VaultGate n'avait pas le temps de reagir | `forceLock()` avec sync Zustand avant redirection         |
| Auto-lock immediat apres F5  | `lastActivityAt` initialise a 0 ou non reinitialise au unlock     | `touchActivity()` au unlock + `getState()` pour fraicheur |
| Timer non respecte           | `autoLockMs` pas charge depuis les settings                       | Chargement explicite au unlock                            |

## Bug connu (differe)

Le **bouton de refresh du navigateur** (↻) declenche un verrouillage immediat,
meme mecanisme que F5. Cause : `lastActivityAt` n'est pas persiste entre les
rechargements de page (le store Zustand est reinitialise).

**Fix prevu** : persister `lastActivityAt` dans `sessionStorage` (efface a la
fermeture de l'onglet, ce qui est acceptable pour un timer d'inactivite).

## Limites honnêtes

- L'effacement physique de la memoire JavaScript n'est pas garanti.
- `forceLock()` efface les **references applicatives** ; le navigateur reste le
  dernier rempart.
- Un attaquant avec acces physique + session ouverte peut agir avant le delai.

## Voir aussi

- [docs/security/threat-model.md](../security/threat-model.md) — section Information Disclosure
- [src/hooks/use-auto-lock.ts](../../src/hooks/use-auto-lock.ts)
- [src/lib/vault/vault-service.ts](../../src/lib/vault/vault-service.ts) — `forceLock()`
- [src/components/vault/vault-gate.tsx](../../src/components/vault/vault-gate.tsx)
