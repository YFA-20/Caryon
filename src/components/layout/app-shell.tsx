"use client";

import type { ReactNode } from "react";
import { Header } from "./header";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar } from "./sidebar";
import { PwaRegister } from "@/components/pwa-register";
import { CommandPalette } from "@/components/common/command-palette";
import { ToastContainer } from "@/components/common/toast-container";
import { DemoBanner } from "@/components/common/demo-banner";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useAutoSync } from "@/hooks/use-auto-sync";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";

/**
 * Velora — shell applicatif : sidebar (desktop) + drawer hamburger (mobile) + header.
 *
 * Intègre les hooks transverses actifs quand le coffre est déverrouillé :
 * - useAutoLock : verrouillage automatique après inactivité
 * - useAutoSync : synchronisation multi-appareils (périodique + focus)
 * - useNotificationScheduler : rappels locaux des événements à venir
 * - CommandPalette : recherche globale Ctrl+K
 */
export function AppShell({ children }: { children: ReactNode }) {
  useAutoLock();
  useAutoSync();
  useNotificationScheduler();
  useGlobalShortcuts();

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-lavender focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
      >
        Aller au contenu principal
      </a>
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <DemoBanner />
        <main id="main-content" className="flex-1 pb-10" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MobileDrawer />
      <PwaRegister />
      <CommandPalette />
      <ToastContainer />
      <OnboardingWizard />
    </div>
  );
}
