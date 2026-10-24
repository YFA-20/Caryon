"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiConsentModal } from "./ai-consent-modal";
import { getAiAvailability, type AiTask } from "@/lib/ai/ai-service";
import { cn } from "@/lib/utils/cn";

interface AiActionButtonProps {
  task: AiTask;
  /** Données à prévisualiser dans la modal de consentement. */
  dataPreview: { label: string; value: string }[];
  /** Désactive le bouton (ex: pas de texte à analyser). */
  disabled?: boolean;
  /** Classe CSS additionnelle. */
  className?: string;
  /** Label du bouton. */
  label?: string;
  /** Variente du bouton. */
  variant?: "primary" | "ghost" | "outline";
  /** Taille du bouton. */
  size?: "sm" | "md" | "lg";
  /**
   * Appelé quand l'utilisateur confirme l'envoi.
   * Doit retourner le résultat ou lever une erreur.
   */
  onRun: () => Promise<void>;
  /** Appelé si le consentement n'est pas donné (pour rediriger vers les paramètres). */
  onNeedConsent?: () => void;
}

/**
 * Velora — bouton d'action IA avec consentement intégré.
 *
 * Affiche un bouton « Analyser avec l'IA ». Au clic :
 * 1. Vérifie si le consentement est donné
 * 2. Si non → appelle onNeedConsent (redirection paramètres)
 * 3. Si oui → ouvre la modal de preview des données
 * 4. Si l'utilisateur confirme → exécute onRun
 */
export function AiActionButton({
  task,
  dataPreview,
  disabled = false,
  className,
  label = "Analyser avec l'IA",
  variant = "outline",
  size = "sm",
  onRun,
  onNeedConsent,
}: AiActionButtonProps) {
  const [showConsent, setShowConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<"local" | "cloud">("local");

  async function handleClick() {
    const av = await getAiAvailability();
    if (!av.consentGiven) {
      onNeedConsent?.();
      return;
    }
    setProvider(av.preferredProvider);
    setShowConsent(true);
  }

  async function handleConfirm() {
    setShowConsent(false);
    setLoading(true);
    try {
      await onRun();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={disabled || loading}
        onClick={handleClick}
        className={cn("gap-1.5", className)}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3.5 w-3.5 text-lavender" aria-hidden />
        )}
        {loading ? "Analyse en cours…" : label}
      </Button>

      {showConsent && (
        <AiConsentModal
          task={task}
          dataPreview={dataPreview}
          provider={provider}
          onConfirm={handleConfirm}
          onCancel={() => setShowConsent(false)}
        />
      )}
    </>
  );
}
