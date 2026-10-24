"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { getSettings } from "@/lib/vault/goal-repository";
import { getAiAvailability } from "@/lib/ai/ai-service";
import { cn } from "@/lib/utils/cn";

/**
 * Velora — bannière d'activation IA.
 *
 * Affichée sur les pages où l'IA peut être utilisée (offres, documents,
 * candidatures, entretien) quand le consentement IA n'est pas encore donné.
 * Propose d'activer l'IA dans les paramètres.
 */
export function AiConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasCloud, setHasCloud] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await getSettings();
      if (settings.aiConsent) {
        setVisible(false);
        return;
      }
      const availability = await getAiAvailability();
      // N'affiche la bannière que si une IA est réellement disponible
      setHasCloud(availability.cloudAvailable || availability.localAvailable);
      setVisible(true);
    })();
  }, []);

  if (!visible || dismissed || !hasCloud) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-3 border-b border-lavender/25 bg-lavender/10 px-4 py-2 text-sm text-primary"
      )}
    >
      <Sparkles className="h-4 w-4 shrink-0 text-lavender" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong>Assistant IA disponible</strong> — Analysez des offres, générez des lettres et
        préparez vos entretiens avec l&apos;IA. Vos données restent privées (consentement requis).
      </p>
      <Link
        href="/parametres#ia"
        className="shrink-0 rounded-lg bg-card-elevated px-3 py-1 text-xs font-medium text-lavender hover:brightness-110"
      >
        Activer
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Fermer la bannière IA"
        className="shrink-0 rounded-lg p-1 opacity-60 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
