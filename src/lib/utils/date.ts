/**
 * Formate une date ISO en libellé français lisible.
 */
export function formatDateFr(iso: string, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = withTime
    ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "long", year: "numeric" };
  return date.toLocaleDateString("fr-FR", options);
}

/**
 * Retourne la date du jour au format ISO (début de journée, heure locale).
 */
export function todayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}
