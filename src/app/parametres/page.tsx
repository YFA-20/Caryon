"use client";

import { Settings } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function ParametresPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={Settings}
        title="Paramètres"
        description="Personnalisez votre expérience : verrouillage automatique, thème, confidentialité de l'IA (aucun appel externe sans consentement explicite)."
      />
    </AppShell>
  );
}
