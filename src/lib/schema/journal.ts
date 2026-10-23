import { z } from "zod";

/**
 * Velora — schéma de données : JournalEntry (journal de recherche).
 *
 * Entrées libres datées : réflexions, apprentissages, bilans, humeur.
 * Contenu 100% chiffré au repos.
 */

export const journalMoodSchema = z.enum([
  "tres_bien",
  "bien",
  "neutre",
  "fatigue",
  "stress",
  "motive",
]);

export const journalEntrySchema = z.object({
  id: z.string().uuid(),
  /** Date de l'entrée (ISO 8601, date du jour de rédaction). */
  date: z.string().datetime(),
  title: z.string().min(1).max(200),
  /** Contenu libre (markdown léger accepté, stocké tel quel). */
  content: z.string().max(50000).default(""),
  /** Humeur du jour (optionnel). */
  mood: journalMoodSchema.optional().or(z.literal("")),
  /** Tags libres pour retrouver l'entrée. */
  tags: z.array(z.string().min(1).max(50)).max(50).default([]),
  /** ID de candidature associée (optionnel). */
  applicationId: z.string().uuid().optional().or(z.literal("")),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type JournalMood = z.infer<typeof journalMoodSchema>;

export const JOURNAL_MOOD_LABELS: Record<JournalMood, string> = {
  tres_bien: "Très bien",
  bien: "Bien",
  neutre: "Neutre",
  fatigue: "Fatigué",
  stress: "Stressé",
  motive: "Motivé",
};
