"use client";

import { Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function SauvegardesPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={Save}
        title="Sauvegardes"
        description="Exportez une archive chiffrée portable de vos données et documents. La restauration sur un autre appareil sera testée et documentée."
      />
    </AppShell>
  );
}
