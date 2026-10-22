import { create } from "zustand";

/**
 * Velora — état du coffre-fort (Zustand).
 *
 * RÈGLE DE SÉCURITÉ : ce store ne contient JAMAIS de clé, de phrase secrète
 * ni de données métier en clair. Uniquement des drapeaux d'état.
 */

type VaultStatus = "locked" | "unlocked" | "no-vault" | "loading";

interface VaultState {
  status: VaultStatus;
  autoLockMs: number;
  lastActivityAt: number;
  setStatus: (status: VaultStatus) => void;
  setAutoLockMs: (ms: number) => void;
  touchActivity: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  status: "loading",
  autoLockMs: 15 * 60 * 1000,
  lastActivityAt: Date.now(),
  setStatus: (status) => set({ status }),
  setAutoLockMs: (autoLockMs) => set({ autoLockMs }),
  touchActivity: () => set({ lastActivityAt: Date.now() }),
}));
