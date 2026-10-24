"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
  Flag,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  type Application,
  type ApplicationStatus,
} from "@/lib/schema/application";
import type { CalendarEvent } from "@/lib/schema/calendar";
import type { Document } from "@/lib/schema/document";
import type { JournalEntry } from "@/lib/schema/journal";
import { listEvents } from "@/lib/vault/calendar-repository";
import { listDocuments } from "@/lib/vault/document-repository";
import { listJournalEntries } from "@/lib/vault/journal-repository";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimelineItemType = "created" | "status_change" | "updated" | "event" | "document" | "journal";

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  date: string; // ISO 8601
  title: string;
  description?: string;
  status?: ApplicationStatus;
  eventType?: CalendarEvent["type"];
  documentType?: Document["type"];
  mood?: JournalEntry["mood"];
}

interface ApplicationTimelineProps {
  application: Application;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  brouillon: "bg-secondary/15 text-secondary border-secondary/25",
  a_envoyer: "bg-lavender/15 text-lavender border-lavender/25",
  envoyee: "bg-primary/10 text-primary border-primary/20",
  en_attente: "bg-warning/15 text-warning border-warning/25",
  entretien: "bg-success/15 text-success border-success/25",
  offre_recue: "bg-success/15 text-success border-success/25",
  acceptee: "bg-success/15 text-success border-success/25",
  refusee: "bg-danger/15 text-danger border-danger/25",
  abandonnee: "bg-secondary/15 text-secondary border-secondary/25",
};

const EVENT_TYPE_LABELS: Record<CalendarEvent["type"], string> = {
  entretien: "Entretien",
  relance: "Relance",
  echeance: "Échéance",
  preparation: "Préparation",
  personnel: "Personnel",
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function itemIcon(type: TimelineItemType) {
  switch (type) {
    case "created":
      return Plus;
    case "status_change":
      return Flag;
    case "updated":
      return Pencil;
    case "event":
      return CalendarDays;
    case "document":
      return FileText;
    case "journal":
      return CircleDot;
    default:
      return Clock;
  }
}

function itemColor(type: TimelineItemType): string {
  switch (type) {
    case "created":
      return "bg-lavender/15 text-lavender border-lavender/25";
    case "status_change":
      return "bg-primary/10 text-primary border-primary/20";
    case "updated":
      return "bg-secondary/15 text-secondary border-secondary/25";
    case "event":
      return "bg-warning/15 text-warning border-warning/25";
    case "document":
      return "bg-success/15 text-success border-success/25";
    case "journal":
      return "bg-rose/15 text-rose border-rose/25";
    default:
      return "bg-card-elevated text-secondary border-subtle";
  }
}

/** Construit la liste des items de chronologie pour une candidature. */
export function buildTimeline(
  application: Application,
  events: CalendarEvent[],
  documents: Document[],
  journalEntries: JournalEntry[]
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Création
  items.push({
    id: `${application.id}-created`,
    type: "created",
    date: application.createdAt,
    title: "Candidature créée",
    description: `${application.position} chez ${application.company}`,
  });

  // Candidature envoyée (si appliedAt existe)
  if (appliedAtIso(application)) {
    items.push({
      id: `${application.id}-applied`,
      type: "status_change",
      date: appliedAtIso(application) as string,
      title: "Candidature envoyée",
      status: "envoyee",
    });
  }

  // Statut actuel (si différent de brouillon)
  if (application.status !== "brouillon") {
    items.push({
      id: `${application.id}-status`,
      type: "status_change",
      date: application.updatedAt,
      title: `Statut : ${APPLICATION_STATUS_LABELS[application.status]}`,
      status: application.status,
    });
  }

  // Dernière modification (si différente de la création)
  if (application.updatedAt !== application.createdAt) {
    items.push({
      id: `${application.id}-updated`,
      type: "updated",
      date: application.updatedAt,
      title: "Dernière modification",
    });
  }

  // Événements liés
  for (const ev of events) {
    if (ev.applicationId === application.id) {
      items.push({
        id: ev.id,
        type: "event",
        date: ev.startAt,
        title: ev.title,
        description: ev.notes || undefined,
        eventType: ev.type,
      });
    }
  }

  // Documents liés
  for (const doc of documents) {
    if (doc.applicationId === application.id) {
      items.push({
        id: doc.id,
        type: "document",
        date: doc.createdAt,
        title: `Document ajouté : ${doc.name}`,
        documentType: doc.type,
      });
    }
  }

  // Entrées de journal liées
  for (const entry of journalEntries) {
    if (entry.applicationId === application.id) {
      items.push({
        id: entry.id,
        type: "journal",
        date: entry.date,
        title: `Journal : ${entry.title}`,
        description: entry.content.slice(0, 150) + (entry.content.length > 150 ? "…" : ""),
        mood: entry.mood || undefined,
      });
    }
  }

  // Tri chronologique (plus récent en premier)
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

function appliedAtIso(app: Application): string | null {
  return app.appliedAt && app.appliedAt !== "" ? app.appliedAt : null;
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function ApplicationTimeline({ application, onClose }: ApplicationTimelineProps) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [events, documents, journalEntries] = await Promise.all([
          listEvents(),
          listDocuments(),
          listJournalEntries(),
        ]);
        setItems(buildTimeline(application, events, documents, journalEntries));
      } catch (err) {
        console.error("[timeline] Erreur chargement:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [application]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-primary">
            Chronologie — {application.company}
          </h2>
          <p className="mt-1 text-sm text-secondary">{application.position}</p>
          {application.status && (
            <Badge className={cn("mt-2", STATUS_COLORS[application.status])}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" aria-hidden />
          Fermer
        </Button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-secondary">
            Aucun événement dans la chronologie.
          </p>
        ) : (
          <ol className="relative space-y-6 border-l border-subtle pl-6">
            {items.map((item) => {
              const Icon = itemIcon(item.type);
              return (
                <li key={item.id} className="relative">
                  {/* Pastille sur la ligne */}
                  <span
                    className={cn(
                      "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border",
                      itemColor(item.type)
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                  </span>

                  <div className="rounded-xl border border-subtle bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-secondary">{formatDateTime(item.date)}</span>
                      {item.status && (
                        <Badge className={STATUS_COLORS[item.status]}>
                          {APPLICATION_STATUS_LABELS[item.status]}
                        </Badge>
                      )}
                      {item.eventType && (
                        <Badge variant="lavender">{EVENT_TYPE_LABELS[item.eventType]}</Badge>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-primary">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-sm text-secondary">{item.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Résumé en bas */}
      {!loading && items.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-4 border-t border-subtle pt-4 text-xs text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-lavender" aria-hidden />
            Créée le {formatDate(application.createdAt)}
          </span>
          {appliedAtIso(application) && (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
              Envoyée le {formatDate(appliedAtIso(application) as string)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-secondary" aria-hidden />
            Modifiée le {formatDate(application.updatedAt)}
          </span>
        </div>
      )}
    </Card>
  );
}
