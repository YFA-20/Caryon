"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { updateApplication } from "@/lib/vault/application-repository";
import {
  APPLICATION_STATUS_LABELS,
  type Application,
  type ApplicationStatus,
} from "@/lib/schema/application";

/**
 * Ordre des colonnes du pipeline de candidature.
 * Les statuts "finaux" (acceptée, refusée, abandonnée) sont regroupés à droite.
 */
const KANBAN_COLUMNS: ApplicationStatus[] = [
  "brouillon",
  "a_envoyer",
  "envoyee",
  "en_attente",
  "entretien",
  "offre_recue",
  "acceptee",
  "refusee",
  "abandonnee",
];

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

interface KanbanBoardProps {
  applications: Application[];
  onEdit: (app: Application) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function KanbanBoard({ applications, onEdit, onDelete, onRefresh }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Groupe les candidatures par statut
  const byStatus = KANBAN_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = applications.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>
  );

  const activeApp = activeId ? applications.find((a) => a.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const appId = String(active.id);
    const newStatus = String(over.id) as ApplicationStatus;
    const app = applications.find((a) => a.id === appId);

    if (!app || app.status === newStatus) return;

    setUpdating(true);
    try {
      await updateApplication(appId, { status: newStatus });
      onRefresh();
    } catch (err) {
      console.error("[kanban] Erreur mise à jour statut:", err);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {KANBAN_COLUMNS.map((status) => {
          const apps = byStatus[status];
          return (
            <KanbanColumn
              key={status}
              status={status}
              label={APPLICATION_STATUS_LABELS[status]}
              colorClass={STATUS_COLORS[status]}
              applications={apps}
              onEdit={onEdit}
              onDelete={onDelete}
              updating={updating}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeApp ? (
          <div className="w-72 opacity-90">
            <KanbanCard application={activeApp} onEdit={onEdit} onDelete={onDelete} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export { SortableContext, verticalListSortingStrategy };
