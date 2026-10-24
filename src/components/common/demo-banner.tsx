"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { getSettings } from "@/lib/vault/goal-repository";
import { cn } from "@/lib/utils/cn";

/**
 * Velora — bannière du mode démonstration.
 *
 * Affichée en haut de chaque page quand `demoMode` est activé dans les
 * paramètres. Les données sont fictives et chiffrées comme les vraies.
 * Peut être fermée pour la session (état local uniquement).
 */
export function DemoBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => setVisible(s.demoMode))
      .catch(() => setVisible(false));
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 border-b border-warning/25 bg-warning/10 px-4 py-2 text-sm text-warning"
      )}
    >
      <FlaskConical className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong>Mode démonstration</strong> — Les données affichées sont fictives et servent à
        découvrir l&apos;application. Vos vraies données ne sont pas affectées.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer la bannière de démonstration"
        className="shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
