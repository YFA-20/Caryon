"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listEvents,
  createEvent,
  deleteEvent,
  listUpcomingEvents,
} from "@/lib/vault/calendar-repository";
import { downloadIcs } from "@/lib/utils/ics";
import {
  CALENDAR_EVENT_TYPE_LABELS,
  type CalendarEvent,
  type CalendarEventType,
} from "@/lib/schema/calendar";
import { cn } from "@/lib/utils/cn";

const TYPE_BADGE_VARIANT: Record<
  CalendarEventType,
  "rose" | "lavender" | "warning" | "success" | "default"
> = {
  entretien: "success",
  relance: "warning",
  echeance: "rose",
  preparation: "lavender",
  personnel: "default",
};

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) {
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MonthCell {
  date: Date;
  inMonth: boolean;
}

function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Lundi = 0
  const weeks: MonthCell[][] = [];
  const cursor = new Date(year, month, 1 - startOffset);
  for (let w = 0; w < 6; w++) {
    const week: MonthCell[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({ date: new Date(cursor), inMonth: cursor.getMonth() === month });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    if (cursor.getMonth() !== month && w >= 4) break;
  }
  return weeks;
}

export default function CalendrierPage() {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    type: "personnel" as CalendarEventType,
    startAt: "",
    endAt: "",
    allDay: false,
    notes: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [all, next] = await Promise.all([listEvents(), listUpcomingEvents(5)]);
      setEvents(all);
      setUpcoming(next);
    } catch (err) {
      console.error("[calendrier] Erreur chargement:", err);
      setError("Impossible de charger le calendrier.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.startAt.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.startAt) {
      setError("Le titre et la date de début sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createEvent({
        title: form.title.trim(),
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : "",
        allDay: form.allDay,
        notes: form.notes.trim(),
      });
      setForm({ title: "", type: "personnel", startAt: "", endAt: "", allDay: false, notes: "" });
      setShowForm(false);
      await refresh();
    } catch (err) {
      console.error("[calendrier] Erreur création:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(null);
    try {
      await deleteEvent(id);
      await refresh();
    } catch (err) {
      console.error("[calendrier] Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    }
  }

  function handleExportIcs() {
    downloadIcs(events, `velora-calendrier-${new Date().toISOString().slice(0, 10)}.ics`);
  }

  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Calendrier</h1>
            <p className="mt-2 text-secondary">
              Entretiens, relances et échéances — stockés chiffrés, exportables au format ICS.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExportIcs} disabled={events.length === 0}>
              <Download className="h-4 w-4" aria-hidden />
              Export ICS
            </Button>
            <Button onClick={() => setShowForm((s) => !s)}>
              <Plus className="h-4 w-4" aria-hidden />
              Nouvel événement
            </Button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {showForm && (
          <Card>
            <form onSubmit={handleCreate} className="space-y-4">
              <CardTitle className="text-lg">Nouvel événement</CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Titre *</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender"
                    placeholder="Entretien téléphonique — Acme"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Type</span>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as CalendarEventType })
                    }
                    className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary focus-visible:ring-2 focus-visible:ring-lavender"
                  >
                    {(Object.keys(CALENDAR_EVENT_TYPE_LABELS) as CalendarEventType[]).map((t) => (
                      <option key={t} value={t}>
                        {CALENDAR_EVENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Début *</span>
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    required
                    value={form.allDay ? form.startAt.slice(0, 10) : toDatetimeLocal(form.startAt)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        startAt: form.allDay
                          ? new Date(e.target.value + "T00:00:00").toISOString()
                          : new Date(e.target.value).toISOString(),
                      })
                    }
                    className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary focus-visible:ring-2 focus-visible:ring-lavender"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Fin (optionnel)</span>
                  <input
                    type={form.allDay ? "date" : "datetime-local"}
                    value={
                      form.endAt
                        ? form.allDay
                          ? form.endAt.slice(0, 10)
                          : toDatetimeLocal(form.endAt)
                        : ""
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        endAt: e.target.value
                          ? form.allDay
                            ? new Date(e.target.value + "T23:59:59").toISOString()
                            : new Date(e.target.value).toISOString()
                          : "",
                      })
                    }
                    className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary focus-visible:ring-2 focus-visible:ring-lavender"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-secondary">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => setForm({ ...form, allDay: e.target.checked })}
                  className="accent-lavender"
                />
                Toute la journée
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Notes</span>
                <textarea
                  rows={2}
                  maxLength={5000}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender"
                  placeholder="Préparer le CV, le portfolio…"
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {saving ? "Enregistrement…" : "Créer l'événement"}
                </Button>
              </div>
            </form>
          </Card>
        )}
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card className="p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                aria-label="Mois précédent"
                className="transition-velora rounded-xl p-2 text-secondary hover:bg-card-elevated hover:text-primary"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <h2 className="font-serif text-xl font-semibold capitalize text-primary">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <button
                type="button"
                onClick={nextMonth}
                aria-label="Mois suivant"
                className="transition-velora rounded-xl p-2 text-secondary hover:bg-card-elevated hover:text-primary"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-xs font-medium uppercase tracking-wide text-secondary"
                >
                  {d}
                </div>
              ))}
              {grid.flat().map((cell, i) => {
                const key = `${cell.date.getFullYear()}-${pad(cell.date.getMonth() + 1)}-${pad(cell.date.getDate())}`;
                const dayEvents = eventsByDay.get(key) ?? [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-20 rounded-xl border border-transparent p-1.5",
                      cell.inMonth ? "bg-surface/40" : "opacity-40",
                      isToday && "border-lavender/40 bg-lavender/5"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-1 text-xs",
                        isToday ? "font-bold text-lavender" : "text-secondary"
                      )}
                    >
                      {cell.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div
                          key={ev.id}
                          title={`${CALENDAR_EVENT_TYPE_LABELS[ev.type]} — ${ev.title}`}
                          className={cn(
                            "truncate rounded-md px-1.5 py-0.5 text-[11px]",
                            ev.type === "entretien" && "bg-success/15 text-success",
                            ev.type === "relance" && "bg-warning/15 text-warning",
                            ev.type === "echeance" && "bg-rose/15 text-rose",
                            ev.type === "preparation" && "bg-lavender/15 text-lavender",
                            ev.type === "personnel" && "bg-card-elevated text-primary"
                          )}
                        >
                          {ev.allDay
                            ? ""
                            : `${new Date(ev.startAt).getHours()}h${pad(new Date(ev.startAt).getMinutes())} `}
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="px-1 text-[11px] text-secondary">
                          +{dayEvents.length - 3} autre(s)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle className="text-lg">À venir</CardTitle>
              <CardDescription className="mt-1">Vos 5 prochains événements.</CardDescription>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-lavender" aria-hidden />
                </div>
              ) : upcoming.length === 0 ? (
                <p className="mt-4 text-sm text-secondary">
                  Aucun événement à venir. Créez un entretien ou une relance.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {upcoming.map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={TYPE_BADGE_VARIANT[ev.type]}>
                            {CALENDAR_EVENT_TYPE_LABELS[ev.type]}
                          </Badge>
                          <span className="text-xs text-secondary">
                            {formatDateTime(ev.startAt, ev.allDay)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-primary">{ev.title}</p>
                      </div>
                      {deletingId === ev.id ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 border border-danger/30 text-danger hover:bg-danger/10"
                          onClick={() => handleDelete(ev.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Confirmer
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer ${ev.title}`}
                          className="shrink-0 text-secondary hover:text-danger"
                          onClick={() => setDeletingId(ev.id)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle className="text-lg">Tous les événements</CardTitle>
              <CardDescription className="mt-1">
                {events.length} événement(s) au total.
              </CardDescription>
              {!loading && events.length > 0 && (
                <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex items-center justify-between gap-2 border-b border-subtle py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-primary">{ev.title}</p>
                        <p className="text-xs text-secondary">
                          {formatDateTime(ev.startAt, ev.allDay)}
                        </p>
                      </div>
                      <Badge variant={TYPE_BADGE_VARIANT[ev.type]} className="shrink-0">
                        {CALENDAR_EVENT_TYPE_LABELS[ev.type]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        {!loading && events.length === 0 && (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-card-elevated">
              <CalendarDays className="h-7 w-7 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-xl">Calendrier vide</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Ajoutez vos entretiens, relances et échéances pour ne rien oublier.
            </CardDescription>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
