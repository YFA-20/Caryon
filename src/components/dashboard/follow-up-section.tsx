"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarPlus, Loader2 } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listApplications } from "@/lib/vault/application-repository";
import { createEvent } from "@/lib/vault/calendar-repository";
import {
  getApplicationsNeedingFollowUp,
  type FollowUpSuggestion,
} from "@/lib/vault/followup-service";
import { APPLICATION_STATUS_LABELS } from "@/lib/schema/application";

const PRIORITY_VARIANT: Record<
  FollowUpSuggestion["suggestedPriority"],
  "danger" | "warning" | "default"
> = {
  haute: "danger",
  normale: "warning",
  basse: "default",
};

const PRIORITY_LABEL: Record<FollowUpSuggestion["suggestedPriority"], string> = {
  haute: "Urgent",
  normale: "À relancer",
  basse: "Basse priorité",
};

/**
 * Velora — section « Relances nécessaires » du tableau de bord.
 *
 * Affiche les candidatures envoyées sans réponse depuis trop longtemps et
 * propose de créer un événement « Relance » dans le calendrier en un clic.
 */
export function FollowUpSection() {
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const apps = await listApplications();
      setSuggestions(getApplicationsNeedingFollowUp(apps));
    } catch (err) {
      console.error("[dashboard] Erreur chargement relances:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateFollowUp(suggestion: FollowUpSuggestion) {
    setCreatingId(suggestion.application.id);
    try {
      // Relance dans 1 jour à 9h00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      await createEvent({
        title: `Relance — ${suggestion.application.company}`,
        type: "relance",
        startAt: tomorrow.toISOString(),
        endAt: "",
        allDay: false,
        applicationId: suggestion.application.id,
        notes: `Relance suggérée : candidature envoyée il y a ${suggestion.daysSince} jours (seuil : ${suggestion.thresholdDays} jours). Poste : ${suggestion.application.position}.`,
      });
      setCreatedIds((prev) => new Set(prev).add(suggestion.application.id));
    } catch (err) {
      console.error("[dashboard] Erreur création relance:", err);
    } finally {
      setCreatingId(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-lavender" aria-hidden />
          <span className="sr-only">Analyse des relances…</span>
        </div>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-warning/25 bg-warning/5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
          <BellRing className="h-5 w-5 text-warning" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg">Relances nécessaires</CardTitle>
          <CardDescription className="mt-1">
            {suggestions.length} candidature{suggestions.length > 1 ? "s" : ""} sans réponse depuis
            plus de {suggestions[0]!.thresholdDays} jours. Relancez pour maximiser vos chances.
          </CardDescription>
        </div>
      </div>

      <ul className="mt-4 space-y-3">
        {suggestions.map((s) => {
          const isCreated = createdIds.has(s.application.id);
          return (
            <li
              key={s.application.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-background/40 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-primary">
                  {s.application.position}
                </p>
                <p className="truncate text-xs text-secondary">
                  {s.application.company} · {APPLICATION_STATUS_LABELS[s.application.status]} · il y
                  a {s.daysSince} j
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={PRIORITY_VARIANT[s.suggestedPriority]}>
                  {PRIORITY_LABEL[s.suggestedPriority]}
                </Badge>
                {isCreated ? (
                  <Badge variant="success">Relance créée</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={creatingId === s.application.id}
                    onClick={() => handleCreateFollowUp(s)}
                  >
                    {creatingId === s.application.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
                    )}
                    Créer une relance
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
