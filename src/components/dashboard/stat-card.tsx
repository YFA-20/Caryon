import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  accent?: "rose" | "lavender" | "success" | "warning";
}

const ACCENTS = {
  rose: "text-rose",
  lavender: "text-lavender",
  success: "text-success",
  warning: "text-warning",
} as const;

export function StatCard({ label, value, icon: Icon, hint, accent = "rose" }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-subtle bg-background/40 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-secondary">{label}</p>
        <Icon className={cn("h-4 w-4", ACCENTS[accent])} aria-hidden />
      </div>
      <p className="mt-2 font-serif text-3xl font-semibold text-primary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-secondary">{hint}</p> : null}
    </div>
  );
}
