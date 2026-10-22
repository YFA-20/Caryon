"use client";

import { Info, X } from "lucide-react";
import { useState } from "react";
import { useUiStore } from "@/store/ui-store";
import { Button } from "@/components/ui/button";

/**
 * Bandeau de mode démonstration : les données affichées sont FICTIES.
 * Exigence du cahier des charges : ne jamais présenter de fausses données comme réelles.
 */
export function DemoBanner() {
  const { demoMode, setDemoMode } = useUiStore();
  const [dismissed, setDismissed] = useState(false);

  if (!demoMode || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-2xl border border-lavender/30 bg-lavender/10 px-4 py-3"
    >
      <Info className="h-4 w-4 shrink-0 text-lavender" aria-hidden />
      <p className="flex-1 text-sm text-primary">
        <strong>Mode démonstration</strong> — les données affichées sont fictives et ne sont jamais
        enregistrées. Vos vraies données restent chiffrées sur votre appareil.
      </p>
      <Button variant="ghost" size="sm" onClick={() => setDemoMode(false)}>
        Quitter la démo
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Fermer le bandeau"
        onClick={() => setDismissed(true)}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
