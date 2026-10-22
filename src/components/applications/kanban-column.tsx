"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { cn } from "@/lib/utils/cn";
import type { Application, ApplicationStatus } from "@/lib/schema/application";

interface KanbanColumnProps {
  status: ApplicationStatus;
  label: string;
  colorClass: string;
  applications: Application[];
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  updating?: boolean;
}

export function KanbanColumn({
  status,
  label,
  colorClass,
  applications,
  onEdit,
  onDelete,
  updating,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border border-subtle bg-card/50 p-3 transition-colors",
        isOver && "bg-card-elevated/50 border-lavender"
      )}
    >
      {/* En-tête de colonne */}
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
              colorClass
            )}
          >
            {label}
          </span>
        </div>
        <span className="text-xs text-secondary">{applications.length}</span>
      </div>

      {/* Liste des cartes (drop zone) */}
      <SortableContext items={applications.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <div className="flex min-h-[100px] flex-1 flex-col gap-2">
          {applications.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-subtle px-3 py-6 text-center text-xs text-secondary/60">
              {updating ? "Mise à jour…" : "Aucune candidature"}
            </div>
          ) : (
            applications.map((app) => (
              <KanbanCard key={app.id} application={app} onEdit={onEdit} onDelete={onDelete} />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
