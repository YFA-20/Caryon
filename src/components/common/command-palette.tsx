"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Loader2,
  NotebookPen,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { listApplications } from "@/lib/vault/application-repository";
import { listDocuments } from "@/lib/vault/document-repository";
import { listEvents } from "@/lib/vault/calendar-repository";
import { listGoals } from "@/lib/vault/goal-repository";
import { listJournalEntries } from "@/lib/vault/journal-repository";
import { listInterviewPreps } from "@/lib/vault/interview-repository";
import { globalSearch, type SearchResult, type SearchResultType } from "@/lib/search/global-search";
import { cn } from "@/lib/utils/cn";
import { useFocusTrap } from "@/hooks/use-focus-trap";

const TYPE_META: Record<SearchResultType, { icon: typeof Briefcase; label: string }> = {
  application: { icon: Briefcase, label: "Candidature" },
  document: { icon: FileText, label: "Document" },
  event: { icon: CalendarDays, label: "Événement" },
  goal: { icon: Target, label: "Objectif" },
  journal: { icon: NotebookPen, label: "Journal" },
  interview: { icon: Target, label: "Entretien" },
  page: { icon: LayoutDashboard, label: "Page" },
};

/**
 * Velora — palette de commandes (Ctrl+K / Cmd+K).
 *
 * Recherche globale instantanée dans toutes les collections chiffrées +
 * navigation clavier complète (flèches, Entrée, Échap). Aucune donnée
 * transmise — la recherche est 100% locale.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  // Données en mémoire (chargées à l'ouverture)
  const dataRef = useRef<Awaited<ReturnType<typeof loadAllData>> | null>(null);

  async function loadAllData() {
    const [applications, documents, events, goals, journalEntries, interviewPreps] =
      await Promise.all([
        listApplications(),
        listDocuments(),
        listEvents(),
        listGoals(),
        listJournalEntries(),
        listInterviewPreps(),
      ]);
    return {
      applications,
      documents,
      events,
      goals,
      journalEntries,
      interviewPreps,
      applicationsById: new Map(applications.map((a) => [a.id, a])),
    };
  }

  // Ouvrir/fermer avec Ctrl+K / Cmd+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Charger les données à l'ouverture
  useEffect(() => {
    if (!open || dataRef.current) return;
    setLoading(true);
    loadAllData()
      .then((data) => {
        dataRef.current = data;
      })
      .catch((err) => console.error("[palette] Erreur chargement:", err))
      .finally(() => setLoading(false));
  }, [open]);

  // Recherche à chaque changement de requête
  useEffect(() => {
    if (!open) return;
    const data = dataRef.current;
    if (!data) return;
    setResults(globalSearch(data, query));
    setActiveIndex(0);
  }, [query, open]);

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      dataRef.current = null; // libère la mémoire à la fermeture
    }
  }, [open]);

  // Navigation clavier dans les résultats
  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const result = results[activeIndex];
        if (result) {
          router.push(result.href);
          setOpen(false);
        }
      }
    },
    [results, activeIndex, router]
  );

  // Scroll l'élément actif dans la vue
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const groupedResults = useMemo(() => results, [results]);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Recherche globale"
      tabIndex={-1}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-subtle bg-card shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barre de recherche */}
        <div className="flex items-center gap-3 border-b border-subtle px-4">
          <Search className="h-5 w-5 shrink-0 text-secondary" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Rechercher candidatures, documents, événements…"
            className="h-14 w-full bg-transparent text-primary placeholder:text-secondary/60 focus:outline-none"
            aria-label="Recherche globale"
            aria-autocomplete="list"
            aria-controls="command-palette-results"
          />
          {loading && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-lavender" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer"
            className="shrink-0 rounded-lg p-1 text-secondary hover:text-primary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Résultats */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() === "" ? (
            <p className="px-3 py-8 text-center text-sm text-secondary">
              Tapez pour rechercher dans vos candidatures, documents, événements, objectifs et
              journal. Navigation : ↑↓, sélection : Entrée.
            </p>
          ) : groupedResults.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-secondary">
              Aucun résultat pour « {query} ».
            </p>
          ) : (
            <ul ref={listRef} id="command-palette-results" role="listbox" className="space-y-1">
              {groupedResults.map((result, i) => {
                const meta = TYPE_META[result.type];
                const Icon = meta.icon;
                return (
                  <li key={result.id} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(result.href);
                        setOpen(false);
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={cn(
                        "transition-velora flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left",
                        i === activeIndex ? "bg-card-elevated text-primary" : "text-secondary"
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface">
                        <Icon className="h-4 w-4 text-lavender" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{result.title}</p>
                        <p className="truncate text-xs text-secondary">{result.subtitle}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-secondary">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer raccourcis */}
        <div className="flex items-center justify-between border-t border-subtle px-4 py-2 text-[11px] text-secondary">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-surface px-1.5 py-0.5">↑↓</kbd> naviguer
            </span>
            <span>
              <kbd className="rounded bg-surface px-1.5 py-0.5">Entrée</kbd> ouvrir
            </span>
            <span>
              <kbd className="rounded bg-surface px-1.5 py-0.5">Échap</kbd> fermer
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" aria-hidden />
            100% local
          </span>
        </div>
      </div>
    </div>
  );
}
