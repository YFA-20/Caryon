/**
 * Velora — définition partagée des groupes de navigation.
 *
 * Utilisé par :
 * - `Sidebar` (desktop, `md:flex`)
 * - `MobileDrawer` (mobile, drawer hamburger)
 *
 * Ne pas dupliquer cette liste : la modifier ici met à jour les deux navigations.
 */
import {
  Briefcase,
  CalendarDays,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Mon espace",
    items: [
      { label: "Aujourd'hui", href: "/", icon: LayoutDashboard },
      { label: "Mes candidatures", href: "/candidatures", icon: Briefcase },
      { label: "Calendrier", href: "/calendrier", icon: CalendarDays },
      { label: "Mes documents", href: "/documents", icon: FileText },
      { label: "Journal de recherche", href: "/journal", icon: NotebookPen },
    ],
  },
  {
    title: "Ma carrière",
    items: [
      { label: "Explorer les offres", href: "/offres", icon: Sparkles },
      { label: "Assistant IA", href: "/ia", icon: Sparkles },
      { label: "Préparer un entretien", href: "/entretien", icon: Target },
      { label: "Analyses", href: "/analyses", icon: TrendingUp },
      { label: "Mes objectifs", href: "/objectifs", icon: Target },
    ],
  },
  {
    title: "Mon coffre-fort",
    items: [
      { label: "Sécurité et confidentialité", href: "/securite", icon: ShieldCheck },
      { label: "Sauvegardes", href: "/sauvegardes", icon: Save },
      { label: "Paramètres", href: "/parametres", icon: Settings },
    ],
  },
];
