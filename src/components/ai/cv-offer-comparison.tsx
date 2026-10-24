"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileSearch, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiConsentModal } from "./ai-consent-modal";
import { compareCvWithOffer, type CvOfferComparison } from "@/lib/ai/offer-analyzer";
import { getAiAvailability } from "@/lib/ai/ai-service";
import { toastError, toastSuccess } from "@/store/toast-store";
import { cn } from "@/lib/utils/cn";

interface CvOfferComparisonProps {
  /** Texte extrait du CV sélectionné. */
  cvText: string;
  cvName: string;
}

/**
 * Velora — comparaison CV ↔ Offre IA.
 *
 * L'utilisateur colle une offre, on compare avec le CV sélectionné.
 * Affiche : score de correspondance, compétences présentes/manquantes,
 * suggestions d'amélioration.
 */
export function CvOfferComparison({ cvText, cvName }: CvOfferComparisonProps) {
  const router = useRouter();
  const [offerText, setOfferText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CvOfferComparison | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [provider, setProvider] = useState<"local" | "cloud">("local");

  async function handleCompare() {
    if (!offerText.trim()) return;
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
      const comparison = await compareCvWithOffer(cvText, offerText);
      if (comparison) {
        setResult(comparison);
        toastSuccess("Comparaison effectuée — consultez les résultats ci-dessous.");
      } else {
        toastError("L'IA n'a pas pu produire de comparaison structurée.");
      }
    } catch (err) {
      console.error("[cv-comparison] Erreur:", err);
      toastError(err instanceof Error ? err.message : "Erreur lors de la comparaison.");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor =
    result && result.scoreCorrespondance >= 70
      ? "text-success"
      : result && result.scoreCorrespondance >= 40
        ? "text-warning"
        : "text-danger";

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
          <FileSearch className="h-5 w-5 text-lavender" aria-hidden />
        </div>
        <div>
          <CardTitle className="text-lg">Comparer avec une offre (IA)</CardTitle>
          <CardDescription>Analyse {cvName} par rapport à une offre d&apos;emploi.</CardDescription>
        </div>
      </div>

      <div>
        <label htmlFor="cv-offer-text" className="mb-1.5 block text-sm text-secondary">
          Collez le texte de l&apos;offre
        </label>
        <textarea
          id="cv-offer-text"
          rows={6}
          value={offerText}
          onChange={(e) => setOfferText(e.target.value)}
          placeholder="Copiez-collez le texte de l'offre d'emploi ici…"
          className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!offerText.trim() || loading}
          onClick={handleCompare}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-lavender" aria-hidden />
          )}
          {loading ? "Comparaison en cours…" : "Comparer CV ↔ Offre"}
        </Button>
      </div>

      {/* Résultat */}
      {result && (
        <div className="space-y-4 border-t border-subtle pt-4">
          {/* Score */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={cn("font-serif text-4xl font-bold", scoreColor)}>
                {result.scoreCorrespondance}%
              </p>
              <p className="text-xs text-secondary">Correspondance</p>
            </div>
            <div className="flex-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    result.scoreCorrespondance >= 70
                      ? "bg-success"
                      : result.scoreCorrespondance >= 40
                        ? "bg-warning"
                        : "bg-danger"
                  )}
                  style={{ width: `${result.scoreCorrespondance}%` }}
                />
              </div>
            </div>
          </div>

          {/* Compétences */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-success/25 bg-success/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-success">
                ✅ Présentes ({result.competencesPresentes.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.competencesPresentes.map((c, i) => (
                  <Badge key={i} variant="success">
                    {c}
                  </Badge>
                ))}
                {result.competencesPresentes.length === 0 && (
                  <span className="text-xs text-secondary">Aucune</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-danger/25 bg-danger/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-danger">
                ❌ Manquantes ({result.competencesManquantes.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.competencesManquantes.map((c, i) => (
                  <Badge key={i} variant="danger">
                    {c}
                  </Badge>
                ))}
                {result.competencesManquantes.length === 0 && (
                  <span className="text-xs text-secondary">Aucune</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-lavender/25 bg-lavender/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-lavender">
                🔄 Transversales ({result.competencesTransversales.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.competencesTransversales.map((c, i) => (
                  <Badge key={i} variant="lavender">
                    {c}
                  </Badge>
                ))}
                {result.competencesTransversales.length === 0 && (
                  <span className="text-xs text-secondary">Aucune</span>
                )}
              </div>
            </div>
          </div>

          {/* Points forts */}
          {result.pointsForts.length > 0 && (
            <div className="rounded-xl border border-subtle bg-surface p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-secondary">
                💪 Vos points forts pour ce poste
              </p>
              <ul className="mt-2 space-y-1 text-sm text-primary">
                {result.pointsForts.map((p, i) => (
                  <li key={i}>• {p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div className="rounded-xl border border-warning/25 bg-warning/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-warning">
                💡 Suggestions d&apos;amélioration
              </p>
              <ul className="mt-2 space-y-1 text-sm text-primary">
                {result.suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modal consentement */}
      {showConsent && (
        <AiConsentModal
          task="compare_cv_offer"
          dataPreview={[
            { label: "Votre CV", value: `${cvName} — ${cvText.slice(0, 300)}…` },
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
