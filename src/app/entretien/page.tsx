"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ListChecks,
  Loader2,
  MessageSquare,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listApplications } from "@/lib/vault/application-repository";
import {
  listInterviewPreps,
  createInterviewPrep,
  updateInterviewPrep,
  deleteInterviewPrep,
  toggleChecklistItem,
  checklistProgress,
  questionsProgress,
} from "@/lib/vault/interview-repository";
import type { Application } from "@/lib/schema/application";
import type { InterviewPrep, InterviewFormat, InterviewQuestion } from "@/lib/schema/interview";
import {
  INTERVIEW_FORMAT_LABELS,
  INTERVIEW_QUESTION_CATEGORY_LABELS,
} from "@/lib/schema/interview";
import { APPLICATION_STATUS_LABELS } from "@/lib/schema/application";
import { cn } from "@/lib/utils/cn";

export default function EntretienPage() {
  const [preps, setPreps] = useState<InterviewPrep[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prepList, appList] = await Promise.all([listInterviewPreps(), listApplications()]);
      setPreps(prepList);
      setApplications(appList);
      // Sélectionne la première fiche par défaut
      if (prepList.length > 0 && !selectedId) {
        setSelectedId(prepList[0]!.id);
      }
    } catch (err) {
      console.error("[entretien] Erreur chargement:", err);
      setError("Impossible de charger les préparations.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = preps.find((p) => p.id === selectedId) ?? null;
  const selectedApp = selected ? applications.find((a) => a.id === selected.applicationId) : null;

  // Candidatures sans fiche de préparation (avec entretien en cours ou à venir)
  const appsWithoutPrep = applications.filter(
    (a) =>
      !preps.some((p) => p.applicationId === a.id) &&
      ["entretien", "envoyee", "en_attente"].includes(a.status)
  );

  async function handleCreate(applicationId: string) {
    setCreating(true);
    setError(null);
    try {
      const prep = await createInterviewPrep(applicationId);
      await load();
      setSelectedId(prep.id);
      setShowCreate(false);
    } catch (err) {
      console.error("[entretien] Erreur création:", err);
      setError("Erreur lors de la création de la fiche.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleChecklist(itemId: string) {
    if (!selected) return;
    try {
      const updated = await toggleChecklistItem(selected.id, itemId);
      setPreps((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      console.error("[entretien] Erreur checklist:", err);
    }
  }

  async function handleUpdateField(patch: Partial<InterviewPrep>) {
    if (!selected) return;
    try {
      const updated = await updateInterviewPrep(selected.id, patch);
      setPreps((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      console.error("[entretien] Erreur mise à jour:", err);
      setError("Erreur lors de la sauvegarde.");
    }
  }

  async function handleAddQuestion() {
    if (!selected) return;
    const newQuestion: InterviewQuestion = {
      id: crypto.randomUUID(),
      question: "",
      answer: "",
      category: "comportementale",
      prepared: false,
    };
    await handleUpdateField({ questions: [...selected.questions, newQuestion] });
  }

  async function handleUpdateQuestion(questionId: string, patch: Partial<InterviewQuestion>) {
    if (!selected) return;
    const questions = selected.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q));
    await handleUpdateField({ questions });
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!selected) return;
    const questions = selected.questions.filter((q) => q.id !== questionId);
    await handleUpdateField({ questions });
  }

  async function handleDeletePrep(id: string) {
    try {
      await deleteInterviewPrep(id);
      setSelectedId(null);
      await load();
    } catch (err) {
      console.error("[entretien] Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Préparer un entretien</h1>
            <p className="mt-2 text-secondary">
              Fiches de préparation liées à vos candidatures : checklist, questions anticipées,
              auto-évaluation.
            </p>
          </div>
          <Button onClick={() => setShowCreate((s) => !s)} disabled={appsWithoutPrep.length === 0}>
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle fiche
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

        {showCreate && (
          <Card>
            <CardTitle className="text-lg">Nouvelle fiche de préparation</CardTitle>
            <CardDescription className="mt-1">
              Choisissez une candidature à préparer (entretien en cours ou à venir).
            </CardDescription>
            {appsWithoutPrep.length === 0 ? (
              <p className="mt-4 text-sm text-secondary">
                Toutes vos candidatures actives ont déjà une fiche, ou aucune n&apos;est en cours
                d&apos;entretien.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {appsWithoutPrep.map((app) => (
                  <li key={app.id}>
                    <button
                      type="button"
                      disabled={creating}
                      onClick={() => handleCreate(app.id)}
                      className="transition-velora flex w-full items-center justify-between gap-3 rounded-xl border border-subtle bg-background/40 p-3 text-left hover:bg-card-elevated"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">{app.position}</p>
                        <p className="truncate text-xs text-secondary">{app.company}</p>
                      </div>
                      <Badge variant="lavender">{APPLICATION_STATUS_LABELS[app.status]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-lavender" aria-hidden />
            <span className="sr-only">Chargement…</span>
          </div>
        ) : preps.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-elevated">
              <Target className="h-8 w-8 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Aucune fiche de préparation</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Créez une fiche pour une candidature en entretien : checklist, questions anticipées,
              contexte entreprise.
            </CardDescription>
            <Button
              className="mt-6"
              onClick={() => setShowCreate(true)}
              disabled={appsWithoutPrep.length === 0}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Créer ma première fiche
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            {/* Liste des fiches */}
            <div className="space-y-2">
              {preps.map((prep) => {
                const app = applications.find((a) => a.id === prep.applicationId);
                const progress = checklistProgress(prep);
                return (
                  <button
                    key={prep.id}
                    type="button"
                    onClick={() => setSelectedId(prep.id)}
                    className={cn(
                      "transition-velora w-full rounded-xl border p-3 text-left",
                      selectedId === prep.id
                        ? "border-lavender/40 bg-card-elevated shadow-glow"
                        : "border-subtle bg-card hover:bg-card-elevated"
                    )}
                  >
                    <p className="truncate text-sm font-medium text-primary">
                      {app ? app.position : "Candidature supprimée"}
                    </p>
                    <p className="truncate text-xs text-secondary">{app ? app.company : "—"}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rose to-lavender"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-secondary">{progress}%</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Détail de la fiche sélectionnée */}
            {selected && selectedApp ? (
              <div className="space-y-6">
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedApp.position} — {selectedApp.company}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {INTERVIEW_FORMAT_LABELS[selected.format]} ·{" "}
                        {APPLICATION_STATUS_LABELS[selectedApp.status]}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer cette fiche"
                      className="text-secondary hover:text-danger"
                      onClick={() => handleDeletePrep(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-secondary">Format</span>
                      <select
                        value={selected.format}
                        onChange={(e) =>
                          handleUpdateField({ format: e.target.value as InterviewFormat })
                        }
                        className={inputClass}
                      >
                        {(Object.keys(INTERVIEW_FORMAT_LABELS) as InterviewFormat[]).map((f) => (
                          <option key={f} value={f}>
                            {INTERVIEW_FORMAT_LABELS[f]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-secondary">Date de l&apos;entretien</span>
                      <input
                        type="date"
                        value={selected.interviewDate ? selected.interviewDate.slice(0, 10) : ""}
                        onChange={(e) =>
                          handleUpdateField({
                            interviewDate: e.target.value
                              ? new Date(e.target.value + "T12:00:00").toISOString()
                              : "",
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>
                </Card>

                {/* Checklist */}
                <Card>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ListChecks className="h-5 w-5 text-lavender" aria-hidden />
                        Checklist
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selected.checklist.filter((i) => i.done).length} /{" "}
                        {selected.checklist.length} — {checklistProgress(selected)}%
                      </CardDescription>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {selected.checklist.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleToggleChecklist(item.id)}
                          className="transition-velora flex w-full items-center gap-3 rounded-xl border border-subtle bg-background/40 p-3 text-left hover:bg-card-elevated"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              item.done
                                ? "border-success bg-success/15 text-success"
                                : "border-subtle text-transparent"
                            )}
                            aria-hidden
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                          <span
                            className={cn(
                              "text-sm",
                              item.done ? "text-secondary line-through" : "text-primary"
                            )}
                          >
                            {item.label}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Contexte entreprise */}
                <Card className="space-y-4">
                  <CardTitle className="text-lg">Contexte</CardTitle>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-secondary">
                      Recherche sur l&apos;entreprise (actualités, produits, culture)
                    </span>
                    <textarea
                      rows={4}
                      maxLength={20000}
                      value={selected.companyResearch}
                      onChange={(e) => handleUpdateField({ companyResearch: e.target.value })}
                      onBlur={(e) => handleUpdateField({ companyResearch: e.target.value })}
                      placeholder="Ce que vous avez appris sur l'entreprise…"
                      className={cn(inputClass, "resize-y")}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-secondary">
                      Vos points forts à mettre en avant
                    </span>
                    <textarea
                      rows={3}
                      maxLength={10000}
                      value={selected.strengths}
                      onChange={(e) => handleUpdateField({ strengths: e.target.value })}
                      placeholder="Compétences, expériences, réalisations…"
                      className={cn(inputClass, "resize-y")}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-secondary">
                      Points à améliorer / faiblesses anticipées
                    </span>
                    <textarea
                      rows={3}
                      maxLength={10000}
                      value={selected.weaknesses}
                      onChange={(e) => handleUpdateField({ weaknesses: e.target.value })}
                      placeholder="Ce sur quoi vous pouvez progresser…"
                      className={cn(inputClass, "resize-y")}
                    />
                  </label>
                </Card>

                {/* Questions anticipées */}
                <Card className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquare className="h-5 w-5 text-lavender" aria-hidden />
                        Questions anticipées
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {selected.questions.length > 0
                          ? `${questionsProgress(selected)}% préparées`
                          : "Aucune question ajoutée"}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleAddQuestion}>
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      Ajouter
                    </Button>
                  </div>
                  {selected.questions.length === 0 ? (
                    <p className="text-sm text-secondary">
                      Ajoutez les questions que vous anticipez, préparez vos réponses.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {selected.questions.map((q) => (
                        <div
                          key={q.id}
                          className="space-y-3 rounded-xl border border-subtle bg-background/40 p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <label className="block flex-1 text-sm">
                              <span className="mb-1.5 block text-secondary">Question</span>
                              <input
                                type="text"
                                maxLength={1000}
                                value={q.question}
                                onChange={(e) =>
                                  handleUpdateQuestion(q.id, { question: e.target.value })
                                }
                                placeholder="Ex : Parlez-moi de vous"
                                className={inputClass}
                              />
                            </label>
                            <div className="flex shrink-0 gap-1 pt-6">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={
                                  q.prepared ? "Marquer non préparée" : "Marquer préparée"
                                }
                                className={cn(q.prepared ? "text-success" : "text-secondary")}
                                onClick={() =>
                                  handleUpdateQuestion(q.id, { prepared: !q.prepared })
                                }
                              >
                                <CheckCircle2 className="h-4 w-4" aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Supprimer la question"
                                className="text-secondary hover:text-danger"
                                onClick={() => handleDeleteQuestion(q.id)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                              </Button>
                            </div>
                          </div>
                          <label className="block text-sm">
                            <span className="mb-1.5 block text-secondary">Catégorie</span>
                            <select
                              value={q.category}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, {
                                  category: e.target.value as InterviewQuestion["category"],
                                })
                              }
                              className={inputClass}
                            >
                              {(
                                Object.keys(INTERVIEW_QUESTION_CATEGORY_LABELS) as Array<
                                  InterviewQuestion["category"]
                                >
                              ).map((c) => (
                                <option key={c} value={c}>
                                  {INTERVIEW_QUESTION_CATEGORY_LABELS[c]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-sm">
                            <span className="mb-1.5 block text-secondary">
                              Votre réponse (brouillon)
                            </span>
                            <textarea
                              rows={3}
                              maxLength={10000}
                              value={q.answer}
                              onChange={(e) =>
                                handleUpdateQuestion(q.id, { answer: e.target.value })
                              }
                              placeholder="Préparez votre réponse (méthode STAR : Situation, Tâche, Action, Résultat)…"
                              className={cn(inputClass, "resize-y")}
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Auto-évaluation post-entretien */}
                <Card className="space-y-4">
                  <CardTitle className="text-lg">Après l&apos;entretien</CardTitle>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-secondary">
                      Auto-évaluation (0 = décevant, 5 = excellent)
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleUpdateField({ selfRating: n })}
                          aria-label={`Note ${n}/5`}
                          className={cn(
                            "transition-velora h-9 w-9 rounded-xl border text-sm font-medium",
                            (selected.selfRating ?? 0) >= n
                              ? "border-lavender bg-lavender/15 text-lavender"
                              : "border-subtle text-secondary hover:text-primary"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block text-secondary">Notes post-entretien</span>
                    <textarea
                      rows={4}
                      maxLength={20000}
                      value={selected.postNotes}
                      onChange={(e) => handleUpdateField({ postNotes: e.target.value })}
                      placeholder="Ce qui s'est bien passé, ce qu'il faut retenir pour la suite…"
                      className={cn(inputClass, "resize-y")}
                    />
                  </label>
                </Card>
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Briefcase className="mx-auto h-8 w-8 text-secondary" aria-hidden />
                <p className="mt-3 text-sm text-secondary">
                  Sélectionnez une fiche dans la liste pour la consulter.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
