"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listGoals, createGoal, deleteGoal } from "@/lib/vault/goal-repository";
import { listApplications } from "@/lib/vault/application-repository";
import { computeAllGoalProgress, type GoalProgress } from "@/lib/vault/goal-progress-service";
import {
  GOAL_METRIC_LABELS,
  GOAL_PERIOD_LABELS,
  type GoalMetric,
  type GoalPeriod,
} from "@/lib/schema/goal";
import { cn } from "@/lib/utils/cn";
import { toastUndo, toastError } from "@/store/toast-store";
import { stripMetaFields } from "@/lib/utils/strip-meta";

export default function ObjectifsPage() {
  const [progressList, setProgressList] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    metric: "applications_sent" as GoalMetric,
    target: 10,
    period: "month" as GoalPeriod,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [goals, apps] = await Promise.all([listGoals(), listApplications()]);
      setProgressList(computeAllGoalProgress(goals, apps));
    } catch (err) {
      console.error("[objectifs] Erreur chargement:", err);
      setError("Impossible de charger les objectifs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || form.target < 1) {
      setError("Le titre et une cible positive sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createGoal({
        title: form.title.trim(),
        description: form.description.trim(),
        metric: form.metric,
        target: form.target,
        period: form.period,
        startAt: new Date().toISOString(),
        endAt: "",
      });
      setForm({
        title: "",
        description: "",
        metric: "applications_sent",
        target: 10,
        period: "month",
      });
      setShowForm(false);
      await load();
    } catch (err) {
      console.error("[objectifs] Erreur création:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la création.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(null);
    const snapshot = progressList.find((p) => p.goal.id === id)?.goal;
    try {
      await deleteGoal(id);
      await load();
      if (snapshot) {
        toastUndo(`Objectif « ${snapshot.title} » supprimé.`, async () => {
          try {
            const rest = stripMetaFields(snapshot);
            await createGoal(rest);
            await load();
          } catch (err) {
            console.error("[objectifs] Erreur annulation:", err);
            toastError("Impossible d'annuler la suppression.");
          }
        });
      }
    } catch (err) {
      console.error("[objectifs] Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  const activeCount = progressList.filter((p) => !p.completed).length;
  const completedCount = progressList.filter((p) => p.completed).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Mes objectifs</h1>
            <p className="mt-2 text-secondary">
              Définissez des objectifs quantifiés et suivez votre progression réelle, calculée à
              partir de vos candidatures.
            </p>
          </div>
          <Button onClick={() => setShowForm((s) => !s)}>
            <Plus className="h-4 w-4" aria-hidden />
            Nouvel objectif
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

        {progressList.length > 0 && (
          <div className="flex gap-3">
            <Badge variant="lavender">{activeCount} en cours</Badge>
            <Badge variant="success">
              {completedCount} atteint{completedCount > 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {showForm && (
          <Card>
            <form onSubmit={handleCreate} className="space-y-4">
              <CardTitle className="text-lg">Nouvel objectif</CardTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1.5 block text-secondary">Titre *</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Ex : 10 candidatures ce mois-ci"
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Métrique</span>
                  <select
                    value={form.metric}
                    onChange={(e) => setForm({ ...form, metric: e.target.value as GoalMetric })}
                    className={inputClass}
                  >
                    {(Object.keys(GOAL_METRIC_LABELS) as GoalMetric[]).map((m) => (
                      <option key={m} value={m}>
                        {GOAL_METRIC_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Cible *</span>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10000}
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Période</span>
                  <select
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value as GoalPeriod })}
                    className={inputClass}
                  >
                    {(Object.keys(GOAL_PERIOD_LABELS) as GoalPeriod[]).map((p) => (
                      <option key={p} value={p}>
                        {GOAL_PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Description (facultatif)</span>
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className={inputClass}
                  placeholder="Pourquoi cet objectif ?"
                />
              </label>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setShowForm(false)} type="button">
                  Annuler
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {saving ? "Création…" : "Créer l'objectif"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-lavender" aria-hidden />
            <span className="sr-only">Chargement des objectifs…</span>
          </div>
        ) : progressList.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-elevated">
              <Target className="h-8 w-8 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Aucun objectif</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Définissez un objectif quantifié — par exemple « 5 candidatures par semaine » — et
              suivez votre progression automatiquement.
            </CardDescription>
            <Button className="mt-6" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Créer mon premier objectif
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {progressList.map((p) => (
              <Card key={p.goal.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{p.goal.title}</CardTitle>
                      {p.completed && (
                        <Badge variant="success">
                          <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
                          Atteint
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {GOAL_METRIC_LABELS[p.goal.metric]} · {GOAL_PERIOD_LABELS[p.goal.period]}
                      {p.daysRemaining !== null && !p.completed && (
                        <>
                          {" "}
                          · {p.daysRemaining} j restant{p.daysRemaining > 1 ? "s" : ""}
                        </>
                      )}
                    </CardDescription>
                    {p.goal.description && (
                      <p className="mt-2 text-sm text-secondary">{p.goal.description}</p>
                    )}
                  </div>
                  {deletingId === p.goal.id ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 border border-danger/30 text-danger hover:bg-danger/10"
                      onClick={() => handleDelete(p.goal.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Confirmer
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer l'objectif ${p.goal.title}`}
                      className="shrink-0 text-secondary hover:text-danger"
                      onClick={() => setDeletingId(p.goal.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-secondary">
                      {p.current} / {p.target}
                    </span>
                    <span
                      className={cn("font-medium", p.completed ? "text-success" : "text-primary")}
                    >
                      {p.percent}%
                    </span>
                  </div>
                  <div
                    className="h-2.5 overflow-hidden rounded-full bg-card-elevated"
                    role="progressbar"
                    aria-valuenow={p.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progression : ${p.percent}%`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        p.completed ? "bg-success" : "bg-gradient-to-r from-rose to-lavender"
                      )}
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="text-xs text-secondary">
          La progression est calculée automatiquement à partir de vos candidatures chiffrées. Les
          périodes « semaine », « mois » et « trimestre » suivent le calendrier civil en cours.
        </p>
      </div>
    </AppShell>
  );
}
