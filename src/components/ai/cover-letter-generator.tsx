"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { AiConsentModal } from "./ai-consent-modal";
import { generateCoverLetter } from "@/lib/ai/offer-analyzer";
import { getAiAvailability } from "@/lib/ai/ai-service";
import { listDocuments, getDocumentContent } from "@/lib/vault/document-repository";
import { toastError, toastSuccess } from "@/store/toast-store";

interface CoverLetterGeneratorProps {
  /** Texte de l'offre (pré-rempli depuis la candidature). */
  offerText: string;
  /** Nom de l'entreprise (pour le contexte). */
  company: string;
  /** Poste visé. */
  position: string;
  onGenerated?: (letter: string) => void;
}

/**
 * Velora — générateur de lettre de motivation IA.
 *
 * L'utilisateur sélectionne son CV parmi les documents stockés,
 * l'IA génère un brouillon de lettre. Le résultat est éditable et
 * copiable — jamais sauvegardé automatiquement.
 */
export function CoverLetterGenerator({
  offerText,
  company,
  position,
  onGenerated,
}: CoverLetterGeneratorProps) {
  const router = useRouter();
  const [selectedCvId, setSelectedCvId] = useState("");
  const [cvList, setCvList] = useState<{ id: string; name: string }[]>([]);
  const [cvListLoaded, setCvListLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [letter, setLetter] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [provider, setProvider] = useState<"local" | "cloud">("local");
  const [cvPreview, setCvPreview] = useState("");

  // Charge la liste des CV au premier rendu
  async function loadCvList() {
    if (cvListLoaded) return;
    try {
      const docs = await listDocuments();
      const cvs = docs.filter((d) => d.type === "cv").map((d) => ({ id: d.id, name: d.name }));
      setCvList(cvs);
      setCvListLoaded(true);
      if (cvs.length > 0) setSelectedCvId(cvs[0]!.id);
    } catch (err) {
      console.error("[cover-letter] Erreur chargement CVs:", err);
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

    // Extrait le texte du CV pour la preview
    try {
      const content = await getDocumentContent(selectedCvId);
      if (content) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(content);
        setCvPreview(text.slice(0, 500));
      }
    } catch {
      setCvPreview("");
    }

    setShowConsent(true);
  }

  async function handleConfirm() {
    setShowConsent(false);
    setLoading(true);
    setLetter("");
    try {
      const content = await getDocumentContent(selectedCvId);
      if (!content) {
        toastError("Impossible de lire le CV sélectionné.");
        return;
      }
      const cvText = new TextDecoder("utf-8", { fatal: false }).decode(content);
      const result = await generateCoverLetter(offerText, cvText);
      if (result) {
        setLetter(result);
        onGenerated?.(result);
        toastSuccess("Lettre générée — vous pouvez l'éditer ci-dessous.");
      } else {
        toastError("L'IA n'a pas pu générer de lettre.");
      }
    } catch (err) {
      console.error("[cover-letter] Erreur:", err);
      toastError(err instanceof Error ? err.message : "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(letter).then(
      () => toastSuccess("Lettre copiée dans le presse-papiers."),
      () => toastError("Impossible de copier.")
    );
  }

  const selectedCvName = cvList.find((c) => c.id === selectedCvId)?.name ?? "";

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
          <PenLine className="h-5 w-5 text-lavender" aria-hidden />
        </div>
        <div>
          <CardTitle className="text-lg">Générer une lettre de motivation (IA)</CardTitle>
          <CardDescription>
            Brouillon personnalisé pour {position} chez {company}.
          </CardDescription>
        </div>
      </div>

      {/* Sélection du CV */}
      <div>
        <label htmlFor="cv-select" className="mb-1.5 block text-sm text-secondary">
          CV à utiliser comme base
        </label>
        <select
          id="cv-select"
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

      {/* Aperçu de l'offre */}
      {offerText && (
        <div className="rounded-xl border border-subtle bg-surface p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-secondary">
            Offre analysée
          </p>
          <p className="mt-1 line-clamp-3 text-sm text-primary">{offerText}</p>
        </div>
      )}

      {/* Bouton générer */}
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
          {loading ? "Génération en cours…" : "Générer la lettre"}
        </Button>
      </div>

      {/* Résultat */}
      {letter && (
        <div className="space-y-3 border-t border-subtle pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-secondary">
              Brouillon — à éditer avant envoi
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              Copier
            </Button>
          </div>
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={14}
            className="w-full rounded-xl border border-subtle bg-surface px-4 py-3 font-serif text-sm leading-relaxed text-primary focus-visible:ring-2 focus-visible:ring-lavender"
            aria-label="Lettre de motivation (éditable)"
          />
          <p className="text-xs text-secondary">
            💡 Ce brouillon est généré par IA. Relisez-le, personnalisez-le et vérifiez qu&apos;il
            ne contient que des informations réelles vous concernant.
          </p>
        </div>
      )}

      {/* Modal consentement */}
      {showConsent && (
        <AiConsentModal
          task="generate_letter"
          dataPreview={[
            { label: "Votre CV", value: `${selectedCvName} — ${cvPreview.slice(0, 200)}…` },
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
