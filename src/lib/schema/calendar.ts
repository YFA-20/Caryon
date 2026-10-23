import { z } from "zod";

/**
 * Velora — schéma de données : CalendarEvent (entretiens, relances, échéances).
 */

export const calendarEventTypeSchema = z.enum([
  "entretien",
  "relance",
  "echeance",
  "preparation",
  "personnel",
]);

export const calendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  type: calendarEventTypeSchema.default("personnel"),
  /** Date/heure de début (ISO 8601). */
  startAt: z.string().datetime(),
  /** Date/heure de fin (ISO 8601, optionnel). */
  endAt: z.string().datetime().optional().or(z.literal("")),
  /** Toute la journée ? */
  allDay: z.boolean().default(false),
  /** ID de candidature associée (optionnel). */
  applicationId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(5000).default(""),
  /** Notification locale envoyée ? */
  notified: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEventType = z.infer<typeof calendarEventTypeSchema>;

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  entretien: "Entretien",
  relance: "Relance",
  echeance: "Échéance",
  preparation: "Préparation",
  personnel: "Personnel",
};
