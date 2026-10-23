"use client";

import type { ReactNode } from "react";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { PwaRegister } from "@/components/pwa-register";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";

/**
 * Velora — shell applicatif : sidebar (desktop) + barre inférieure (mobile) + header.
 *
 * Intègre les hooks transverses actifs quand le coffre est déverrouillé :
 * - useAutoLock : verrouillage automatique après inactivité
 * - useNotificationScheduler : rappels locaux des événements à venir
 */
export function AppShell({ children }: { children: ReactNode }) {
  useAutoLock();
  useNotificationScheduler();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>
      <MobileNav />
      <PwaRegister />
    </div>
  );
}
