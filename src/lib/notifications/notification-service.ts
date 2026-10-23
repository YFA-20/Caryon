/**
 * Velora — service de notifications locales (navigateur).
 *
 * Utilise l'API Notification du navigateur. Aucune donnée n'est transmise :
 * les notifications sont générées localement à partir des événements chiffrés
 * déchiffrés en mémoire.
 *
 * Comportement dégradé : si l'API n'est pas disponible ou si la permission est
 * refusée, `checkAndNotify` retourne simplement le nombre d'événements sans
 * envoyer de notification.
 */
import { listEvents, updateEvent } from "@/lib/vault/calendar-repository";
import { CALENDAR_EVENT_TYPE_LABELS, type CalendarEvent } from "@/lib/schema/calendar";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result as NotificationPermissionState;
}

function formatEventTime(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) {
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Envoie une notification locale pour un événement.
 * Ne fait rien si la permission n'est pas accordée.
 */
export function sendLocalNotification(event: CalendarEvent): boolean {
  if (getNotificationPermission() !== "granted") return false;
  try {
    const typeLabel = CALENDAR_EVENT_TYPE_LABELS[event.type];
    const when = formatEventTime(event.startAt, event.allDay);
    new Notification(`${typeLabel} — ${event.title}`, {
      body: when,
      icon: "/icons/icon-192.png",
      tag: `velora-${event.id}`,
    });
    return true;
  } catch {
    return false;
  }
}

export interface NotificationCheckResult {
  /** Événements pour lesquels une notification a été envoyée. */
  notified: number;
  /** Événements à venir ignorés (permission refusée/indisponible). */
  skipped: number;
  /** Permission actuelle. */
  permission: NotificationPermissionState;
}

/**
 * Vérifie les événements à venir (dans les prochaines `withinMinutes` minutes)
 * et envoie une notification locale pour chacun, une seule fois (marquage
 * `notified` dans le dépôt chiffré).
 *
 * À appeler périodiquement (ex: toutes les minutes) depuis un composant client.
 */
export async function checkAndNotify(withinMinutes = 60): Promise<NotificationCheckResult> {
  const permission = getNotificationPermission();
  if (permission !== "granted") {
    return { notified: 0, skipped: 0, permission };
  }

  const now = Date.now();
  const horizon = now + withinMinutes * 60 * 1000;
  const events = await listEvents();

  let notified = 0;
  let skipped = 0;

  for (const event of events) {
    if (event.notified) continue;
    const startMs = new Date(event.startAt).getTime();
    // Notifie si l'événement est dans la fenêtre [maintenant, horizon]
    // ou s'il a commencé il y a moins de 5 minutes (rattrapage au réveil)
    const inWindow = startMs <= horizon && startMs >= now - 5 * 60 * 1000;
    if (!inWindow) continue;

    const sent = sendLocalNotification(event);
    if (sent) {
      try {
        await updateEvent(event.id, { notified: true });
        notified++;
      } catch {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  return { notified, skipped, permission };
}

/**
 * Envoie une notification de test (pour vérifier que tout fonctionne).
 */
export function sendTestNotification(): boolean {
  if (getNotificationPermission() !== "granted") return false;
  try {
    new Notification("Velora — notifications activées", {
      body: "Vous recevrez des rappels locaux pour vos entretiens, relances et échéances.",
      icon: "/icons/icon-192.png",
      tag: "velora-test",
    });
    return true;
  } catch {
    return false;
  }
}
