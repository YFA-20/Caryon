/**
 * Velora — service de statistiques (calculées localement, 100% offline).
 *
 * Toutes les statistiques sont calculées à partir des données déchiffrées
 * en mémoire. Aucune donnée n'est transmise.
 */
import type { Application, ApplicationStatus } from "@/lib/schema/application";
import type { CalendarEvent } from "@/lib/schema/calendar";

export interface StatsOverview {
  total: number;
  active: number;
  byStatus: Record<ApplicationStatus, number>;
  responseRate: number;
  interviewRate: number;
  avgResponseDays: number | null;
  bySource: Record<string, number>;
  byType: Record<string, number>;
  applicationsPerWeek: { week: string; count: number }[];
  upcomingInterviews: number;
  upcomingDeadlines: number;
  remindersDue: number;
}

const ACTIVE_STATUSES: ApplicationStatus[] = ["envoyee", "en_attente", "entretien", "offre_recue"];
const RESPONDED_STATUSES: ApplicationStatus[] = ["entretien", "offre_recue", "acceptee", "refusee"];
const INTERVIEW_STATUSES: ApplicationStatus[] = ["entretien", "offre_recue", "acceptee"];

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function getWeekKey(iso: string): string {
  const d = new Date(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function computeStats(applications: Application[], events: CalendarEvent[]): StatsOverview {
  const total = applications.length;

  // Par statut
  const byStatus = {} as Record<ApplicationStatus, number>;
  for (const app of applications) {
    byStatus[app.status] = (byStatus[app.status] ?? 0) + 1;
  }

  // Actives
  const active = applications.filter((a) => ACTIVE_STATUSES.includes(a.status)).length;

  // Taux de réponse : candidatures avec une réponse (entretien+) / envoyées
  const sent = applications.filter((a) =>
    ["envoyee", ...RESPONDED_STATUSES].includes(a.status)
  ).length;
  const responded = applications.filter((a) => RESPONDED_STATUSES.includes(a.status)).length;
  const responseRate = sent > 0 ? Math.round((responded / sent) * 100) : 0;

  // Taux d'entretien : entretiens+ / envoyées
  const interviewed = applications.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
  const interviewRate = sent > 0 ? Math.round((interviewed / sent) * 100) : 0;

  // Temps moyen avant réponse (jours)
  const responseTimes: number[] = [];
  for (const app of applications) {
    if (RESPONDED_STATUSES.includes(app.status) && app.appliedAt) {
      responseTimes.push(daysBetween(app.appliedAt, app.updatedAt));
    }
  }
  const avgResponseDays =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  // Par source
  const bySource: Record<string, number> = {};
  for (const app of applications) {
    const src = app.source || "Non renseigné";
    bySource[src] = (bySource[src] ?? 0) + 1;
  }

  // Par type
  const byType: Record<string, number> = {};
  for (const app of applications) {
    byType[app.type] = (byType[app.type] ?? 0) + 1;
  }

  // Candidatures par semaine (8 dernières semaines)
  const weekCounts: Record<string, number> = {};
  for (const app of applications) {
    const key = getWeekKey(app.createdAt);
    weekCounts[key] = (weekCounts[key] ?? 0) + 1;
  }
  const applicationsPerWeek = Object.entries(weekCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, count]) => ({ week, count }));

  // Événements à venir
  const now = new Date().toISOString();
  const upcomingInterviews = events.filter(
    (e) => e.type === "entretien" && e.startAt >= now
  ).length;
  const upcomingDeadlines = events.filter((e) => e.type === "echeance" && e.startAt >= now).length;
  const remindersDue = events.filter((e) => e.type === "relance" && e.startAt >= now).length;

  return {
    total,
    active,
    byStatus,
    responseRate,
    interviewRate,
    avgResponseDays,
    bySource,
    byType,
    applicationsPerWeek,
    upcomingInterviews,
    upcomingDeadlines,
    remindersDue,
  };
}
