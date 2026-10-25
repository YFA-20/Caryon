/**
 * Velora — persistance UI (sessionStorage).
 *
 * Stocke les préférences d'affichage (vue, recherche, filtres, tri) dans
 * sessionStorage pour les restaurer après un F5 / rechargement.
 *
 * RÈGLE DE CONFIDENTIALITÉ :
 * - sessionStorage (pas localStorage) : effacé à la fermeture de l'onglet,
 *   donc les recherches personnelles ne survivent pas à la session.
 * - Jamais dans l'URL : les recherches peuvent contenir des noms d'entreprises,
 *   de personnes, etc.
 * - Clés préfixées `velora:` pour éviter les collisions.
 * - Les données sont du texte en clair mais éphémères (session uniquement).
 *   C'est un compromis acceptable : la recherche est un état UI, pas une donnée
 *   métier. Les vraies données (candidatures) restent chiffrées dans IndexedDB.
 *
 * Ce qui est persisté : vue (kanban/liste/tableau), recherche, filtre statut,
 * tri, filtres avancés du tableau.
 * Ce qui n'est PAS persisté : formulaire ouvert, élément en édition, etc.
 */

const PREFIX = "velora:ui:";

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, value);
  } catch {
    // sessionStorage indisponible — ignore silencieusement
  }
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

// ── API générique ──────────────────────────────────────────────────────────

export function persistUiState<T>(key: string, value: T): void {
  safeSet(key, JSON.stringify(value));
}

export function restoreUiState<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function clearUiState(key: string): void {
  safeRemove(key);
}

// ── Clés spécifiques candidatures ──────────────────────────────────────────

export const CANDIDATURES_VIEW_KEY = "candidatures:view";
export const CANDIDATURES_SEARCH_KEY = "candidatures:search";
export const CANDIDATURES_STATUS_FILTER_KEY = "candidatures:statusFilter";
export const CANDIDATURES_SORT_KEY = "candidatures:sort";
export const CANDIDATURES_TABLE_FILTERS_KEY = "candidatures:tableFilters";
