"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/store/ui-store";
import { NAV_GROUPS } from "./nav-items";

/**
 * Velora — drawer de navigation mobile (panneau latéral).
 *
 * Le bouton hamburger (☰) est rendu séparément dans le Header.
 * Ce composant rend :
 * - L'overlay sombre (cliquable pour fermer)
 * - Le panneau latéral avec les 3 groupes de navigation (Mon espace,
 *   Ma carrière, Mon coffre-fort) — identique à la sidebar desktop.
 *
 * Visible uniquement sur mobile (`md:hidden`).
 *
 * Comportement :
 * - Overlay cliquable pour fermer
 * - Bouton ✕ dans le drawer pour fermer
 * - Fermeture automatique à la navigation (changement de pathname)
 * - Fermeture avec la touche Échap
 * - `overflow-hidden` sur le body quand ouvert (bloque le scroll)
 */
export function MobileDrawer() {
  const pathname = usePathname();
  const { drawerOpen, setDrawerOpen } = useUiStore();

  // Ferme le drawer à chaque changement de page
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname, setDrawerOpen]);

  // Bloque le scroll du body quand le drawer est ouvert + Échap pour fermer
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") setDrawerOpen(false);
      }
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [drawerOpen, setDrawerOpen]);

  return (
    <>
      {/* Overlay — visible uniquement sur mobile quand ouvert */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer — panneau latéral gauche, visible uniquement sur mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-subtle bg-surface transition-transform duration-300 ease-out md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Menu de navigation"
        aria-hidden={!drawerOpen}
      >
        {/* Header du drawer : logo + bouton fermer */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-subtle px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card-elevated shadow-glow">
            <span className="font-serif text-xl font-bold text-rose" aria-hidden>
              V
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-xl font-semibold leading-none text-primary">Velora</p>
            <p className="mt-1 text-[11px] leading-tight text-secondary">
              Votre carrière, votre espace privé
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fermer le menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-secondary transition-colors hover:bg-card hover:text-primary"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Navigation — les 3 groupes, scrollable */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-secondary/70">
                {group.title}
              </p>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "transition-velora flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                          active
                            ? "bg-card-elevated text-primary shadow-glow"
                            : "text-secondary hover:bg-card hover:text-primary"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer du drawer : statut coffre */}
        <div className="shrink-0 border-t border-subtle p-4">
          <div className="card flex items-center gap-3 p-3">
            <Lock className="h-4 w-4 shrink-0 text-lavender" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-medium text-primary">Coffre verrouillé</p>
              <p className="truncate text-[11px] text-secondary">Vos données sont chiffrées</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
