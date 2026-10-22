import { Briefcase, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * État vide élégant : aucune donnée réelle (coffre verrouillé / aucune candidature).
 */
export function EmptyState() {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-card-elevated shadow-glow">
        <Briefcase className="h-6 w-6 text-rose" aria-hidden />
      </div>
      <h2 className="mt-5 font-serif text-2xl font-semibold text-primary">
        Aucune candidature pour le moment
      </h2>
      <p className="mt-2 max-w-md text-sm text-secondary">
        Commencez à centraliser vos démarches : chaque candidature, contact et document sera chiffré
        et stocké uniquement sur votre appareil.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button size="md" disabled title="Disponible dans la prochaine itération (création guidée)">
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter une candidature
        </Button>
        <p className="text-xs text-secondary">
          La création guidée arrive dans la prochaine itération.
        </p>
      </div>
    </div>
  );
}
