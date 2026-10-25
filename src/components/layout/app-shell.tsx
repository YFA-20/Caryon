"use client";

import type { ReactNode } from "react";
import { Header } from "./header";
import { MobileDrawer } from "./mobile-drawer";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { PwaRegister } from "@/components/pwa-register";
import { CommandPalette } from "@/components/common/command-palette";
import { ToastContainer } from "@/components/common/toast-container";
import { DemoBanner } from "@/components/common/demo-banner";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

/**
 * Velora — shell applicatif : sidebar (desktop) + drawer + barre inférieure (mobile) + header.
 *
 * Intègre les hooks transverses actifs quand le coffre est déverrouillé :
 * - useAutoLock : verrouillage automatique après inactivité
 * - useNotificationScheduler : rappels locaux des événements à venir
 * - CommandPalette : recherche globale Ctrl+K
 */
export function AppShell({ children }: { children: ReactNode }) {
  useAutoLock();
  useNotificationScheduler();
  useGlobalShortcuts();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <DemoBanner />
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>
      <MobileDrawer />
      <MobileNav />
      <PwaRegister />
      <CommandPalette />
      <ToastContainer />
      <OnboardingWizard />
    </div>
  );
}
