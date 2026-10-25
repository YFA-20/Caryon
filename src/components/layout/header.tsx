"use client";

import { useEffect, useState } from "react";
import { Bell, FlaskConical, Lock, Menu, Smartphone, Unlock } from "lucide-react";
import { useUiStore } from "@/store/ui-store";
import { useVaultStore } from "@/store/vault-store";
import { forceLock } from "@/lib/vault/vault-service";
import { clearDemoData, seedDemoData, hasExistingData } from "@/lib/vault/demo-data-service";
import { getSettings, saveSettings } from "@/lib/vault/goal-repository";
import { toastSuccess, toastError } from "@/store/toast-store";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  type NotificationPermissionState,
} from "@/lib/notifications/notification-service";
import { formatDateFr, todayIso } from "@/lib/utils/date";
import { usePwaStandalone } from "@/hooks/use-pwa-standalone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NOTIFICATION_LABELS: Record<NotificationPermissionState, string> = {
  granted: "Notifications activées",
  denied: "Notifications bloquées",
  default: "Activer les notifications",
  unsupported: "Notifications indisponibles",
};

export function Header() {
  const { demoMode, drawerOpen, firstName, setDemoMode, setDrawerOpen } = useUiStore();
  const { status } = useVaultStore();
  const unlocked = status === "unlocked";
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [notifMessage, setNotifMessage] = useState<string | null>(null);
  const [exitingDemo, setExitingDemo] = useState(false);
  const [enteringDemo, setEnteringDemo] = useState(false);
  const isPwaStandalone = usePwaStandalone();

  // Synchronise demoMode depuis les settings chiffrés au chargement.
  // Le store UI part à false par défaut ; sans cette synchro, le bouton
  // "Quitter la démo" n'apparaît pas après un F5 si le mode était déjà actif.
  useEffect(() => {
    getSettings()
      .then((s) => setDemoMode(s.demoMode))
      .catch(() => {});
  }, [setDemoMode]);

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
    forceLock();
  }

  /**
   * Quitte le mode démonstration depuis le header :
   * 1. Supprime TOUTES les données fictives (clearDemoData)
   * 2. Désactive demoMode dans les settings chiffrés
   * 3. Met à jour le store UI
   */
  async function handleExitDemo() {
    if (exitingDemo) return;
    setExitingDemo(true);
    try {
      const result = await clearDemoData();
      await saveSettings({ demoMode: false });
      setDemoMode(false);
      const total =
        result.applications +
        result.documents +
        result.events +
        result.goals +
        result.journalEntries +
        result.interviewPreps;
      toastSuccess(
        total > 0
          ? `Mode démonstration quitté. ${total} données fictives supprimées.`
          : "Mode démonstration quitté."
      );
    } catch (err) {
      console.error("[header] Erreur sortie démo:", err);
      toastError("Erreur lors de la sortie du mode démonstration.");
    } finally {
      setExitingDemo(false);
    }
  }

  /**
   * Active le mode démonstration depuis le header.
   * Comportement IDENTIQUE à /parametres :
   * - Si des données réelles existent, on avertit (toast) et on n'active pas.
   * - Sinon on seed les données fictives + saveSettings + setDemoMode.
   *
   * ⚠️ Ne touche pas au comportement du mode démo, juste un raccourci.
   */
  async function handleEnterDemo() {
    if (enteringDemo) return;
    setEnteringDemo(true);
    try {
      const dataExists = await hasExistingData();
      if (dataExists) {
        toastError(
          "Vous avez déjà des données réelles. Désactivez d'abord le mode démo depuis les paramètres, ou supprimez vos données."
        );
        return;
      }
      const result = await seedDemoData();
      await saveSettings({ demoMode: true });
      setDemoMode(true);
      toastSuccess(
        `Mode démonstration activé : ${result.applications} candidatures, ${result.documents} documents, ${result.events} événements créés.`
      );
    } catch (err) {
      console.error("[header] Erreur activation démo:", err);
      toastError("Erreur lors de l'activation du mode démonstration.");
    } finally {
      setEnteringDemo(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-subtle bg-surface/80 px-3 backdrop-blur-md sm:gap-4 md:px-8">
      {/* Bouton hamburger — visible uniquement sur mobile */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Ouvrir le menu de navigation"
        aria-expanded={drawerOpen}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-secondary transition-colors hover:bg-card hover:text-primary md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-secondary">{formatDateFr(todayIso())}</p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        {isPwaStandalone && (
          <span
            className="flex items-center gap-1 text-lavender"
            title="Application installée (mode PWA)"
            role="img"
            aria-label="Application installée"
          >
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
        )}
        <Badge variant={demoMode ? "lavender" : "default"}>
          {demoMode ? "Mode démonstration" : "Hors ligne · local"}
        </Badge>
        <Badge variant={unlocked ? "success" : "warning"}>
          {unlocked ? "Coffre déverrouillé" : "Coffre verrouillé"}
        </Badge>
      </div>

      {/* Icône PWA — visible quand l'app est installée (tous écrans) */}
      {isPwaStandalone && (
        <span
          className="flex h-9 w-9 items-center justify-center text-lavender sm:hidden"
          title="Application installée (mode PWA)"
          role="img"
          aria-label="Application installée"
        >
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>
      )}

      {/* Bouton Mode démo — visible quand le mode est INACTIF */}
      {!demoMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleEnterDemo}
          disabled={enteringDemo}
          title="Activer le mode démonstration (données fictives)"
        >
          <FlaskConical className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{enteringDemo ? "Activation…" : "Mode démo"}</span>
        </Button>
      )}

      {/* Bouton Quitter la démo — visible quand le mode est ACTIF */}
      {demoMode && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExitDemo}
          disabled={exitingDemo}
          title="Quitter le mode démonstration et supprimer les données fictives"
        >
          <FlaskConical className="h-4 w-4" aria-hidden />
          {exitingDemo ? "Nettoyage…" : "Quitter la démo"}
        </Button>
      )}

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
        className="hidden h-9 w-9 items-center justify-center rounded-full bg-card-elevated text-sm font-semibold text-rose shadow-glow sm:flex"
        aria-hidden
      >
        {(firstName || "V").charAt(0).toUpperCase()}
      </div>
    </header>
  );
}
