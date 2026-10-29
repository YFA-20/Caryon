"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  Pencil,
  Square,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_TYPE_LABELS,
  type Application,
  type ApplicationStatus,
  type ApplicationType,
} from "@/lib/schema/application";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortColumn = "company" | "position" | "type" | "status" | "createdAt" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export interface TableFilters {
  search: string;
  status: ApplicationStatus | "all";
  type: ApplicationType | "all";
  source: string; // "" = tous
  dateFrom: string; // YYYY-MM-DD ou ""
  dateTo: string;
}

export interface ApplicationsTableProps {
  applications: Application[];
  filters: TableFilters;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onDeleteMany?: (ids: string[]) => void;
  onStatusChangeMany?: (ids: string[], status: ApplicationStatus) => void;
  onShowTimeline?: (app: Application) => void;
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

const COLUMNS: { key: SortColumn; label: string; sortable: boolean }[] = [
  { key: "company", label: "Entreprise", sortable: true },
  { key: "position", label: "Poste", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "status", label: "Statut", sortable: true },
  { key: "createdAt", label: "Créée le", sortable: true },
  { key: "updatedAt", label: "Modifiée le", sortable: true },
];

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Extrait la liste unique des sources présentes dans les données. */
export function extractSources(applications: Application[]): string[] {
  const sources = new Set<string>();
  for (const app of applications) {
    if (app.source) sources.add(app.source);
  }
  return Array.from(sources).sort((a, b) => a.localeCompare(b, "fr"));
}

/** Applique les filtres combinés sur la liste. */
export function applyTableFilters(
  applications: Application[],
  filters: TableFilters
): Application[] {
  const q = filters.search.trim().toLowerCase();
  return applications.filter((app) => {
    if (filters.status !== "all" && app.status !== filters.status) return false;
    if (filters.type !== "all" && app.type !== filters.type) return false;
    if (filters.source && app.source !== filters.source) return false;
    if (filters.dateFrom && app.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && app.createdAt.slice(0, 10) > filters.dateTo) return false;
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
}

/** Applique le tri sur la liste filtrée. */
export function applyTableSort(applications: Application[], sort: SortState): Application[] {
  const { column, direction } = sort;
  const factor = direction === "asc" ? 1 : -1;
  return [...applications].sort((a, b) => {
    let cmp: number;
    switch (column) {
      case "company":
        cmp = a.company.localeCompare(b.company, "fr");
        break;
      case "position":
        cmp = a.position.localeCompare(b.position, "fr");
        break;
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "status":
        cmp = a.status.localeCompare(b.status);
        break;
      case "createdAt":
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
      case "updatedAt":
        cmp = a.updatedAt.localeCompare(b.updatedAt);
        break;
      default:
        cmp = 0;
    }
    // Tri secondaire sur l'entreprise pour la stabilité
    if (cmp === 0 && column !== "company") {
      cmp = a.company.localeCompare(b.company, "fr");
    }
    return cmp * factor;
  });
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export function ApplicationsTable({
  applications,
  filters,
  sort,
  onSortChange,
  onEdit,
  onDelete,
  onDeleteMany,
  onStatusChangeMany,
  onShowTimeline,
}: ApplicationsTableProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkStatus, setShowBulkStatus] = useState(false);

  const filtered = useMemo(() => applyTableFilters(applications, filters), [applications, filters]);
  const sorted = useMemo(() => applyTableSort(filtered, sort), [filtered, sort]);

  const allSelected = sorted.length > 0 && sorted.every((a) => selected.has(a.id));
  const someSelected = sorted.some((a) => selected.has(a.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((a) => a.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSort(column: SortColumn) {
    if (sort.column === column) {
      onSortChange({ column, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ column, direction: "asc" });
    }
  }

  function handleBulkStatusChange(status: ApplicationStatus) {
    if (selected.size === 0 || !onStatusChangeMany) return;
    onStatusChangeMany(Array.from(selected), status);
    setSelected(new Set());
    setShowBulkStatus(false);
  }

  function handleBulkDelete() {
    if (selected.size === 0 || !onDeleteMany) return;
    onDeleteMany(Array.from(selected));
    setSelected(new Set());
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {/* Barre d'actions groupées */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-lavender/25 bg-lavender/10 px-4 py-2.5 text-sm">
          <span className="font-medium text-primary">
            {selectedCount} candidature{selectedCount > 1 ? "s" : ""} sélectionnée
            {selectedCount > 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {onStatusChangeMany && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBulkStatus((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-card-elevated px-3 py-1.5 text-xs text-primary hover:brightness-110"
                >
                  Changer le statut
                  <ChevronDown className="h-3 w-3" aria-hidden />
                </button>
                {showBulkStatus && (
                  <div className="absolute right-0 top-full z-10 mt-1 min-w-48 rounded-xl border border-subtle bg-surface py-1 shadow-glow">
                    {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleBulkStatusChange(value as ApplicationStatus)}
                        className="block w-full px-3 py-1.5 text-left text-xs text-secondary hover:bg-card hover:text-primary"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {onDeleteMany && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger hover:bg-danger/20"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Supprimer
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-secondary hover:text-primary"
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-x-auto rounded-2xl border border-subtle bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle text-left text-xs uppercase tracking-wider text-secondary">
              <th scope="col" className="w-10 px-4 py-3">
                <button
                  type="button"
                  onClick={toggleAll}
                  aria-label={allSelected ? "Tout désélectionner" : "Tout sélectionner"}
                  className="text-secondary hover:text-primary"
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4 text-lavender" aria-hidden />
                  ) : someSelected ? (
                    <CheckSquare className="h-4 w-4 text-lavender/50" aria-hidden />
                  ) : (
                    <Square className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} scope="col" className="px-4 py-3 font-medium">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-primary"
                      aria-label={`Trier par ${col.label}`}
                    >
                      {col.label}
                      {sort.column === col.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-10 text-center text-secondary">
                  Aucune candidature ne correspond aux filtres.
                </td>
              </tr>
            ) : (
              sorted.map((app) => {
                const isSelected = selected.has(app.id);
                return (
                  <tr
                    key={app.id}
                    className={cn(
                      "border-b border-subtle/50 transition-colors last:border-0",
                      isSelected ? "bg-lavender/5" : "hover:bg-card-elevated/50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleOne(app.id)}
                        aria-label={isSelected ? "Désélectionner" : "Sélectionner"}
                        aria-pressed={isSelected}
                        className="text-secondary hover:text-primary"
                      >
                        {isSelected ? (
                          <CheckSquare className="h-4 w-4 text-lavender" aria-hidden />
                        ) : (
                          <Square className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-primary">{app.company}</span>
                      {app.location && (
                        <span className="ml-2 text-xs text-secondary">· {app.location}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-primary">{app.position}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-secondary">
                        {APPLICATION_TYPE_LABELS[app.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[app.status]}>
                        {APPLICATION_STATUS_LABELS[app.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {formatDate(app.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-secondary">
                      {formatDate(app.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {onShowTimeline && (
                          <button
                            type="button"
                            onClick={() => onShowTimeline(app)}
                            className="text-xs text-secondary hover:text-lavender"
                            title="Voir la chronologie"
                          >
                            Chronologie
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEdit(app)}
                          className="inline-flex items-center gap-1 text-xs text-lavender hover:underline"
                        >
                          <Pencil className="h-3 w-3" aria-hidden />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(app.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Compteur */}
      <p className="text-xs text-secondary">
        {sorted.length} candidature{sorted.length > 1 ? "s" : ""} affichée
        {sorted.length > 1 ? "s" : ""} sur {applications.length}
      </p>
    </div>
  );
}
