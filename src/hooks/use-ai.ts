"use client";

import { useCallback, useState } from "react";
import {
  runAiTask,
  getAiAvailability,
  AiConsentError,
  type AiRequest,
  type AiResponse,
  type AiTask,
  type AiAvailability,
} from "@/lib/ai/ai-service";
import { toastError } from "@/store/toast-store";

interface UseAiOptions {
  /** Afficher automatiquement la modal de consentement avant l'appel. */
  requireConsent?: boolean;
}

interface UseAiReturn {
  /** Exécute une tâche IA. */
  execute: (request: AiRequest) => Promise<AiResponse | null>;
  /** État de disponibilité IA. */
  availability: AiAvailability | null;
  /** Recharge l'état de disponibilité. */
  refreshAvailability: () => Promise<void>;
  /** En cours d'exécution. */
  loading: boolean;
  /** Dernière erreur. */
  error: string | null;
  /** Données à prévisualiser dans la modal de consentement. */
  pendingPreview: { task: AiTask; dataPreview: { label: string; value: string }[] } | null;
  /** Appelle cette fonction pour confirmer l'envoi après preview. */
  confirmPending: () => Promise<void>;
  /** Annule l'envoi en attente. */
  cancelPending: () => void;
}

/**
 * Velora — hook React pour les appels IA.
 *
 * Gère :
 * - La vérification du consentement
 * - L'affichage de la modal de preview (données envoyées)
 * - L'exécution de la tâche IA
 * - Les états loading/error
 */
export function useAi(_options: UseAiOptions = {}): UseAiReturn {
  const [availability, setAvailability] = useState<AiAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<{
    task: AiTask;
    dataPreview: { label: string; value: string }[];
    request: AiRequest;
  } | null>(null);

  const refreshAvailability = useCallback(async () => {
    const av = await getAiAvailability();
    setAvailability(av);
  }, []);

  const execute = useCallback(async (request: AiRequest): Promise<AiResponse | null> => {
    setError(null);
    setLoading(true);
    try {
      const response = await runAiTask(request);
      return response;
    } catch (err) {
      if (err instanceof AiConsentError) {
        setError(err.message);
        toastError(err.message);
      } else {
        const message = err instanceof Error ? err.message : "Erreur IA inconnue";
        setError(message);
        toastError(message);
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmPending = useCallback(async () => {
    if (!pendingPreview) return;
    setPendingPreview(null);
    await execute(pendingPreview.request);
  }, [pendingPreview, execute]);

  const cancelPending = useCallback(() => {
    setPendingPreview(null);
  }, []);

  return {
    execute,
    availability,
    refreshAvailability,
    loading,
    error,
    pendingPreview: pendingPreview
      ? { task: pendingPreview.task, dataPreview: pendingPreview.dataPreview }
      : null,
    confirmPending,
    cancelPending,
  };
}
