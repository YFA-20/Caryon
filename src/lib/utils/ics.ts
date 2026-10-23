/**
 * Velora — export ICS (iCalendar) pour les événements.
 * Format standard RFC 5545, compatible Google Calendar, Apple Calendar, Outlook.
 */
import type { CalendarEvent } from "@/lib/schema/calendar";

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsDate(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  }
  return (
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}` +
    `T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`
  );
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/**
 * Génère un fichier ICS à partir d'une liste d'événements.
 */
export function generateIcs(events: CalendarEvent[], calendarName = "Velora"): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Velora//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Paris",
  ];

  for (const event of events) {
    const dtStart = formatIcsDate(event.startAt, event.allDay);
    const dtEnd = event.endAt
      ? formatIcsDate(event.endAt, event.allDay)
      : formatIcsDate(addHours(event.startAt, event.allDay ? 24 : 1), event.allDay);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@velora`);
    lines.push(`DTSTAMP:${formatIcsDate(new Date().toISOString(), false)}`);
    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }
    lines.push(`SUMMARY:${escapeIcs(event.title)}`);
    if (event.notes) {
      lines.push(`DESCRIPTION:${escapeIcs(event.notes)}`);
    }
    lines.push(`CATEGORIES:${escapeIcs(event.type)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  // CRLF requis par RFC 5545
  return lines.join("\r\n") + "\r\n";
}

/**
 * Déclenche le téléchargement d'un fichier ICS.
 */
export function downloadIcs(events: CalendarEvent[], filename = "velora-calendrier.ics"): void {
  const ics = generateIcs(events);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
