"use client";

import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function OffresPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={Sparkles}
        title="Explorer les offres"
        description="L'analyse d'offres par IA (facultative, avec consentement explicite) sera disponible dans une prochaine phase."
      />
    </AppShell>
  );
}
