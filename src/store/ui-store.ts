import { create } from "zustand";

/**
 * Velora — état UI (Zustand).
 *
 * RÈGLE DE SÉCURITÉ : ce store ne contient JAMAIS de clé, de phrase secrète ni de
 * données métier en clair. Uniquement des drapeaux d'état et des préférences UI.
 */

interface UiState {
  /** Le coffre est-il déverrouillé ? (drapeau uniquement — jamais la clé) */
  vaultUnlocked: boolean;
  /** Mode démonstration activé (données fictives, clairement identifiées) */
  demoMode: boolean;
  /** Nom affiché (profil local, non sensible — prénom uniquement) */
  firstName: string;
  setVaultUnlocked: (unlocked: boolean) => void;
  setDemoMode: (demo: boolean) => void;
  setFirstName: (name: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  vaultUnlocked: false,
  demoMode: false,
  firstName: "",
  setVaultUnlocked: (unlocked) => set({ vaultUnlocked: unlocked }),
  setDemoMode: (demo) => set({ demoMode: demo }),
  setFirstName: (name) => set({ firstName: name }),
}));
