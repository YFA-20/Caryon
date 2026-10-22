"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Building2, MapPin, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { APPLICATION_TYPE_LABELS, type Application } from "@/lib/schema/application";

interface KanbanCardProps {
  application: Application;
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  isDragging?: boolean;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export function KanbanCard({ application, onEdit, onDelete, isDragging }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragging = isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-xl border border-subtle bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        dragging && "opacity-50 shadow-lg ring-2 ring-lavender"
      )}
    >
      {/* Poste + type */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-sm font-semibold text-primary">{application.position}</h4>
        <Badge className="shrink-0 text-[10px]">{APPLICATION_TYPE_LABELS[application.type]}</Badge>
      </div>

      {/* Entreprise */}
      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary">
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{application.company}</span>
      </div>

      {/* Localisation */}
      {application.location && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-secondary">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{application.location}</span>
        </div>
      )}

      {/* Notes (aperçu) */}
      {application.notes && (
        <p className="mt-2 line-clamp-2 text-xs text-secondary/80">{application.notes}</p>
      )}

      {/* Pied de carte : date + actions */}
      <div className="mt-3 flex items-center justify-between border-t border-subtle pt-2">
        <span className="text-[10px] text-secondary/60">
          {application.appliedAt
            ? formatDate(application.appliedAt)
            : formatDate(application.createdAt)}
        </span>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(application);
            }}
            className="rounded-lg p-1 text-lavender hover:bg-lavender/10"
            aria-label={`Modifier ${application.position}`}
            title="Modifier"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(application.id);
            }}
            className="rounded-lg p-1 text-danger hover:bg-danger/10"
            aria-label={`Supprimer ${application.position}`}
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
