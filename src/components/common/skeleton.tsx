import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Velora — skeletons de chargement.
 *
 * Remplacent les spinners par des placeholders animés (pulse) pour une
 * perception de chargement plus fluide. Respectent prefers-reduced-motion
 * via la classe animate-pulse de Tailwind (désactivée automatiquement).
 */

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-card-elevated/60 animate-pulse rounded-xl", className)}
      aria-hidden
      {...props}
    />
  );
}

/** Skeleton d'une carte de candidature (liste). */
export function SkeletonCard() {
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <div className="flex justify-between border-t border-subtle pt-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** Skeleton d'une carte de document. */
export function SkeletonDocumentCard() {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-8 w-full rounded-xl" />
    </div>
  );
}

/** Skeleton d'une carte d'événement (liste à venir). */
export function SkeletonEventItem() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-subtle bg-background/40 p-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Skeleton d'une carte de statistique (dashboard). */
export function SkeletonStatCard() {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
    </div>
  );
}

/** Skeleton d'une entrée de journal. */
export function SkeletonJournalEntry() {
  return (
    <div className="card space-y-3 p-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  );
}

/** Grille de skeletons pour une page liste. */
export function SkeletonGrid({
  count = 6,
  type = "card",
}: {
  count?: number;
  type?: "card" | "document" | "journal" | "event" | "stat";
}) {
  const Item =
    type === "document"
      ? SkeletonDocumentCard
      : type === "journal"
        ? SkeletonJournalEntry
        : type === "event"
          ? SkeletonEventItem
          : type === "stat"
            ? SkeletonStatCard
            : SkeletonCard;
  const gridClass =
    type === "event" || type === "stat"
      ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      : type === "document"
        ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        : "grid gap-4 md:grid-cols-2";
  return (
    <div className={gridClass} aria-busy="true" aria-label="Chargement en cours">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}
