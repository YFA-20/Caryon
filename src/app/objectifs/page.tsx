"use client";

import { Target } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function ObjectifsPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={Target}
        title="Mes objectifs"
        description="Définissez des objectifs personnalisés (ex: 5 candidatures par semaine) et suivez votre progression."
      />
    </AppShell>
  );
}
