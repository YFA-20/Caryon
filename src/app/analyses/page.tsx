"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Loader2,
  MailCheck,
  Target,
  TrendingUp,
  Timer,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listApplications } from "@/lib/vault/application-repository";
import { listEvents } from "@/lib/vault/calendar-repository";
import { computeStats, type StatsOverview } from "@/lib/vault/stats-service";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  type ApplicationStatus,
} from "@/lib/schema/application";
import { cn } from "@/lib/utils/cn";

const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  "rose" | "lavender" | "warning" | "success" | "danger" | "default"
> = {
  brouillon: "default",
  a_envoyer: "lavender",
  envoyee: "default",
  en_attente: "warning",
  entretien: "success",
  offre_recue: "success",
  acceptee: "success",
  refusee: "danger",
  abandonnee: "default",
};

function formatWeekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "rose",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: "rose" | "lavender" | "success" | "warning";
}) {
  const accentClass = {
    rose: "text-rose",
    lavender: "text-lavender",
    success: "text-success",
    warning: "text-warning",
  }[accent];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-secondary">{label}</p>
          <p className="mt-1 font-serif text-3xl font-bold text-primary">{value}</p>
          {hint && <p className="mt-1 text-xs text-secondary">{hint}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
          <Icon className={cn("h-5 w-5", accentClass)} aria-hidden />
        </div>
      </div>
    </Card>
  );
}

function BarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-40 items-end gap-2" role="img" aria-label="Candidatures par semaine">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs text-secondary">{d.count}</span>
          <div
            className="transition-velora w-full rounded-t-lg bg-gradient-to-t from-[#432938] to-lavender/70"
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            title={`${d.label} : ${d.count} candidature(s)`}
          />
          <span className="text-[10px] text-secondary">{formatWeekLabel(d.label)}</span>
        </div>
      ))}
    </div>
  );
}

function DistributionList({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: [string, number][];
}) {
  const total = data.reduce((s, [, c]) => s + c, 0);
  const max = Math.max(1, ...data.map(([, c]) => c));
  return (
    <Card>
      <CardTitle className="text-lg">{title}</CardTitle>
      <CardDescription className="mt-1">{description}</CardDescription>
      {total === 0 ? (
        <p className="mt-4 text-sm text-secondary">Aucune donnée.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {data.map(([label, count]) => (
            <li key={label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate text-primary">{label}</span>
                <span className="ml-2 shrink-0 text-secondary">
                  {count} ({Math.round((count / total) * 100)}%)
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-card-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose to-lavender"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function AnalysesPage() {
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [apps, events] = await Promise.all([listApplications(), listEvents()]);
      setStats(computeStats(apps, events));
    } catch (err) {
      console.error("[analyses] Erreur chargement:", err);
      setError("Impossible de calculer les statistiques.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusEntries = useMemo(() => {
    if (!stats) return [];
    return (Object.entries(stats.byStatus) as [ApplicationStatus, number][])
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const sourceEntries = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]);
  }, [stats]);

  const typeEntries = useMemo(() => {
    if (!stats) return [];
    return (Object.entries(stats.byType) as [keyof typeof APPLICATION_TYPE_LABELS, number][]).map(
      ([t, c]) => [APPLICATION_TYPE_LABELS[t] ?? t, c] as [string, number]
    );
  }, [stats]);

  const hasData = stats !== null && stats.total > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Analyses</h1>
          <p className="mt-2 text-secondary">
            Statistiques calculées localement sur votre appareil — aucune donnée n&apos;est
            transmise.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-lavender" aria-hidden />
            <span className="sr-only">Calcul des statistiques…</span>
          </div>
        ) : !hasData ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-elevated">
              <TrendingUp className="h-8 w-8 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Pas encore de données</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Créez des candidatures et des événements pour voir apparaître vos statistiques : taux
              de réponse, répartition par statut, sources les plus efficaces…
            </CardDescription>
          </Card>
        ) : (
          stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  icon={Briefcase}
                  label="Candidatures actives"
                  value={String(stats.active)}
                  hint={`sur ${stats.total} au total`}
                  accent="rose"
                />
                <StatCard
                  icon={MailCheck}
                  label="Taux de réponse"
                  value={`${stats.responseRate}%`}
                  hint="Réponses reçues / candidatures envoyées"
                  accent="lavender"
                />
                <StatCard
                  icon={Target}
                  label="Taux d'entretien"
                  value={`${stats.interviewRate}%`}
                  hint="Entretiens obtenus / candidatures envoyées"
                  accent="success"
                />
                <StatCard
                  icon={Timer}
                  label="Délai moyen de réponse"
                  value={stats.avgResponseDays !== null ? `${stats.avgResponseDays} j` : "—"}
                  hint={
                    stats.avgResponseDays !== null
                      ? "Entre l'envoi et la première réponse"
                      : "Aucune réponse reçue pour l'instant"
                  }
                  accent="warning"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  icon={CalendarClock}
                  label="Entretiens à venir"
                  value={String(stats.upcomingInterviews)}
                  accent="success"
                />
                <StatCard
                  icon={CalendarClock}
                  label="Échéances à venir"
                  value={String(stats.upcomingDeadlines)}
                  accent="rose"
                />
                <StatCard
                  icon={CalendarClock}
                  label="Relances prévues"
                  value={String(stats.remindersDue)}
                  accent="warning"
                />
              </div>

              <Card>
                <CardTitle className="text-lg">Candidatures par semaine</CardTitle>
                <CardDescription className="mt-1">
                  Nombre de candidatures créées, sur les 8 dernières semaines renseignées.
                </CardDescription>
                <div className="mt-6">
                  {stats.applicationsPerWeek.length > 0 ? (
                    <BarChart
                      data={stats.applicationsPerWeek.map((w) => ({
                        label: w.week,
                        count: w.count,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-secondary">Aucune donnée.</p>
                  )}
                </div>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardTitle className="text-lg">Répartition par statut</CardTitle>
                  <CardDescription className="mt-1">
                    Dénominateur : {stats.total} candidature(s).
                  </CardDescription>
                  {statusEntries.length === 0 ? (
                    <p className="mt-4 text-sm text-secondary">Aucune donnée.</p>
                  ) : (
                    <ul className="mt-4 space-y-2.5">
                      {statusEntries.map(([status, count]) => (
                        <li key={status} className="flex items-center justify-between gap-3">
                          <Badge variant={STATUS_BADGE_VARIANT[status]}>
                            {APPLICATION_STATUS_LABELS[status]}
                          </Badge>
                          <span className="text-sm text-secondary">
                            {count} ({Math.round((count / stats.total) * 100)}%)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <DistributionList
                  title="Par type de contrat"
                  description={`Dénominateur : ${stats.total} candidature(s).`}
                  data={typeEntries}
                />
              </div>

              <DistributionList
                title="Sources les plus représentées"
                description={`Dénominateur : ${stats.total} candidature(s). « Non renseigné » regroupe les candidatures sans source.`}
                data={sourceEntries}
              />

              <p className="text-xs text-secondary">
                Ces indicateurs sont calculés à partir de vos données locales. Sur de petits
                échantillons, les pourcentages sont peu significatifs — privilégiez les tendances
                sur plusieurs semaines.
              </p>
            </>
          )
        )}
      </div>
    </AppShell>
  );
}
