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
  /** L'onboarding de première utilisation a-t-il été suivi ? */
  onboardingCompleted: z.boolean().default(false),
  /** Mode démonstration activé (données fictives chiffrées, clairement identifiées) */
  demoMode: z.boolean().default(false),
  /** Consentement explicite pour les fonctionnalités IA (opt-in, OFF par défaut) */
  aiConsent: z.boolean().default(false),
  /** Fournisseur IA préféré : "local" (WebLLM dans le navigateur) ou "cloud" (API externe) */
  aiProvider: z.enum(["local", "cloud"]).default("local"),
  /** Clé API cloud (optionnelle, stockée chiffrée, jamais transmise en clair) */
  aiApiKey: z.string().max(500).default(""),
  /** Nom du modèle cloud préféré (ex: "gpt-4o-mini", "claude-3-haiku") */
  aiModel: z.string().max(100).default(""),
  /** Synchronisation multi-appareils activée (opt-in, OFF par défaut) */
  syncEnabled: z.boolean().default(false),
  /** URL du serveur de synchronisation (Cloudflare Worker) */
  syncEndpoint: z.string().max(200).default(""),
  updatedAt: z.string().datetime(),
});

export type VaultSettings = z.infer<typeof vaultSettingsSchema>;
