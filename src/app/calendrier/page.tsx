"use client";

import { CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function CalendrierPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={CalendarDays}
        title="Calendrier"
        description="Visualisez vos entretiens, relances et échéances. Export ICS et notifications locales arrivent dans une prochaine itération."
      />
    </AppShell>
  );
}
