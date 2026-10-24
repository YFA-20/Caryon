"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, KanbanSquare, List, Pencil, Plus, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { SkeletonGrid } from "@/components/common/skeleton";
import { applicationTypeSchema } from "@/lib/schema/application";
import {
  listApplications,
  createApplication,
  updateApplication,
  deleteApplication,
} from "@/lib/vault/application-repository";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  type Application,
  type ApplicationStatus,
} from "@/lib/schema/application";
import { cn } from "@/lib/utils/cn";
import { toastUndo, toastError } from "@/store/toast-store";
import { stripMetaFields } from "@/lib/utils/strip-meta";

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

type ViewMode = "list" | "kanban";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readPrefillFromUrl(searchParams: URLSearchParams) {
  const typeRaw = searchParams.get("type") ?? "";
  const typeParsed = applicationTypeSchema.safeParse(typeRaw);
  return {
    company: searchParams.get("company") ?? undefined,
    position: searchParams.get("position") ?? undefined,
    type: typeParsed.success ? typeParsed.data : undefined,
    location: searchParams.get("location") ?? undefined,
    remote: searchParams.get("remote") === "1" ? true : undefined,
    salary: searchParams.get("salary") ?? undefined,
    source: searchParams.get("source") ?? undefined,
    offerUrl: searchParams.get("offerUrl") ?? undefined,
    notes: searchParams.get("notes") ?? undefined,
  };
}

function CandidaturesPageInner() {
  const searchParams = useSearchParams();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Application | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [prefillNotice, setPrefillNotice] = useState(false);

  // Pré-remplissage depuis la page /offres (query params)
  const prefill = useMemo(() => {
    const data = readPrefillFromUrl(searchParams);
    return Object.values(data).some((v) => v !== undefined && v !== "") ? data : null;
  }, [searchParams]);

  // Ouverture automatique du formulaire si ?new=1 (raccourci N / onboarding)
  const openNew = searchParams.get("new") === "1";

  useEffect(() => {
    if (prefill) {
      setEditing(null);
      setShowCreate(true);
      setPrefillNotice(true);
    } else if (openNew) {
      setEditing(null);
      setShowCreate(true);
    }
  }, [prefill, openNew]);

  async function refresh() {
    setLoading(true);
    try {
      const apps = await listApplications();
      setApplications(apps);
    } catch (err) {
      console.error("[candidatures] Erreur chargement:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(null);
    // Snapshot pour undo : on garde l'objet en mémoire le temps du toast
    const snapshot = applications.find((a) => a.id === id);
    try {
      await deleteApplication(id);
      await refresh();
      if (snapshot) {
        toastUndo(`Candidature « ${snapshot.company} » supprimée.`, async () => {
          try {
            const rest = stripMetaFields(snapshot);
            await createApplication(rest);
            await refresh();
          } catch (err) {
            console.error("[candidatures] Erreur annulation:", err);
            toastError("Impossible d'annuler la suppression.");
          }
        });
      }
    } catch (err) {
      console.error("[candidatures] Erreur suppression:", err);
      toastError("Erreur lors de la suppression.");
    }
  }

  // Filtrage combiné : recherche texte + statut
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications.filter((app) => {
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        app.company,
        app.position,
        app.location,
        app.source,
        app.contactName,
        app.contactEmail,
        app.notes,
        app.salary,
        ...app.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [applications, search, statusFilter]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        {/* En-tête */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Mes candidatures</h1>
            <p className="mt-2 text-secondary">
              {applications.length} candidature{applications.length > 1 ? "s" : ""} enregistrée
              {applications.length > 1 ? "s" : ""}
            </p>
          </div>
          {prefillNotice && prefill && (
            <Badge variant="lavender">
              <Sparkles className="mr-1 h-3 w-3" aria-hidden />
              Pré-rempli depuis une offre — vérifiez les champs
            </Badge>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setShowCreate(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouvelle candidature
          </Button>
        </div>

        {/* Barre d'outils : recherche + filtres + sélecteur de vue */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary/60"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (entreprise, poste, lieu, contact…)"
              className="w-full rounded-xl border border-subtle bg-surface py-2.5 pl-9 pr-4 text-sm text-primary placeholder:text-secondary/50 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              aria-label="Rechercher une candidature"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "all")}
            className="rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-primary focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="ml-auto inline-flex rounded-xl border border-subtle bg-surface p-1">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                view === "kanban"
                  ? "bg-card-elevated text-primary shadow-glow"
                  : "text-secondary hover:text-primary"
              )}
              aria-pressed={view === "kanban"}
            >
              <KanbanSquare className="h-4 w-4" aria-hidden="true" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                view === "list"
                  ? "bg-card-elevated text-primary shadow-glow"
                  : "text-secondary hover:text-primary"
              )}
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              Liste
            </button>
          </div>
        </div>

        {/* Formulaire création */}
        {showCreate && (
          <ApplicationForm
            mode="create"
            prefill={prefill ?? undefined}
            onClose={() => setShowCreate(false)}
            onSaved={() => {
              setShowCreate(false);
              refresh();
            }}
          />
        )}

        {/* Formulaire édition */}
        {editing && (
          <ApplicationForm
            mode="edit"
            application={editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}

        {/* Contenu */}
        {loading ? (
          <SkeletonGrid count={6} type="card" />
        ) : applications.length === 0 ? (
          <Card className="flex flex-col items-center px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-card-elevated shadow-glow">
              <Briefcase className="h-7 w-7 text-lavender" aria-hidden="true" />
            </div>
            <CardTitle className="mt-4 font-serif text-xl">Aucune candidature</CardTitle>
            <CardDescription className="mt-2 max-w-md">
              Commencez à suivre vos candidatures. Elles seront chiffrées et stockées uniquement sur
              cet appareil.
            </CardDescription>
            <Button
              className="mt-6"
              onClick={() => {
                setEditing(null);
                setShowCreate(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Créer ma première candidature
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center px-6 py-14 text-center">
            <CardTitle className="font-serif text-xl">Aucun résultat</CardTitle>
            <CardDescription className="mt-2">
              Aucune candidature ne correspond à votre recherche.
            </CardDescription>
            <Button
              className="mt-4"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
            >
              Réinitialiser les filtres
            </Button>
          </Card>
        ) : view === "kanban" ? (
          <KanbanBoard
            applications={filtered}
            onEdit={(app) => {
              setShowCreate(false);
              setEditing(app);
            }}
            onDelete={setDeletingId}
            onRefresh={refresh}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((app) => (
              <Card key={app.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-lg font-semibold text-primary">
                      {app.position}
                    </h3>
                    <p className="truncate text-sm text-secondary">{app.company}</p>
                  </div>
                  <Badge className={STATUS_COLORS[app.status]}>
                    {APPLICATION_STATUS_LABELS[app.status]}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-secondary">
                  <span>{APPLICATION_TYPE_LABELS[app.type]}</span>
                  {app.location && <span>· {app.location}</span>}
                  {app.remote && <span>· Télétravail</span>}
                </div>
                {app.notes && (
                  <p className="mt-3 line-clamp-2 text-sm text-secondary">{app.notes}</p>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs text-secondary">
                  <div>
                    <p>Créée le {formatDateTime(app.createdAt)}</p>
                    <p>Modifiée le {formatDateTime(app.updatedAt)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreate(false);
                        setEditing(app);
                      }}
                      className="inline-flex items-center gap-1 text-lavender hover:underline"
                    >
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(app.id)}
                      className="text-danger hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {deletingId === app.id && (
                  <div className="mt-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-sm">
                    <p className="text-danger">Supprimer cette candidature ?</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(app.id)}
                        className="rounded-lg bg-danger px-3 py-1 text-xs text-white"
                      >
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="rounded-lg border border-subtle px-3 py-1 text-xs text-secondary"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function CandidaturesPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="flex justify-center p-14">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
          </div>
        </AppShell>
      }
    >
      <CandidaturesPageInner />
    </Suspense>
  );
}

interface ApplicationFormProps {
  mode: "create" | "edit";
  application?: Application;
  prefill?: {
    company?: string;
    position?: string;
    type?: Application["type"];
    location?: string;
    remote?: boolean;
    salary?: string;
    source?: string;
    offerUrl?: string;
    notes?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

function ApplicationForm({ mode, application, prefill, onClose, onSaved }: ApplicationFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === "edit" && application;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      company: String(form.get("company") ?? ""),
      position: String(form.get("position") ?? ""),
      type: String(form.get("type") ?? "cdi") as Application["type"],
      offerUrl: String(form.get("offerUrl") ?? ""),
      location: String(form.get("location") ?? ""),
      remote: form.get("remote") === "on",
      salary: String(form.get("salary") ?? ""),
      appliedAt: String(form.get("appliedAt") ?? "") || undefined,
      deadline: String(form.get("deadline") ?? "") || undefined,
      source: String(form.get("source") ?? ""),
      contactName: String(form.get("contactName") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      contactPhone: String(form.get("contactPhone") ?? ""),
      status: String(form.get("status") ?? "brouillon") as ApplicationStatus,
      priority: (application?.priority ?? "normale") as Application["priority"],
      notes: String(form.get("notes") ?? ""),
      tags: application?.tags ?? [],
    };
    try {
      if (isEdit) {
        await updateApplication(application.id, payload);
      } else {
        await createApplication(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/50 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20";
  const labelClass = "mb-1.5 block text-sm text-secondary";

  return (
    <Card className="p-6">
      <h2 className="font-serif text-xl font-semibold text-primary">
        {isEdit ? `Modifier : ${application.position}` : "Nouvelle candidature"}
      </h2>
      {isEdit && (
        <p className="mt-1 text-xs text-secondary">
          Créée le {formatDateTime(application.createdAt)} · Dernière modification le{" "}
          {formatDateTime(application.updatedAt)}
        </p>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="company" className={labelClass}>
              Entreprise *
            </label>
            <input
              id="company"
              name="company"
              required
              className={inputClass}
              placeholder="Ex: Atelier Nova"
              defaultValue={application?.company ?? prefill?.company ?? ""}
            />
          </div>
          <div>
            <label htmlFor="position" className={labelClass}>
              Poste *
            </label>
            <input
              id="position"
              name="position"
              required
              className={inputClass}
              placeholder="Ex: Développeur front-end"
              defaultValue={application?.position ?? prefill?.position ?? ""}
            />
          </div>
          <div>
            <label htmlFor="type" className={labelClass}>
              Type
            </label>
            <select
              id="type"
              name="type"
              className={inputClass}
              defaultValue={application?.type ?? prefill?.type ?? "cdi"}
            >
              <option value="stage">Stage</option>
              <option value="alternance">Alternance</option>
              <option value="cdi">CDI</option>
              <option value="cdd">CDD</option>
              <option value="freelance">Freelance</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className={labelClass}>
              Statut
            </label>
            <select
              id="status"
              name="status"
              className={inputClass}
              defaultValue={application?.status ?? "brouillon"}
            >
              {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="location" className={labelClass}>
              Localisation
            </label>
            <input
              id="location"
              name="location"
              className={inputClass}
              placeholder="Ex: Paris, hybride"
              defaultValue={application?.location ?? prefill?.location ?? ""}
            />
          </div>
          <div>
            <label htmlFor="salary" className={labelClass}>
              Salaire / gratification
            </label>
            <input
              id="salary"
              name="salary"
              className={inputClass}
              placeholder="Ex: 45-55k€"
              defaultValue={application?.salary ?? prefill?.salary ?? ""}
            />
          </div>
          <div>
            <label htmlFor="offerUrl" className={labelClass}>
              URL de l&apos;offre
            </label>
            <input
              id="offerUrl"
              name="offerUrl"
              type="url"
              className={inputClass}
              placeholder="https://..."
              defaultValue={application?.offerUrl ?? prefill?.offerUrl ?? ""}
            />
          </div>
          <div>
            <label htmlFor="source" className={labelClass}>
              Source
            </label>
            <input
              id="source"
              name="source"
              className={inputClass}
              placeholder="Ex: LinkedIn, Indeed…"
              defaultValue={application?.source ?? prefill?.source ?? ""}
            />
          </div>
          <div>
            <label htmlFor="contactName" className={labelClass}>
              Contact recruteur
            </label>
            <input
              id="contactName"
              name="contactName"
              className={inputClass}
              placeholder="Nom du recruteur"
              defaultValue={application?.contactName ?? ""}
            />
          </div>
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Email du contact
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              className={inputClass}
              placeholder="recruteur@entreprise.fr"
              defaultValue={application?.contactEmail ?? ""}
            />
          </div>
          <div>
            <label htmlFor="appliedAt" className={labelClass}>
              Date de candidature
            </label>
            <input
              id="appliedAt"
              name="appliedAt"
              type="date"
              className={inputClass}
              defaultValue={application?.appliedAt?.slice(0, 10) ?? ""}
            />
          </div>
          <div>
            <label htmlFor="deadline" className={labelClass}>
              Date limite
            </label>
            <input
              id="deadline"
              name="deadline"
              type="date"
              className={inputClass}
              defaultValue={application?.deadline?.slice(0, 10) ?? ""}
            />
          </div>
        </div>
        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes personnelles
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className={inputClass}
            placeholder="Informations utiles, ressenti, prochaines étapes..."
            defaultValue={application?.notes ?? prefill?.notes ?? ""}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-secondary">
          <input
            type="checkbox"
            name="remote"
            className="rounded border-subtle accent-lavender"
            defaultChecked={application?.remote ?? prefill?.remote ?? false}
          />
          Télétravail possible
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
