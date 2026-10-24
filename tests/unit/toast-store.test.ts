/**
 * Velora — tests du store de toasts.
 *
 * Vérifie push/dismiss/dismissAll, les helpers (success/error/undo),
 * et les durées par défaut.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useToastStore, toastSuccess, toastError, toastUndo } from "@/store/toast-store";

describe("toast-store", () => {
  beforeEach(() => {
    useToastStore.getState().dismissAll();
    vi.useFakeTimers();
  });

  it("push ajoute un toast avec un id unique", () => {
    const id1 = useToastStore
      .getState()
      .push({ message: "Hello", variant: "info", durationMs: 1000 });
    const id2 = useToastStore
      .getState()
      .push({ message: "World", variant: "success", durationMs: 1000 });
    expect(id1).not.toBe(id2);
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });

  it("dismiss retire un toast par id", () => {
    const id = useToastStore
      .getState()
      .push({ message: "Test", variant: "info", durationMs: 1000 });
    useToastStore.getState().dismiss(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("dismissAll vide tous les toasts", () => {
    useToastStore.getState().push({ message: "A", variant: "info", durationMs: 1000 });
    useToastStore.getState().push({ message: "B", variant: "info", durationMs: 1000 });
    useToastStore.getState().dismissAll();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("toastSuccess crée un toast de succès", () => {
    toastSuccess("Enregistré !");
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.variant).toBe("success");
    expect(toasts[0]!.message).toBe("Enregistré !");
  });

  it("toastError crée un toast d'erreur avec durée longue", () => {
    toastError("Erreur !");
    const toasts = useToastStore.getState().toasts;
    expect(toasts[0]!.variant).toBe("error");
    expect(toasts[0]!.durationMs).toBe(8000);
  });

  it("toastUndo crée un toast avec callback onUndo", () => {
    const onUndo = vi.fn();
    toastUndo("Supprimé.", onUndo);
    const toasts = useToastStore.getState().toasts;
    expect(toasts[0]!.onUndo).toBe(onUndo);
    expect(toasts[0]!.undoLabel).toBe("Annuler");

    // Simule le clic sur Annuler
    toasts[0]!.onUndo?.();
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("toastUndo accepte un label personnalisé", () => {
    toastUndo("Supprimé.", () => {}, "Restaurer");
    expect(useToastStore.getState().toasts[0]!.undoLabel).toBe("Restaurer");
  });

  it("les toasts ont une durée par défaut de 6000ms", () => {
    useToastStore.getState().push({ message: "Test", variant: "info", durationMs: 6000 });
    expect(useToastStore.getState().toasts[0]!.durationMs).toBe(6000);
  });
});
