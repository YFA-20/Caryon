"use client";

import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyPage } from "@/components/common/empty-page";

export default function SecuritePage() {
  return (
    <AppShell>
      <EmptyPage
        icon={ShieldCheck}
        title="Sécurité et confidentialité"
        description="Gérez le verrouillage automatique, consultez le modèle de menace et la documentation cryptographique. Vos données sont chiffrées avec AES-256-GCM, votre phrase secrète n'est jamais stockée."
      />
    </AppShell>
  );
}
