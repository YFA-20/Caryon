"use client";

import { NotebookPen } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function JournalPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={NotebookPen}
        title="Journal de recherche"
        description="Notez vos réflexions, apprentissages et bilans de semaine. Toutes les entrées seront chiffrées localement."
      />
    </AppShell>
  );
}
