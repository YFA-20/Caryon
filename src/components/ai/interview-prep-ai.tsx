"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiConsentModal } from "./ai-consent-modal";
import { prepareInterviewWithAi, type InterviewPrepResult } from "@/lib/ai/offer-analyzer";
import { getAiAvailability } from "@/lib/ai/ai-service";
import { listDocuments, getDocumentContent } from "@/lib/vault/document-repository";
import { toastError, toastSuccess } from "@/store/toast-store";
import { cn } from "@/lib/utils/cn";

interface InterviewPrepAiProps {
  /** Texte de l'offre (notes de la candidature). */
  offerText: string;
  /** Nom de l'entreprise. */
  company: string;
  /** Poste visé. */
  position: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique",
  comportementale: "Comportementale",
  entreprise: "Entreprise",
  motivation: "Motivation",
};

const CATEGORY_COLORS: Record<string, string> = {
  technique: "bg-primary/10 text-primary border-primary/20",
  comportementale: "bg-lavender/15 text-lavender border-lavender/25",
  entreprise: "bg-warning/15 text-warning border-warning/25",
  motivation: "bg-success/15 text-success border-success/25",
};

/**
 * Velora — préparation d'entretien IA.
 *
 * Génère des questions probables + suggestions de réponses basées
 * sur l'offre et le CV de l'utilisateur.
 */
export function InterviewPrepAi({ offerText, company, position }: InterviewPrepAiProps) {
  const router = useRouter();
  const [selectedCvId, setSelectedCvId] = useState("");
  const [cvList, setCvList] = useState<{ id: string; name: string }[]>([]);
  const [cvListLoaded, setCvListLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InterviewPrepResult | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [provider, setProvider] = useState<"local" | "cloud">("local");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  async function loadCvList() {
    if (cvListLoaded) return;
    try {
      const docs = await listDocuments();
      const cvs = docs.filter((d) => d.type === "cv").map((d) => ({ id: d.id, name: d.name }));
      setCvList(cvs);
      setCvListLoaded(true);
      if (cvs.length > 0) setSelectedCvId(cvs[0]!.id);
    } catch (err) {
      console.error("[interview-prep] Erreur chargement CVs:", err);
    }
  }

  async function handleGenerate() {
    if (!selectedCvId || !offerText.trim()) return;
    const av = await getAiAvailability();
    if (!av.consentGiven) {
      router.push("/parametres#ia");
      return;
    }
    setProvider(av.preferredProvider);
    setShowConsent(true);
  }

  async function handleConfirm() {
    setShowConsent(false);
    setLoading(true);
    setResult(null);
    try {
      const content = await getDocumentContent(selectedCvId);
      if (!content) {
        toastError("Impossible de lire le CV sélectionné.");
        return;
      }
      const cvText = new TextDecoder("utf-8", { fatal: false }).decode(content);
      const prep = await prepareInterviewWithAi(offerText, cvText);
      if (prep) {
        setResult(prep);
        toastSuccess(`${prep.questions.length} questions générées — bonne préparation !`);
      } else {
        toastError("L'IA n'a pas pu générer de préparation.");
      }
    } catch (err) {
      console.error("[interview-prep] Erreur:", err);
      toastError(err instanceof Error ? err.message : "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  }

  const selectedCvName = cvList.find((c) => c.id === selectedCvId)?.name ?? "";

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
          <MessageSquare className="h-5 w-5 text-lavender" aria-hidden />
        </div>
        <div>
          <CardTitle className="text-lg">Préparer l&apos;entretien (IA)</CardTitle>
          <CardDescription>
            Questions probables pour {position} chez {company}.
          </CardDescription>
        </div>
      </div>

      {/* Sélection du CV */}
      <div>
        <label htmlFor="prep-cv-select" className="mb-1.5 block text-sm text-secondary">
          CV à utiliser comme profil
        </label>
        <select
          id="prep-cv-select"
          value={selectedCvId}
          onChange={(e) => setSelectedCvId(e.target.value)}
          onFocus={loadCvList}
          className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary focus-visible:ring-2 focus-visible:ring-lavender"
        >
          {cvList.length === 0 ? (
            <option value="">Aucun CV trouvé — ajoutez-en un dans « Mes documents »</option>
          ) : (
            cvList.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.name}
              </option>
            ))
          )}
        </select>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedCvId || !offerText.trim() || loading || cvList.length === 0}
          onClick={handleGenerate}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-lavender" aria-hidden />
          )}
          {loading ? "Génération en cours…" : "Générer la préparation"}
        </Button>
      </div>

      {/* Résultat */}
      {result && (
        <div className="space-y-4 border-t border-subtle pt-4">
          {/* Questions */}
          {result.questions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-secondary">
                🎯 {result.questions.length} questions probables
              </p>
              {result.questions.map((q, i) => (
                <div key={i} className="rounded-xl border border-subtle bg-surface p-3">
                  <button
                    type="button"
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                    aria-expanded={expandedIdx === i}
                  >
                    <div className="min-w-0 flex-1">
                      <Badge className={cn("mb-1.5", CATEGORY_COLORS[q.categorie])}>
                        {CATEGORY_LABELS[q.categorie]}
                      </Badge>
                      <p className="text-sm font-medium text-primary">{q.question}</p>
                      {q.competenceVisee && (
                        <p className="mt-0.5 text-xs text-secondary">
                          Compétence visée : {q.competenceVisee}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-lavender">
                      {expandedIdx === i ? "Masquer" : "Voir la suggestion"}
                    </span>
                  </button>
                  {expandedIdx === i && q.suggestionReponse && (
                    <div className="mt-3 rounded-lg border border-lavender/25 bg-lavender/5 p-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-lavender">
                        💡 Suggestion de réponse
                      </p>
                      <p className="mt-1 text-sm text-primary">{q.suggestionReponse}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Questions à poser */}
          {result.questionsAPoser.length > 0 && (
            <div className="rounded-xl border border-success/25 bg-success/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-success">
                🙋 Questions à poser au recruteur
              </p>
              <ul className="mt-2 space-y-1 text-sm text-primary">
                {result.questionsAPoser.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Conseils généraux */}
          {result.conseilsGeneraux.length > 0 && (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-warning">
                💡 Conseils généraux
              </p>
              <ul className="mt-2 space-y-1 text-sm text-primary">
                {result.conseilsGeneraux.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal consentement */}
      {showConsent && (
        <AiConsentModal
          task="prepare_interview"
          dataPreview={[
            { label: "Votre CV", value: selectedCvName },
            {
              label: "Offre",
              value: offerText.slice(0, 300) + (offerText.length > 300 ? "…" : ""),
            },
          ]}
          provider={provider}
          onConfirm={handleConfirm}
          onCancel={() => setShowConsent(false)}
        />
      )}
    </Card>
  );
}
