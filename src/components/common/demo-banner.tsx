"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Trash2, X } from "lucide-react";
import { saveSettings } from "@/lib/vault/goal-repository";
import { clearDemoData } from "@/lib/vault/demo-data-service";
import { useUiStore } from "@/store/ui-store";
import { toastSuccess, toastError } from "@/store/toast-store";
import { cn } from "@/lib/utils/cn";

/**
 * Velora — bannière du mode démonstration.
 *
 * Affichée en haut de chaque page quand `demoMode` est activé dans les
 * paramètres (lu depuis les settings chiffrés). Les données affichées sont
 * les données fictives seedées dans le coffre (tag `__demo__`).
 *
 * Le bouton « Quitter la démo » :
 * 1. Supprime TOUTES les données fictives (clearDemoData)
 * 2. Désactive demoMode dans les settings chiffrés
 * 3. Met à jour le store UI
 */
export function DemoBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [exiting, setExiting] = useState(false);

  // Lit demoMode depuis le store UI (synchronisé depuis les settings chiffrés
  // par le Header au chargement) — source de vérité unique, pas de double fetch.
  const { demoMode, setDemoMode } = useUiStore();
  useEffect(() => {
    setVisible(demoMode);
  }, [demoMode]);

  async function handleExitDemo() {
    if (exiting) return;
    setExiting(true);
    try {
      const result = await clearDemoData();
      await saveSettings({ demoMode: false });
      setDemoMode(false);
      setVisible(false);
      const total =
        result.applications +
        result.documents +
        result.events +
        result.goals +
        result.journalEntries +
        result.interviewPreps;
      toastSuccess(
        total > 0
          ? `Mode démonstration quitté. ${total} données fictives supprimées.`
          : "Mode démonstration quitté."
      );
    } catch (err) {
      console.error("[demo-banner] Erreur sortie démo:", err);
      toastError("Erreur lors de la sortie du mode démonstration.");
    } finally {
      setExiting(false);
    }
  }

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
        onClick={handleExitDemo}
        disabled={exiting}
        className="shrink-0 rounded-lg bg-warning/20 px-3 py-1 text-xs font-medium text-warning transition-colors hover:bg-warning/30 disabled:opacity-50"
      >
        {exiting ? (
          "Nettoyage…"
        ) : (
          <>
            <Trash2 className="mr-1 inline h-3 w-3" aria-hidden />
            Quitter la démo
          </>
        )}
      </button>
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
