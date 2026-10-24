import { create } from "zustand";

/**
 * Velora — état du coffre-fort (Zustand).
 *
 * RÈGLE DE SÉCURITÉ : ce store ne contient JAMAIS de clé, de phrase secrète
 * ni de données métier en clair. Uniquement des drapeaux d'état.
 *
 * Persistance de `lastActivityAt` dans sessionStorage :
 * - Permet de survivre à un F5 / refresh navigateur sans réinitialiser le timer.
 * - sessionStorage est effacé à la fermeture de l'onglet (acceptable pour un
 *   timer d'inactivité — la vraie session est côté serveur de toute façon).
 * - Clé namespacée pour éviter les collisions.
 */

const STORAGE_KEY = "velora:lastActivityAt";

type VaultStatus = "locked" | "unlocked" | "no-vault" | "loading";

interface VaultState {
  status: VaultStatus;
  autoLockMs: number;
  lastActivityAt: number;
  setStatus: (status: VaultStatus) => void;
  setAutoLockMs: (ms: number) => void;
  touchActivity: () => void;
}

/** Lit lastActivityAt depuis sessionStorage (fallback: maintenant). */
function loadLastActivityAt(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const ts = Number.parseInt(raw, 10);
      if (Number.isFinite(ts) && ts > 0) return ts;
    }
  } catch {
    // sessionStorage indisponible (mode privé, etc.) — fallback silencieux
  }
  return Date.now();
}

/** Persiste lastActivityAt dans sessionStorage. */
function persistLastActivityAt(ts: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, String(ts));
  } catch {
    // Ignore — le timer continuera de fonctionner en mémoire
  }
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "loading",
  autoLockMs: 15 * 60 * 1000,
  lastActivityAt: loadLastActivityAt(),
  setStatus: (status) => set({ status }),
  setAutoLockMs: (autoLockMs) => set({ autoLockMs }),
  touchActivity: () => {
    const now = Date.now();
    persistLastActivityAt(now);
    set({ lastActivityAt: now });
  },
}));
