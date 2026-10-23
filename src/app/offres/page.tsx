"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardPaste, Sparkles, Wand2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseOfferText, type ParsedOffer } from "@/lib/utils/offer-parser";
import { APPLICATION_TYPE_LABELS, type ApplicationType } from "@/lib/schema/application";

const FIELD_LABELS: Record<string, string> = {
  entreprise: "Entreprise",
  poste: "Poste",
  type: "Type",
  localisation: "Localisation",
  télétravail: "Télétravail",
  salaire: "Salaire",
  source: "Source",
};

export default function OffresPage() {
  const [rawText, setRawText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [parsed, setParsed] = useState<ParsedOffer | null>(null);
  const [edited, setEdited] = useState<ParsedOffer | null>(null);

  function handleParse() {
    if (!rawText.trim()) return;
    const result = parseOfferText(rawText, sourceUrl.trim());
    setParsed(result);
    setEdited(result);
  }

  function handlePaste() {
    navigator.clipboard
      .readText()
      .then((text) => setRawText(text))
      .catch(() => {
        /* permission refusée — l'utilisateur colle manuellement */
      });
  }

  function updateField<K extends keyof ParsedOffer>(field: K, value: ParsedOffer[K]) {
    setEdited((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  function buildQuery(): string {
    if (!edited) return "";
    const params = new URLSearchParams();
    if (edited.company) params.set("company", edited.company);
    if (edited.position) params.set("position", edited.position);
    if (edited.type) params.set("type", edited.type);
    if (edited.location) params.set("location", edited.location);
    if (edited.remote) params.set("remote", "1");
    if (edited.salary) params.set("salary", edited.salary);
    if (edited.source) params.set("source", edited.source);
    if (sourceUrl.trim()) params.set("offerUrl", sourceUrl.trim());
    if (edited.excerpt) params.set("notes", edited.excerpt.slice(0, 4000));
    return params.toString();
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Explorer les offres</h1>
          <p className="mt-2 text-secondary">
            Collez le texte d&apos;une offre d&apos;emploi. Velora extrait localement les
            informations clés — <strong>sans aucune IA, sans envoi de données</strong> — pour
            pré-remplir une candidature.
          </p>
        </div>

        <Card className="space-y-4">
          <CardTitle className="text-lg">Texte de l&apos;offre</CardTitle>
          <div>
            <label htmlFor="source-url" className="mb-1.5 block text-sm text-secondary">
              URL de l&apos;offre (optionnel — pour détecter la source)
            </label>
            <input
              id="source-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.linkedin.com/jobs/view/…"
              className={inputClass}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="offer-text" className="block text-sm text-secondary">
                Collez le texte de l&apos;offre ici
              </label>
              <Button variant="ghost" size="sm" onClick={handlePaste}>
                <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                Coller
              </Button>
            </div>
            <textarea
              id="offer-text"
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Copiez-collez le contenu de l'offre depuis LinkedIn, Indeed, Welcome to the Jungle…"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleParse} disabled={!rawText.trim()}>
              <Wand2 className="h-4 w-4" aria-hidden />
              Analyser l&apos;offre
            </Button>
          </div>
        </Card>

        {parsed && edited && (
          <Card className="space-y-6">
            <div>
              <CardTitle className="text-lg">Informations extraites</CardTitle>
              <CardDescription className="mt-1">
                {parsed.detectedFields.length > 0 ? (
                  <>
                    Détecté localement :{" "}
                    {parsed.detectedFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}.{" "}
                    <strong>Vérifiez et corrigez avant de créer la candidature.</strong>
                  </>
                ) : (
                  <>
                    Aucune information détectée automatiquement. Remplissez les champs manuellement
                    — l&apos;extrait du texte sera conservé dans les notes.
                  </>
                )}
              </CardDescription>
            </div>

            {parsed.detectedFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsed.detectedFields.map((f) => (
                  <Badge key={f} variant="success">
                    {FIELD_LABELS[f] ?? f}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Entreprise</span>
                <input
                  type="text"
                  value={edited.company}
                  onChange={(e) => updateField("company", e.target.value)}
                  className={inputClass}
                  placeholder="Nom de l'entreprise"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Poste</span>
                <input
                  type="text"
                  value={edited.position}
                  onChange={(e) => updateField("position", e.target.value)}
                  className={inputClass}
                  placeholder="Intitulé du poste"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Type de contrat</span>
                <select
                  value={edited.type}
                  onChange={(e) => updateField("type", e.target.value as ApplicationType | "")}
                  className={inputClass}
                >
                  <option value="">— Non détecté —</option>
                  {(Object.keys(APPLICATION_TYPE_LABELS) as ApplicationType[]).map((t) => (
                    <option key={t} value={t}>
                      {APPLICATION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Localisation</span>
                <input
                  type="text"
                  value={edited.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  className={inputClass}
                  placeholder="Ville, région…"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Rémunération</span>
                <input
                  type="text"
                  value={edited.salary}
                  onChange={(e) => updateField("salary", e.target.value)}
                  className={inputClass}
                  placeholder="Ex : 45-55k€, Selon profil…"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Source</span>
                <input
                  type="text"
                  value={edited.source}
                  onChange={(e) => updateField("source", e.target.value)}
                  className={inputClass}
                  placeholder="Ex : LinkedIn, Indeed…"
                />
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={edited.remote}
                onChange={(e) => updateField("remote", e.target.checked)}
                className="accent-lavender"
              />
              Télétravail possible
            </label>

            <div className="rounded-xl border border-subtle bg-background/40 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary">
                Extrait conservé dans les notes ({edited.excerpt.length} caractères)
              </p>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-secondary">
                {edited.excerpt}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setParsed(null);
                  setEdited(null);
                }}
              >
                Effacer
              </Button>
              <Link href={`/candidatures?${buildQuery()}`}>
                <Button disabled={!edited.company || !edited.position}>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  Créer la candidature
                </Button>
              </Link>
            </div>
          </Card>
        )}

        {!parsed && (
          <Card className="border-lavender/25 bg-lavender/5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-lavender" aria-hidden />
              <div className="text-sm">
                <p className="font-medium text-primary">Confidentialité totale</p>
                <p className="mt-1 text-secondary">
                  L&apos;analyse est faite <strong>100% localement</strong> par des règles
                  déterministes. Aucune donnée n&apos;est envoyée à un serveur ou à une IA. Une
                  analyse IA facultative pourra être proposée dans une prochaine phase, uniquement
                  avec votre consentement explicite.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
