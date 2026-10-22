"use client";

import { Bell, Lock, Unlock } from "lucide-react";
import { useUiStore } from "@/store/ui-store";
import { formatDateFr, todayIso } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Header() {
  const { vaultUnlocked, demoMode, firstName, setVaultUnlocked, setDemoMode } = useUiStore();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-subtle bg-surface/80 px-4 backdrop-blur-md md:px-8">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-secondary">{formatDateFr(todayIso())}</p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Badge variant={demoMode ? "lavender" : "default"}>
          {demoMode ? "Mode démonstration" : "Hors ligne · local"}
        </Badge>
        <Badge variant={vaultUnlocked ? "success" : "warning"}>
          {vaultUnlocked ? "Coffre déverrouillé" : "Coffre verrouillé"}
        </Badge>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDemoMode(!demoMode)}
        aria-pressed={demoMode}
        title="Activer/désactiver le mode démonstration (données fictives)"
      >
        {demoMode ? "Quitter la démo" : "Mode démo"}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        title="Notifications locales (aucune pour le moment)"
      >
        <Bell className="h-5 w-5" aria-hidden />
      </Button>

      <Button
        variant={vaultUnlocked ? "outline" : "primary"}
        size="sm"
        onClick={() => setVaultUnlocked(!vaultUnlocked)}
        aria-label={vaultUnlocked ? "Verrouiller le coffre" : "Déverrouiller le coffre"}
        title={
          vaultUnlocked
            ? "Verrouiller le coffre (simulation d'état — le vrai coffre arrive ensuite)"
            : "Déverrouiller le coffre (simulation d'état — le vrai coffre arrive ensuite)"
        }
      >
        {vaultUnlocked ? (
          <Unlock className="h-4 w-4" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
        <span className="hidden sm:inline">{vaultUnlocked ? "Verrouiller" : "Déverrouiller"}</span>
      </Button>

      <div
        className="flex h-9 w-9 items-center justify-center rounded-full bg-card-elevated text-sm font-semibold text-rose shadow-glow"
        aria-hidden
      >
        {(firstName || "V").charAt(0).toUpperCase()}
      </div>
    </header>
  );
}
