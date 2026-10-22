import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Velora — page avec état vide élégant (pour les fonctionnalités à venir).
 */
export function EmptyPage({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-gradient font-serif text-4xl font-bold">{title}</h1>
      <Card className="mt-6 flex flex-col items-center px-6 py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-card-elevated shadow-glow">
          <Icon className="h-7 w-7 text-lavender" aria-hidden="true" />
        </div>
        <p className="mt-4 text-lg font-medium text-primary">{title}</p>
        <p className="mt-2 max-w-md text-sm text-secondary">{description}</p>
      </Card>
    </div>
  );
}
