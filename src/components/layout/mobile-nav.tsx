"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CalendarDays, FileText, LayoutDashboard, NotebookPen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const ITEMS = [
  { label: "Accueil", href: "/", icon: LayoutDashboard },
  { label: "Candidatures", href: "/candidatures", icon: Briefcase },
  { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Journal", href: "/journal", icon: NotebookPen },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-subtle bg-surface/95 backdrop-blur-md md:hidden"
      aria-label="Navigation mobile"
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "transition-velora flex flex-col items-center gap-1 py-2 text-[11px]",
                  active ? "text-rose" : "text-secondary"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
