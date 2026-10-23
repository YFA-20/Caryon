"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useUiStore } from "@/store/ui-store";
import { computeDemoStats, DEMO_APPLICATIONS, DEMO_FIRST_NAME } from "@/lib/demo/demo-data";
import { listApplications } from "@/lib/vault/application-repository";
import { listUpcomingEvents } from "@/lib/vault/calendar-repository";
import { computeStats } from "@/lib/vault/stats-service";
import { getApplicationsNeedingFollowUp } from "@/lib/vault/followup-service";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/schema/application";
import type { CalendarEvent } from "@/lib/schema/calendar";
import { formatDateFr } from "@/lib/utils/date";
import { AppShell } from "@/components/layout/app-shell";
import { DemoBanner } from "./demo-banner";
import { EmptyState } from "./empty-state";
import { FollowUpSection } from "./follow-up-section";
import { PipelineChart } from "./pipeline-chart";
import { StatCard } from "./stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardElevated, CardTitle } from "@/components/ui/card";

function nextDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const DEMO_UPCOMING = [
  {
    id: "evt-1",
    title: "Entretien technique — Atelier Nova (fictif)",
    date: nextDays(3),
    kind: "Entretien",
  },
  {
    id: "evt-2",
    title: "Relance — Studio Lumen (fictif)",
    date: nextDays(5),
    kind: "Relance",
  },
  {
    id: "evt-3",
    title: "Répondre à l'offre — Cabinet Aster (fictif)",
    date: nextDays(2),
    kind: "Échéance",
  },
];

export function Dashboard() {
  const { demoMode, firstName } = useUiStore();

  // Données réelles (chiffrées)
  const [realApps, setRealApps] = useState<Application[]>([]);
  const [realEvents, setRealEvents] = useState<CalendarEvent[]>([]);
  const [realLoading, setRealLoading] = useState(true);

  const loadReal = useCallback(async () => {
    setRealLoading(true);
    try {
      const [apps, events] = await Promise.all([listApplications(), listUpcomingEvents(5)]);
      setRealApps(apps);
      setRealEvents(events);
    } catch (err) {
      console.error("[dashboard] Erreur chargement données réelles:", err);
    } finally {
      setRealLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!demoMode) loadReal();
  }, [demoMode, loadReal]);

  const applications: Application[] = useMemo(
    () => (demoMode ? DEMO_APPLICATIONS : realApps),
    [demoMode, realApps]
  );

  const stats = useMemo(() => {
    if (demoMode) return computeDemoStats(applications);
    const full = computeStats(applications, realEvents);
    return {
      active: full.active,
      interviewsUpcoming: full.upcomingInterviews,
      positiveResponses: full.byStatus["offre_recue"] ?? 0,
      followupsNeeded: getApplicationsNeedingFollowUp(applications).length,
    };
  }, [demoMode, applications, realEvents]);

  const name = firstName || (demoMode ? DEMO_FIRST_NAME : "");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bonne après-midi";
    return "Bonsoir";
  }, []);

  const loading = !demoMode && realLoading;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        {demoMode ? <DemoBanner /> : null}

        {/* En-tête de page */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">
              {greeting}
              {name ? `, ${name}` : ""}.
            </h1>
            <p className="mt-2 text-secondary">
              {loading
                ? "Chargement de vos données chiffrées…"
                : applications.length > 0
                  ? `${stats.active} candidature${stats.active > 1 ? "s" : ""} active${stats.active > 1 ? "s" : ""} · ${stats.interviewsUpcoming} entretien${stats.interviewsUpcoming > 1 ? "s" : ""} à venir`
                  : "Bienvenue dans votre espace privé. Créez votre première candidature pour commencer."}
            </p>
          </div>
          <Link href="/candidatures">
            <Button size="md" disabled={loading}>
              <Plus className="h-4 w-4" aria-hidden />
              Une opportunité, une action
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card className="p-10 text-center">
            <p className="text-secondary">Déchiffrement de vos données…</p>
          </Card>
        ) : applications.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Carte principale en dégradé */}
            <CardElevated>
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <div className="space-y-4">
                  <div>
                    <CardTitle className="text-primary">Votre pipeline</CardTitle>
                    <CardDescription className="text-primary/70">
                      Vue d&apos;ensemble de vos candidatures
                    </CardDescription>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Actives" value={stats.active} icon={Send} accent="rose" />
                    <StatCard
                      label="Entretiens"
                      value={stats.interviewsUpcoming}
                      icon={CalendarDays}
                      accent="lavender"
                    />
                    <StatCard
                      label="Réponses +"
                      value={stats.positiveResponses}
                      icon={CheckCircle2}
                      accent="success"
                    />
                    <StatCard
                      label="Relances"
                      value={stats.followupsNeeded}
                      icon={Clock}
                      accent="warning"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-primary/70">
                    Répartition par statut
                  </p>
                  <PipelineChart applications={applications} />
                </div>
              </div>
            </CardElevated>

            {/* Relances intelligentes (données réelles uniquement) */}
            {!demoMode && <FollowUpSection />}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Votre journée */}
              <Card>
                <CardTitle>Votre journée</CardTitle>
                <CardDescription>Actions prioritaires, relances et échéances</CardDescription>
                <ul className="mt-4 space-y-3">
                  {applications
                    .filter((a) => ["entretien", "envoyee", "en_attente"].includes(a.status))
                    .slice(0, 4)
                    .map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-subtle bg-background/40 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-primary">{a.position}</p>
                          <p className="truncate text-xs text-secondary">{a.company}</p>
                        </div>
                        <Badge
                          variant={
                            a.status === "entretien"
                              ? "lavender"
                              : a.status === "en_attente"
                                ? "warning"
                                : "rose"
                          }
                        >
                          {APPLICATION_STATUS_LABELS[a.status]}
                        </Badge>
                      </li>
                    ))}
                  {applications.filter((a) =>
                    ["entretien", "envoyee", "en_attente"].includes(a.status)
                  ).length === 0 && (
                    <li className="rounded-2xl border border-subtle bg-background/40 p-3 text-sm text-secondary">
                      Aucune candidature active à suivre pour le moment.
                    </li>
                  )}
                </ul>
              </Card>

              {/* À venir */}
              <Card>
                <CardTitle>À venir</CardTitle>
                <CardDescription>Vos prochains événements</CardDescription>
                <ul className="mt-4 space-y-3">
                  {(demoMode
                    ? DEMO_UPCOMING.map((e) => ({
                        id: e.id,
                        title: e.title,
                        dateIso: e.date,
                        kindLabel: e.kind,
                      }))
                    : realEvents.map((e) => ({
                        id: e.id,
                        title: e.title,
                        dateIso: e.startAt,
                        kindLabel: e.allDay ? "Journée entière" : "Événement",
                      }))
                  ).map((evt) => (
                    <li
                      key={evt.id}
                      className="flex items-center gap-3 rounded-2xl border border-subtle bg-background/40 p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-card-elevated">
                        <span className="text-[10px] uppercase text-secondary">
                          {new Date(evt.dateIso).toLocaleDateString("fr-FR", {
                            month: "short",
                          })}
                        </span>
                        <span className="font-serif text-lg font-semibold leading-none text-rose">
                          {new Date(evt.dateIso).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-primary">{evt.title}</p>
                        <p className="text-xs text-secondary">
                          {evt.kindLabel} · {formatDateFr(evt.dateIso)}
                        </p>
                      </div>
                    </li>
                  ))}
                  {!demoMode && realEvents.length === 0 && (
                    <li className="rounded-2xl border border-subtle bg-background/40 p-3 text-sm text-secondary">
                      Aucun événement à venir. Ajoutez un entretien ou une relance dans le
                      calendrier.
                    </li>
                  )}
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
