"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Search, Unlock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useVaultStore } from "@/store/vault-store";
import { NAV_GROUPS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { status } = useVaultStore();
  const unlocked = status === "unlocked";
  return (
    <aside
      className="hidden w-72 shrink-0 flex-col border-r border-subtle bg-surface md:flex"
      aria-label="Navigation principale"
    >
      <div className="flex h-20 items-center gap-3 border-b border-subtle px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card-elevated shadow-glow">
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
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))
          }
          aria-label="Recherche globale (Ctrl+K)"
          title="Recherche globale (Ctrl+K)"
          className="transition-velora flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-subtle bg-card px-2 text-[11px] text-secondary hover:text-primary"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <kbd className="rounded bg-surface px-1 font-sans">Ctrl K</kbd>
        </button>
      </div>

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
                        "transition-velora flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
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

      <div className="border-t border-subtle p-4">
        <div className="card flex items-center gap-3 p-3">
          {unlocked ? (
            <Unlock className="h-4 w-4 shrink-0 text-success" aria-hidden />
          ) : (
            <Lock className="h-4 w-4 shrink-0 text-lavender" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              {unlocked ? "Coffre déverrouillé" : "Coffre verrouillé"}
            </p>
            <p className="truncate text-[11px] text-secondary">Vos données sont chiffrées</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
