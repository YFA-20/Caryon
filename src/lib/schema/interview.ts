import { z } from "zod";

/**
 * Velora — schéma de données : InterviewPrep (préparation d'entretien).
 *
 * Fiche de préparation liée à une candidature : contexte entreprise,
 * checklist, questions anticipées et réponses préparées, auto-évaluation.
 */

export const interviewQuestionSchema = z.object({
  id: z.string().uuid(),
  /** Question anticipée. */
  question: z.string().min(1).max(1000),
  /** Réponse préparée (brouillon). */
  answer: z.string().max(10000).default(""),
  /** Catégorie de la question. */
  category: z
    .enum(["comportementale", "technique", "motivation", "entreprise", "situation", "autre"])
    .default("autre"),
  /** Question résolue/prête ? */
  prepared: z.boolean().default(false),
});

export const interviewChecklistItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(200),
  done: z.boolean().default(false),
});

export const interviewPrepSchema = z.object({
  id: z.string().uuid(),
  /** Candidature associée (obligatoire). */
  applicationId: z.string().uuid(),
  /** Date de l'entretien (si connue). */
  interviewDate: z.string().datetime().optional().or(z.literal("")),
  /** Format de l'entretien. */
  format: z.enum(["presentiel", "visio", "telephonique", "non_precis"]).default("non_precis"),
  /** Contexte entreprise (recherches, actualités). */
  companyResearch: z.string().max(20000).default(""),
  /** Points forts à mettre en avant. */
  strengths: z.string().max(10000).default(""),
  /** Points à améliorer / faiblesses anticipées. */
  weaknesses: z.string().max(10000).default(""),
  /** Questions anticipées avec réponses préparées. */
  questions: z.array(interviewQuestionSchema).max(100).default([]),
  /** Checklist de préparation. */
  checklist: z.array(interviewChecklistItemSchema).max(100).default([]),
  /** Auto-évaluation post-entretien (0-5). */
  selfRating: z.number().int().min(0).max(5).optional().or(z.literal(0)),
  /** Notes post-entretien. */
  postNotes: z.string().max(20000).default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type InterviewPrep = z.infer<typeof interviewPrepSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewChecklistItem = z.infer<typeof interviewChecklistItemSchema>;
export type InterviewFormat = InterviewPrep["format"];

export const INTERVIEW_FORMAT_LABELS: Record<InterviewFormat, string> = {
  presentiel: "Présentiel",
  visio: " visioconférence",
  telephonique: "Téléphonique",
  non_precis: "Non précisé",
};

export const INTERVIEW_QUESTION_CATEGORY_LABELS: Record<InterviewQuestion["category"], string> = {
  comportementale: "Comportementale",
  technique: "Technique",
  motivation: "Motivation",
  entreprise: "L'entreprise",
  situation: "Mise en situation",
  autre: "Autre",
};

/** Checklist par défaut proposée à la création d'une fiche. */
export const DEFAULT_INTERVIEW_CHECKLIST: string[] = [
  "Relire l'offre et le poste visé",
  "Préparer une présentation de 2 minutes",
  "Préparer 3 questions à poser au recruteur",
  "Vérifier le lieu / le lien de visio / le numéro",
  "Préparer des exemples concrets (méthode STAR)",
  "Relire son CV et ses lettres envoyées",
  "Prévoir une tenue adaptée",
  "Dormir suffisamment la veille",
];
