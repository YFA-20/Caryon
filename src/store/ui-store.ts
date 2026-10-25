import { create } from "zustand";

/**
 * Velora — état UI (Zustand).
 *
 * RÈGLE DE SÉCURITÉ : ce store ne contient JAMAIS de clé, de phrase secrète ni de
 * données métier en clair. Uniquement des drapeaux d'état et des préférences UI.
 */

interface UiState {
  /** Mode démonstration activé (données fictives, clairement identifiées) */
  demoMode: boolean;
  /** Drawer mobile ouvert (hamburger) */
  drawerOpen: boolean;
  /** Nom affiché (profil local, non sensible — prénom uniquement) */
  firstName: string;
  setDemoMode: (demo: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setFirstName: (name: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  demoMode: false,
  drawerOpen: false,
  firstName: "",
  setDemoMode: (demo) => set({ demoMode: demo }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setFirstName: (name) => set({ firstName: name }),
}));
