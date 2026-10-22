"use client";

import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Clock, Plus, Send } from "lucide-react";
import { useUiStore } from "@/store/ui-store";
import { computeDemoStats, DEMO_APPLICATIONS, DEMO_FIRST_NAME } from "@/lib/demo/demo-data";
import { APPLICATION_STATUS_LABELS } from "@/lib/schema/application";
import type { Application } from "@/lib/schema/application";
import { formatDateFr } from "@/lib/utils/date";
import { AppShell } from "@/components/layout/app-shell";
import { DemoBanner } from "./demo-banner";
import { EmptyState } from "./empty-state";
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

  const applications: Application[] = useMemo(
    () => (demoMode ? DEMO_APPLICATIONS : []),
    [demoMode]
  );
  const stats = useMemo(() => computeDemoStats(applications), [applications]);
  const name = firstName || (demoMode ? DEMO_FIRST_NAME : "");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bonne après-midi";
    return "Bonsoir";
  }, []);

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
              {applications.length > 0
                ? `${stats.active} candidature${stats.active > 1 ? "s" : ""} active${stats.active > 1 ? "s" : ""} · ${stats.interviewsUpcoming} entretien${stats.interviewsUpcoming > 1 ? "s" : ""} à venir`
                : "Bienvenue dans votre espace privé. Vos données seront chiffrées sur cet appareil."}
            </p>
          </div>
          <Button size="md" disabled title="Disponible dans la prochaine itération">
            <Plus className="h-4 w-4" aria-hidden />
            Une opportunité, une action
          </Button>
        </div>

        {applications.length === 0 ? (
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
                </ul>
              </Card>

              {/* À venir */}
              <Card>
                <CardTitle>À venir</CardTitle>
                <CardDescription>Vos prochains événements</CardDescription>
                <ul className="mt-4 space-y-3">
                  {DEMO_UPCOMING.map((evt) => (
                    <li
                      key={evt.id}
                      className="flex items-center gap-3 rounded-2xl border border-subtle bg-background/40 p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-card-elevated">
                        <span className="text-[10px] uppercase text-secondary">
                          {new Date(evt.date).toLocaleDateString("fr-FR", { month: "short" })}
                        </span>
                        <span className="font-serif text-lg font-semibold leading-none text-rose">
                          {new Date(evt.date).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-primary">{evt.title}</p>
                        <p className="text-xs text-secondary">
                          {evt.kind} · {formatDateFr(evt.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
