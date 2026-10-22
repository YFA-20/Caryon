"use client";

import { TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function AnalysesPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={TrendingUp}
        title="Analyses"
        description="Statistiques calculées localement : candidatures par semaine, taux de réponse, sources efficaces. Les définitions et dénominateurs seront affichés."
      />
    </AppShell>
  );
}
