/**
 * Velora — service de relances intelligentes (calcul local, 100% offline).
 *
 * Identifie les candidatures envoyées sans réponse depuis trop longtemps
 * et suggère une relance. Aucun envoi automatique : l'utilisateur décide.
 */
import type { Application, ApplicationStatus } from "@/lib/schema/application";

/** Statuts considérés comme « en attente de réponse » (candidature partie, pas de retour). */
const PENDING_STATUSES: ApplicationStatus[] = ["envoyee", "en_attente"];

export interface FollowUpSuggestion {
  application: Application;
  /** Jours écoulés depuis l'envoi (appliedAt) ou la dernière mise à jour. */
  daysSince: number;
  /** Seuil de jours recommandé pour ce type de contrat. */
  thresholdDays: number;
  /** Priorité suggérée pour la relance. */
  suggestedPriority: "haute" | "normale" | "basse";
}

/** Seuils de relance par type de contrat (en jours). */
const THRESHOLDS_BY_TYPE: Record<Application["type"], number> = {
  stage: 10,
  alternance: 10,
  cdi: 14,
  cdd: 10,
  freelance: 7,
};

/**
 * Calcule les jours écoulés entre deux dates ISO (arrondi, jamais négatif).
 */
export function daysSince(iso: string, now: Date = new Date()): number {
  const ms = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Retourne les candidatures qui méritent une relance, triées par ancienneté
 * décroissante (les plus anciennes d'abord).
 *
 * Une candidature mérite une relance si :
 * - son statut est « envoyée » ou « en attente »
 * - elle a une date d'envoi (`appliedAt`)
 * - le délai écoulé dépasse le seuil du type de contrat
 */
export function getApplicationsNeedingFollowUp(
  applications: Application[],
  now: Date = new Date()
): FollowUpSuggestion[] {
  const suggestions: FollowUpSuggestion[] = [];

  for (const app of applications) {
    if (!PENDING_STATUSES.includes(app.status)) continue;
    if (!app.appliedAt) continue;

    const thresholdDays = THRESHOLDS_BY_TYPE[app.type];
    const since = daysSince(app.appliedAt, now);
    if (since < thresholdDays) continue;

    // Priorité suggérée : haute si très en retard (> 2x le seuil), basse si priorité basse
    const overdue = since - thresholdDays;
    let suggestedPriority: FollowUpSuggestion["suggestedPriority"] = "normale";
    if (overdue >= thresholdDays || app.priority === "haute") {
      suggestedPriority = "haute";
    } else if (app.priority === "basse") {
      suggestedPriority = "basse";
    }

    suggestions.push({
      application: app,
      daysSince: since,
      thresholdDays,
      suggestedPriority,
    });
  }

  return suggestions.sort((a, b) => b.daysSince - a.daysSince);
}

/**
 * Compte les candidatures en attente de réponse (envoyées, pas encore de retour).
 */
export function countPendingApplications(applications: Application[]): number {
  return applications.filter((a) => PENDING_STATUSES.includes(a.status)).length;
}
