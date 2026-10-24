import { create } from "zustand";

/**
 * Velora — store des toasts (Zustand).
 *
 * Gère les notifications temporaires (succès, erreur, info) et l'action
 * « Annuler » (undo) après suppression. Aucune donnée métier en clair :
 * uniquement des messages et des callbacks d'annulation.
 */

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Callback d'annulation (présent uniquement si undo possible). */
  onUndo?: () => void;
  undoLabel?: string;
  /** Durée d'affichage en ms (0 = persistant jusqu'au clic). */
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (
    toast: Omit<Toast, "id" | "durationMs" | "variant"> &
      Partial<Pick<Toast, "durationMs" | "variant">>
  ) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const DEFAULT_DURATION = 6000;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    const id = crypto.randomUUID();
    const full: Toast = {
      ...toast,
      durationMs: toast.durationMs ?? DEFAULT_DURATION,
      variant: toast.variant ?? "info",
      id,
    };
    set((state) => ({ toasts: [...state.toasts, full] }));
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  dismissAll: () => set({ toasts: [] }),
}));

/** Helper : toast de succès simple. */
export function toastSuccess(message: string) {
  useToastStore.getState().push({ message, variant: "success" });
}

/** Helper : toast d'erreur simple. */
export function toastError(message: string) {
  useToastStore.getState().push({ message, variant: "error", durationMs: 8000 });
}

/** Helper : toast avec action « Annuler ». */
export function toastUndo(message: string, onUndo: () => void, undoLabel = "Annuler") {
  useToastStore.getState().push({
    message,
    variant: "info",
    onUndo,
    undoLabel,
    durationMs: 8000,
  });
}
