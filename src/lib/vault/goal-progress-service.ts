/**
 * Velora — service de suivi de progression des objectifs.
 *
 * Calcule la progression réelle d'un objectif à partir des candidatures
 * chiffrées (déchiffrées en mémoire). 100% local, aucune donnée transmise.
 */
import type { Application, ApplicationStatus } from "@/lib/schema/application";
import type { Goal, GoalMetric } from "@/lib/schema/goal";

export interface GoalProgress {
  goal: Goal;
  /** Valeur actuelle (nombre d'unités atteintes sur la période). */
  current: number;
  /** Cible à atteindre. */
  target: number;
  /** Progression en pourcentage (0-100, plafonné à 100). */
  percent: number;
  /** Objectif atteint ? */
  completed: boolean;
  /** Jours restants dans la période (0 si hors période ou pas de fin). */
  daysRemaining: number | null;
}

/** Statuts comptant comme « candidature envoyée ». */
const SENT_STATUSES: ApplicationStatus[] = [
  "envoyee",
  "en_attente",
  "entretien",
  "offre_recue",
  "acceptee",
  "refusee",
];

/** Statuts comptant comme « réponse reçue ». */
const RESPONDED_STATUSES: ApplicationStatus[] = ["entretien", "offre_recue", "acceptee", "refusee"];

/** Statuts comptant comme « entretien obtenu ». */
const INTERVIEW_STATUSES: ApplicationStatus[] = ["entretien", "offre_recue", "acceptee"];

/**
 * Calcule la valeur actuelle d'une métrique sur la période de l'objectif.
 */
export function computeMetricValue(
  metric: GoalMetric,
  applications: Application[],
  periodStart: Date,
  periodEnd: Date
): number {
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();

  return applications.filter((app) => {
    // La date de référence dépend de la métrique
    let refIso: string;
    switch (metric) {
      case "applications_created":
        refIso = app.createdAt;
        break;
      case "applications_sent":
      case "interviews":
      case "responses":
        // On utilise updatedAt comme proxy de l'avancement dans le pipeline
        refIso = app.updatedAt;
        break;
      default:
        refIso = app.createdAt;
    }
    const refMs = new Date(refIso).getTime();
    if (refMs < startMs || refMs > endMs) return false;

    switch (metric) {
      case "applications_created":
        return true; // dans la période = créée dans la période
      case "applications_sent":
        return SENT_STATUSES.includes(app.status);
      case "interviews":
        return INTERVIEW_STATUSES.includes(app.status);
      case "responses":
        return RESPONDED_STATUSES.includes(app.status);
      default:
        return false;
    }
  }).length;
}

/**
 * Calcule la plage de dates de la période d'un objectif.
 * - week : lundi → dimanche de la semaine en cours
 * - month : 1er → dernier jour du mois en cours
 * - quarter : trimestre civil en cours
 * - custom : startAt → endAt de l'objectif
 */
export function getGoalPeriodRange(goal: Goal, now: Date = new Date()): { start: Date; end: Date } {
  if (goal.period === "custom") {
    return {
      start: new Date(goal.startAt),
      end: goal.endAt ? new Date(goal.endAt) : new Date(goal.startAt),
    };
  }

  const y = now.getFullYear();
  const m = now.getMonth();

  if (goal.period === "week") {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  if (goal.period === "month") {
    return {
      start: new Date(y, m, 1, 0, 0, 0, 0),
      end: new Date(y, m + 1, 0, 23, 59, 59, 999),
    };
  }

  // quarter
  const quarterStartMonth = Math.floor(m / 3) * 3;
  return {
    start: new Date(y, quarterStartMonth, 1, 0, 0, 0, 0),
    end: new Date(y, quarterStartMonth + 3, 0, 23, 59, 59, 999),
  };
}

/**
 * Calcule la progression d'un objectif à partir des candidatures réelles.
 */
export function computeGoalProgress(
  goal: Goal,
  applications: Application[],
  now: Date = new Date()
): GoalProgress {
  const { start, end } = getGoalPeriodRange(goal, now);
  const current = computeMetricValue(goal.metric, applications, start, end);
  const percent = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
  const completed = current >= goal.target;

  const endMs = end.getTime();
  const nowMs = now.getTime();
  const daysRemaining =
    endMs >= nowMs ? Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24))) : null;

  return {
    goal,
    current,
    target: goal.target,
    percent,
    completed,
    daysRemaining,
  };
}

/**
 * Calcule la progression de tous les objectifs.
 */
export function computeAllGoalProgress(
  goals: Goal[],
  applications: Application[],
  now: Date = new Date()
): GoalProgress[] {
  return goals.map((g) => computeGoalProgress(g, applications, now));
}
