"use client";

import { Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function EntretienPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={Target}
        title="Préparer un entretien"
        description="Générez des questions adaptées au poste et entraînez-vous. Disponible dans une prochaine itération."
      />
    </AppShell>
  );
}
