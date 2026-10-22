"use client";

import { FileText } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function DocumentsPage() {
  return (
    <AppShell>
      <EmptyPage
        icon={FileText}
        title="Mes documents"
        description="Votre bibliothèque privée et chiffrée (CV, lettres, diplômes). L'import, la prévisualisation sécurisée et l'association aux candidatures arrivent prochainement."
      />
    </AppShell>
  );
}
