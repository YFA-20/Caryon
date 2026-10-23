import { z } from "zod";

/**
 * Velora — schéma de données : Goal (objectif personnel de recherche).
 *
 * Un objectif est quantifié (ex: « 10 candidatures par semaine ») et suivi
 * automatiquement à partir des vraies candidatures chiffrées.
 */

export const goalMetricSchema = z.enum([
  "applications_sent", // candidatures envoyées
  "applications_created", // candidatures créées
  "interviews", // entretiens obtenus
  "responses", // réponses reçues
]);

export const goalPeriodSchema = z.enum(["week", "month", "quarter", "custom"]);

export const goalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  /** Métrique suivie. */
  metric: goalMetricSchema,
  /** Cible à atteindre. */
  target: z.number().int().positive().max(10000),
  /** Période de l'objectif. */
  period: goalPeriodSchema.default("month"),
  /** Date de début (ISO 8601). */
  startAt: z.string().datetime(),
  /** Date de fin (ISO 8601, optionnel pour période custom). */
  endAt: z.string().datetime().optional().or(z.literal("")),
  /** Objectif atteint ? (calculé, mis à jour à la lecture). */
  completed: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Goal = z.infer<typeof goalSchema>;
export type GoalMetric = z.infer<typeof goalMetricSchema>;
export type GoalPeriod = z.infer<typeof goalPeriodSchema>;

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  applications_sent: "Candidatures envoyées",
  applications_created: "Candidatures créées",
  interviews: "Entretiens obtenus",
  responses: "Réponses reçues",
};

export const GOAL_PERIOD_LABELS: Record<GoalPeriod, string> = {
  week: "Par semaine",
  month: "Par mois",
  quarter: "Par trimestre",
  custom: "Période personnalisée",
};

/**
 * Velora — schéma : VaultSettings (préférences utilisateur).
 * Stocké chiffré. Ne contient aucune donnée sensible (pas de phrase, pas de clé).
 */
export const vaultSettingsSchema = z.object({
  id: z.literal("default"),
  /** Prénom affiché dans le dashboard (non sensible). */
  firstName: z.string().max(50).default(""),
  /** Verrouillage automatique après inactivité (ms). 0 = désactivé. */
  autoLockMs: z
    .number()
    .int()
    .nonnegative()
    .default(15 * 60 * 1000),
  /** Mode sombre forcé (l'app est dark-only pour l'instant, réservé). */
  theme: z.enum(["dark"]).default("dark"),
  /** Notifications locales activées (préférence UI, la permission navigateur prime). */
  notificationsEnabled: z.boolean().default(true),
  updatedAt: z.string().datetime(),
});

export type VaultSettings = z.infer<typeof vaultSettingsSchema>;
