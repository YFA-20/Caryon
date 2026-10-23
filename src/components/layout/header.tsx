"use client";

import { useState } from "react";
import { Bell, Lock, Unlock } from "lucide-react";
import { useUiStore } from "@/store/ui-store";
import { useVaultStore } from "@/store/vault-store";
import { lock } from "@/lib/vault/vault-service";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/notifications/notification-service";
import { formatDateFr, todayIso } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NOTIFICATION_LABELS: Record<NotificationPermissionState, string> = {
  granted: "Notifications activées",
  denied: "Notifications bloquées",
  default: "Activer les notifications",
  unsupported: "Notifications indisponibles",
};

export function Header() {
  const { demoMode, firstName, setDemoMode } = useUiStore();
  const { status, setStatus } = useVaultStore();
  const unlocked = status === "unlocked";
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  async function handleToggleNotifications() {
    setNotifMessage(null);
    if (notifPermission === "granted") {
      setNotifMessage(
        "Pour désactiver, modifiez les permissions du site dans les réglages de votre navigateur."
      );
      return;
    }
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === "granted") {
      sendTestNotification();
      setNotifMessage("Notifications activées. Un rappel de test vient d'être envoyé.");
    } else if (result === "denied") {
      setNotifMessage(
        "Notifications refusées. Autorisez-les dans les réglages du navigateur pour recevoir les rappels."
      );
    }
  }

  function handleLock() {
    lock();
    setStatus("locked");
    // Force le rechargement pour réafficher le portail de déverrouillage
    window.location.reload();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-subtle bg-surface/80 px-4 backdrop-blur-md md:px-8">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-secondary">{formatDateFr(todayIso())}</p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <Badge variant={demoMode ? "lavender" : "default"}>
          {demoMode ? "Mode démonstration" : "Hors ligne · local"}
        </Badge>
        <Badge variant={unlocked ? "success" : "warning"}>
          {unlocked ? "Coffre déverrouillé" : "Coffre verrouillé"}
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

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label={NOTIFICATION_LABELS[notifPermission]}
          title={NOTIFICATION_LABELS[notifPermission]}
          onClick={handleToggleNotifications}
        >
          <Bell
            className={`h-5 w-5 ${
              notifPermission === "granted"
                ? "text-success"
                : notifPermission === "denied"
                  ? "text-danger"
                  : "text-secondary"
            }`}
            aria-hidden
          />
        </Button>
        {notifMessage && (
          <div
            role="status"
            className="absolute right-0 top-12 z-50 w-64 rounded-xl border border-subtle bg-card p-3 text-xs text-secondary shadow-glow"
          >
            {notifMessage}
          </div>
        )}
      </div>

      <Button
        variant={unlocked ? "outline" : "primary"}
        size="sm"
        onClick={handleLock}
        aria-label={unlocked ? "Verrouiller le coffre" : "Coffre verrouillé"}
        title={unlocked ? "Verrouiller le coffre" : "Coffre verrouillé"}
      >
        {unlocked ? (
          <Unlock className="h-4 w-4" aria-hidden />
        ) : (
          <Lock className="h-4 w-4" aria-hidden />
        )}
        <span className="hidden sm:inline">{unlocked ? "Verrouiller" : "Verrouillé"}</span>
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
