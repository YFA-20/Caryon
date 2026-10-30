"use client";

import { useState } from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { AlertTriangle, Eye, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AiTask } from "@/lib/ai/ai-service";

const TASK_LABELS: Record<AiTask, string> = {
  analyze_offer: "Analyser une offre d'emploi",
  compare_cv_offer: "Comparer un CV avec une offre",
  generate_letter: "Générer une lettre de motivation",
  prepare_interview: "Préparer un entretien",
};

interface AiConsentModalProps {
  task: AiTask;
  /** Liste des données qui seront envoyées (pour la preview). */
  dataPreview: { label: string; value: string }[];
  /** Fournisseur qui sera utilisé. */
  provider: "local" | "cloud";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Velora — modal de consentement IA (preview avant envoi).
 *
 * Affichée avant CHAQUE appel IA. Montre exactement quelles données
 * seront envoyées et à qui. L'utilisateur doit cliquer explicitement
 * sur « Autoriser cet envoi ».
 *
 * SÉCURITÉ : aucune donnée n'est envoyée sans ce clic explicite.
 */
export function AiConsentModal({
  task,
  dataPreview,
  provider,
  onConfirm,
  onCancel,
}: AiConsentModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useFocusTrap<HTMLDivElement>(true);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      tabIndex={-1}
    >
      <Card className="w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lavender/15">
              <ShieldCheck className="h-5 w-5 text-lavender" aria-hidden />
            </div>
            <div>
              <h2 id="ai-consent-title" className="font-serif text-lg font-semibold text-primary">
                Consentement — {TASK_LABELS[task]}
              </h2>
              <p className="text-xs text-secondary">
                {provider === "local"
                  ? "Mode local — aucune donnée ne quitte votre appareil"
                  : "Mode cloud — les données ci-dessous seront envoyées à l'API"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="rounded-lg p-1 text-secondary hover:text-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Preview des données */}
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Eye className="h-4 w-4 text-lavender" aria-hidden />
            Données qui seront traitées
          </div>
          <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-subtle bg-surface p-3">
            {dataPreview.map((item, i) => (
              <div key={i} className="text-xs">
                <span className="font-medium text-secondary">{item.label} :</span>{" "}
                <span className="text-primary">
                  {item.value.length > 150 ? `${item.value.slice(0, 150)}…` : item.value}
                </span>
              </div>
            ))}
            {dataPreview.length === 0 && (
              <p className="text-xs text-secondary">Aucune donnée personnelle identifiable.</p>
            )}
          </div>
        </div>

        {/* Avertissement cloud */}
        {provider === "cloud" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              Ces données seront envoyées à un serveur externe (API {"openai"}). Elles sont
              anonymisées (emails, téléphones retirés) mais le fournisseur peut les traiter selon sa
              politique de confidentialité.
            </span>
          </div>
        )}

        {/* Checkbox de confirmation */}
        <label className="mt-4 flex items-start gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-subtle accent-lavender"
          />
          <span>
            J&apos;ai lu la liste des données ci-dessus et j&apos;autorise leur traitement pour
            cette tâche précise.
          </span>
        </label>

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onConfirm} disabled={!confirmed}>
            Autoriser cet envoi
          </Button>
        </div>
      </Card>
    </div>
  );
}
