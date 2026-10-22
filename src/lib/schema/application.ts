import { z } from "zod";

/**
 * Velora — schéma de données : Application (candidature).
 * Contrat de persistance validé par Zod à chaque frontière de confiance.
 */

export const applicationTypeSchema = z.enum(["stage", "alternance", "cdi", "cdd", "freelance"]);

export const applicationStatusSchema = z.enum([
  "brouillon",
  "a_envoyer",
  "envoyee",
  "en_attente",
  "entretien",
  "offre_recue",
  "acceptee",
  "refusee",
  "abandonnee",
]);

export const applicationPrioritySchema = z.enum(["basse", "normale", "haute"]);

export const applicationSchema = z.object({
  id: z.string().uuid(),
  company: z.string().min(1).max(200),
  position: z.string().min(1).max(300),
  type: applicationTypeSchema,
  offerUrl: z.string().url().max(2000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  remote: z.boolean().default(false),
  salary: z.string().max(100).optional().or(z.literal("")),
  appliedAt: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  source: z.string().max(100).optional().or(z.literal("")),
  contactName: z.string().max(200).optional().or(z.literal("")),
  contactEmail: z.string().email().max(300).optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  status: applicationStatusSchema.default("brouillon"),
  priority: applicationPrioritySchema.default("normale"),
  notes: z.string().max(20000).default(""),
  tags: z.array(z.string().min(1).max(50)).max(50).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Application = z.infer<typeof applicationSchema>;
export type ApplicationType = z.infer<typeof applicationTypeSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationPriority = z.infer<typeof applicationPrioritySchema>;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  brouillon: "Brouillon",
  a_envoyer: "À envoyer",
  envoyee: "Envoyée",
  en_attente: "En attente",
  entretien: "Entretien",
  offre_recue: "Offre reçue",
  acceptee: "Acceptée",
  refusee: "Refusée",
  abandonnee: "Abandonnée",
};

export const APPLICATION_TYPE_LABELS: Record<ApplicationType, string> = {
  stage: "Stage",
  alternance: "Alternance",
  cdi: "CDI",
  cdd: "CDD",
  freelance: "Freelance",
};
