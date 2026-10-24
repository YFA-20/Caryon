"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, Undo2, X } from "lucide-react";
import { useToastStore, type Toast } from "@/store/toast-store";
import { cn } from "@/lib/utils/cn";

const VARIANT_META: Record<Toast["variant"], { icon: typeof Info; classes: string }> = {
  success: {
    icon: CheckCircle2,
    classes: "border-success/30 bg-success/10 text-success",
  },
  error: {
    icon: AlertTriangle,
    classes: "border-danger/30 bg-danger/10 text-danger",
  },
  info: {
    icon: Info,
    classes: "border-lavender/30 bg-lavender/10 text-primary",
  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const meta = VARIANT_META[toast.variant];
  const Icon = meta.icon;

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border p-3 shadow-glow backdrop-blur-md",
        meta.classes
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">{toast.message}</p>
      {toast.onUndo && (
        <button
          type="button"
          onClick={() => {
            toast.onUndo?.();
            dismiss(toast.id);
          }}
          className="transition-velora flex shrink-0 items-center gap-1 rounded-lg bg-card-elevated px-2 py-1 text-xs font-medium text-lavender hover:brightness-110"
        >
          <Undo2 className="h-3 w-3" aria-hidden />
          {toast.undoLabel ?? "Annuler"}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Fermer la notification"
        className="transition-velora shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Velora — conteneur de toasts (position fixe, bas droite sur desktop,
 * bas centre sur mobile au-dessus de la barre de navigation).
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-24 right-4 z-50 flex flex-col gap-2 md:bottom-6"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
