"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Smile,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listJournalEntries,
  createJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from "@/lib/vault/journal-repository";
import { JOURNAL_MOOD_LABELS, type JournalEntry, type JournalMood } from "@/lib/schema/journal";
import { cn } from "@/lib/utils/cn";
import { toastUndo, toastError } from "@/store/toast-store";
import { stripMetaFields } from "@/lib/utils/strip-meta";

const MOOD_COLORS: Record<JournalMood, string> = {
  tres_bien: "bg-success/15 text-success border-success/25",
  bien: "bg-success/15 text-success border-success/25",
  neutre: "bg-secondary/15 text-secondary border-secondary/25",
  fatigue: "bg-warning/15 text-warning border-warning/25",
  stress: "bg-danger/15 text-danger border-danger/25",
  motive: "bg-lavender/15 text-lavender border-lavender/25",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Regroupe les entrées par mois (clé « novembre 2026 »). */
function groupByMonth(entries: JournalEntry[]): { monthLabel: string; entries: JournalEntry[] }[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const e of entries) {
    const label = new Date(e.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const arr = groups.get(label) ?? [];
    arr.push(e);
    groups.set(label, arr);
  }
  return Array.from(groups.entries()).map(([monthLabel, entries]) => ({ monthLabel, entries }));
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: todayIsoDate(),
    title: "",
    content: "",
    mood: "" as JournalMood | "",
    tags: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listJournalEntries();
      setEntries(list);
    } catch (err) {
      console.error("[journal] Erreur chargement:", err);
      setError("Impossible de charger le journal.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ date: todayIsoDate(), title: "", content: "", mood: "", tags: "" });
    setShowForm(true);
  }

  function openEdit(entry: JournalEntry) {
    setEditing(entry);
    setForm({
      date: entry.date.slice(0, 10),
      title: entry.title,
      content: entry.content,
      mood: (entry.mood as JournalMood) || "",
      tags: entry.tags.join(", "),
    });
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        date: new Date(form.date + "T12:00:00").toISOString(),
        title: form.title.trim(),
        content: form.content,
        mood: form.mood || ("" as const),
        tags,
      };
      if (editing) {
        await updateJournalEntry(editing.id, payload);
      } else {
        await createJournalEntry(payload);
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) {
      console.error("[journal] Erreur sauvegarde:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(null);
    const snapshot = entries.find((e) => e.id === id);
    try {
      await deleteJournalEntry(id);
      await load();
      if (snapshot) {
        toastUndo(`Entrée « ${snapshot.title} » supprimée.`, async () => {
          try {
            const rest = stripMetaFields(snapshot);
            await createJournalEntry(rest);
            await load();
          } catch (err) {
            console.error("[journal] Erreur annulation:", err);
            toastError("Impossible d'annuler la suppression.");
          }
        });
      }
    } catch (err) {
      console.error("[journal] Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  const grouped = groupByMonth(entries);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Journal de recherche</h1>
            <p className="mt-2 text-secondary">
              Vos réflexions, apprentissages et bilans — chiffrés, datés, personnels.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle entrée
          </Button>
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
            <form onSubmit={handleSave} className="space-y-4">
              <CardTitle className="text-lg">
                {editing ? "Modifier l'entrée" : "Nouvelle entrée"}
              </CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Date</span>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Humeur (facultatif)</span>
                  <select
                    value={form.mood}
                    onChange={(e) => setForm({ ...form, mood: e.target.value as JournalMood | "" })}
                    className={inputClass}
                  >
                    <option value="">— Non renseignée —</option>
                    {(Object.keys(JOURNAL_MOOD_LABELS) as JournalMood[]).map((m) => (
                      <option key={m} value={m}>
                        {JOURNAL_MOOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Titre *</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex : Bilan de la semaine 42"
                  className={inputClass}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Contenu</span>
                <textarea
                  rows={8}
                  maxLength={50000}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Réflexions, apprentissages, bilan, idées…"
                  className={cn(inputClass, "resize-y leading-relaxed")}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Tags (séparés par des virgules)</span>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="bilan, entretien, motivation…"
                  className={inputClass}
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer l'entrée"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-lavender" aria-hidden />
            <span className="sr-only">Chargement du journal…</span>
          </div>
        ) : entries.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-elevated">
              <NotebookPen className="h-8 w-8 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Journal vide</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Notez vos réflexions, vos apprentissages après un entretien, ou faites le bilan de
              votre semaine.
            </CardDescription>
            <Button className="mt-6" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Écrire ma première entrée
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.monthLabel}>
                <div className="mb-4 flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-lavender" aria-hidden />
                  <h2 className="font-serif text-xl font-semibold capitalize text-primary">
                    {group.monthLabel}
                  </h2>
                  <span className="bg-subtle h-px flex-1" />
                  <span className="text-xs text-secondary">
                    {group.entries.length} entrée{group.entries.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-4">
                  {group.entries.map((entry) => (
                    <Card key={entry.id} className="relative">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs capitalize text-secondary">
                              {formatDate(entry.date)}
                            </p>
                            {entry.mood && (
                              <Badge className={MOOD_COLORS[entry.mood as JournalMood]}>
                                <Smile className="mr-1 h-3 w-3" aria-hidden />
                                {JOURNAL_MOOD_LABELS[entry.mood as JournalMood]}
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="mt-2 text-lg">{entry.title}</CardTitle>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Modifier ${entry.title}`}
                            onClick={() => openEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          {deletingId === entry.id ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-danger/30 text-danger hover:bg-danger/10"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                              Confirmer
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Supprimer ${entry.title}`}
                              className="text-secondary hover:text-danger"
                              onClick={() => setDeletingId(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          )}
                        </div>
                      </div>
                      {entry.content && (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                          {entry.content}
                        </p>
                      )}
                      {entry.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {entry.tags.map((tag) => (
                            <Badge key={tag} variant="default">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
