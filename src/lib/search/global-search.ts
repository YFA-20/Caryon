/**
 * Velora — recherche globale locale (100% offline).
 *
 * Cherche dans TOUTES les collections chiffrées (candidatures, documents,
 * événements, objectifs, journal, fiches d'entretien) et retourne des
 * résultats unifiés avec type, titre, sous-titre et score de pertinence.
 *
 * Aucune donnée n'est transmise. La recherche s'effectue sur les données
 * déchiffrées en mémoire.
 */
import type { Application } from "@/lib/schema/application";
import type { Document } from "@/lib/schema/document";
import type { CalendarEvent } from "@/lib/schema/calendar";
import type { Goal } from "@/lib/schema/goal";
import type { JournalEntry } from "@/lib/schema/journal";
import type { InterviewPrep } from "@/lib/schema/interview";

export type SearchResultType =
  "application" | "document" | "event" | "goal" | "journal" | "interview" | "page";

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  /** Chemin de navigation. */
  href: string;
  /** Score de pertinence (plus haut = plus pertinent). */
  score: number;
  /** ID de l'entité liée (pour deep-link avec query param). */
  entityId?: string;
}

export interface SearchableData {
  applications: Application[];
  documents: Document[];
  events: CalendarEvent[];
  goals: Goal[];
  journalEntries: JournalEntry[];
  interviewPreps: InterviewPrep[];
  /** Candidatures indexées par id pour résoudre les noms dans les preps. */
  applicationsById: Map<string, Application>;
}

/** Pages statiques de navigation (pour les actions rapides). */
const STATIC_PAGES: SearchResult[] = [
  {
    id: "page-dashboard",
    type: "page",
    title: "Aujourd'hui",
    subtitle: "Tableau de bord",
    href: "/",
    score: 0,
  },
  {
    id: "page-candidatures",
    type: "page",
    title: "Mes candidatures",
    subtitle: "Kanban, liste, filtres",
    href: "/candidatures",
    score: 0,
  },
  {
    id: "page-calendrier",
    type: "page",
    title: "Calendrier",
    subtitle: "Entretiens, relances, échéances",
    href: "/calendrier",
    score: 0,
  },
  {
    id: "page-documents",
    type: "page",
    title: "Mes documents",
    subtitle: "CV, lettres, diplômes chiffrés",
    href: "/documents",
    score: 0,
  },
  {
    id: "page-journal",
    type: "page",
    title: "Journal de recherche",
    subtitle: "Réflexions et bilans",
    href: "/journal",
    score: 0,
  },
  {
    id: "page-offres",
    type: "page",
    title: "Explorer les offres",
    subtitle: "Analyser une offre (local)",
    href: "/offres",
    score: 0,
  },
  {
    id: "page-entretien",
    type: "page",
    title: "Préparer un entretien",
    subtitle: "Fiches de préparation",
    href: "/entretien",
    score: 0,
  },
  {
    id: "page-analyses",
    type: "page",
    title: "Analyses",
    subtitle: "Statistiques locales",
    href: "/analyses",
    score: 0,
  },
  {
    id: "page-objectifs",
    type: "page",
    title: "Mes objectifs",
    subtitle: "Suivi de progression",
    href: "/objectifs",
    score: 0,
  },
  {
    id: "page-securite",
    type: "page",
    title: "Sécurité et confidentialité",
    subtitle: "Audit local",
    href: "/securite",
    score: 0,
  },
  {
    id: "page-sauvegardes",
    type: "page",
    title: "Sauvegardes",
    subtitle: "Export/import chiffré",
    href: "/sauvegardes",
    score: 0,
  },
  {
    id: "page-appairage",
    type: "page",
    title: "Appairage",
    subtitle: "Synchronisation multi-appareils",
    href: "/appairage",
    score: 0,
  },
  {
    id: "page-parametres",
    type: "page",
    title: "Paramètres",
    subtitle: "Préférences",
    href: "/parametres",
    score: 0,
  },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Score de pertinence : correspondance exacte > début de mot > sous-chaîne.
 * 0 = aucune correspondance.
 */
export function scoreMatch(query: string, ...fields: string[]): number {
  const q = normalize(query).trim();
  if (!q) return 0;

  let best = 0;
  for (const field of fields) {
    const f = normalize(field);
    if (!f) continue;

    if (f === q) {
      best = Math.max(best, 100);
    } else if (f.startsWith(q)) {
      best = Math.max(best, 80);
    } else if (f.includes(` ${q}`) || f.includes(`-${q}`) || f.includes(`_${q}`)) {
      // Début de mot (séparé par espace/tiret/underscore)
      best = Math.max(best, 60);
    } else if (f.includes(q)) {
      best = Math.max(best, 40);
    }

    // Bonus si la correspondance est en début de champ
    if (f.startsWith(q)) best += 5;
  }
  return best;
}

/**
 * Recherche globale dans toutes les collections.
 * Retourne les résultats triés par score décroissant, limités à `limit`.
 */
export function globalSearch(data: SearchableData, query: string, limit = 20): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Candidatures
  for (const app of data.applications) {
    const score = scoreMatch(
      q,
      app.company,
      app.position,
      app.location ?? "",
      app.source ?? "",
      app.contactName ?? "",
      app.notes,
      ...app.tags
    );
    if (score > 0) {
      results.push({
        id: `app-${app.id}`,
        type: "application",
        title: `${app.position} — ${app.company}`,
        subtitle: `Candidature · ${app.location || "lieu non renseigné"}`,
        href: "/candidatures",
        score,
        entityId: app.id,
      });
    }
  }

  // Documents
  for (const doc of data.documents) {
    const score = scoreMatch(q, doc.name, ...doc.tags);
    if (score > 0) {
      results.push({
        id: `doc-${doc.id}`,
        type: "document",
        title: doc.name,
        subtitle: `Document · ${(doc.sizeBytes / 1024).toFixed(0)} Ko`,
        href: "/documents",
        score,
        entityId: doc.id,
      });
    }
  }

  // Événements
  for (const ev of data.events) {
    const score = scoreMatch(q, ev.title, ev.notes);
    if (score > 0) {
      results.push({
        id: `evt-${ev.id}`,
        type: "event",
        title: ev.title,
        subtitle: `Événement · ${new Date(ev.startAt).toLocaleDateString("fr-FR")}`,
        href: "/calendrier",
        score,
        entityId: ev.id,
      });
    }
  }

  // Objectifs
  for (const goal of data.goals) {
    const score = scoreMatch(q, goal.title, goal.description);
    if (score > 0) {
      results.push({
        id: `goal-${goal.id}`,
        type: "goal",
        title: goal.title,
        subtitle: `Objectif · cible ${goal.target}`,
        href: "/objectifs",
        score,
        entityId: goal.id,
      });
    }
  }

  // Journal
  for (const entry of data.journalEntries) {
    const score = scoreMatch(q, entry.title, entry.content, ...entry.tags);
    if (score > 0) {
      results.push({
        id: `journal-${entry.id}`,
        type: "journal",
        title: entry.title,
        subtitle: `Journal · ${new Date(entry.date).toLocaleDateString("fr-FR")}`,
        href: "/journal",
        score,
        entityId: entry.id,
      });
    }
  }

  // Fiches d'entretien (résolution du nom via la candidature liée)
  for (const prep of data.interviewPreps) {
    const app = data.applicationsById.get(prep.applicationId);
    const appLabel = app ? `${app.position} — ${app.company}` : "Candidature";
    const score = scoreMatch(q, appLabel, prep.companyResearch, prep.postNotes);
    if (score > 0) {
      results.push({
        id: `prep-${prep.id}`,
        type: "interview",
        title: `Préparation — ${appLabel}`,
        subtitle: "Fiche d'entretien",
        href: "/entretien",
        score,
        entityId: prep.id,
      });
    }
  }

  // Pages statiques (correspondance sur le titre)
  for (const page of STATIC_PAGES) {
    const score = scoreMatch(q, page.title, page.subtitle);
    if (score > 0) {
      results.push({ ...page, score });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
