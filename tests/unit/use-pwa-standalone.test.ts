/**
 * Tests — usePwaStandalone : détection du mode PWA standalone.
 *
 * Vérifie que le hook :
 * - retourne false par défaut (navigateur standard)
 * - retourne true quand display-mode: standalone/fullscreen/minimal-ui matche
 * - gère iOS Safari (navigator.standalone)
 * - enregistre et nettoie les listeners de changement
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePwaStandalone } from "@/hooks/use-pwa-standalone";

/** Crée un mock de MediaQueryList avec état contrôlable. */
function createMql(query: string, initialMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  // Utilise un getter/setter pour que .matches reflète toujours l'état courant
  let currentMatches = initialMatches;
  const mql = {
    get matches() {
      return currentMatches;
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn((_: string, cb: EventListenerOrEventListenerObject) => {
      listeners.add(cb as (e: MediaQueryListEvent) => void);
    }),
    removeEventListener: vi.fn((_: string, cb: EventListenerOrEventListenerObject) => {
      listeners.delete(cb as (e: MediaQueryListEvent) => void);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as MediaQueryList;
  return {
    mql,
    listeners,
    setMatches: (v: boolean) => {
      currentMatches = v;
      for (const cb of listeners) cb({ matches: v } as MediaQueryListEvent);
    },
  };
}

/** Installe un mock de matchMedia avec les display-modes donnés. */
function installMatchMedia(modes: Record<string, boolean>) {
  const mqls = new Map<string, ReturnType<typeof createMql>>();
  const mock = vi.fn((query: string) => {
    if (!mqls.has(query)) {
      mqls.set(query, createMql(query, modes[query] ?? false));
    }
    return mqls.get(query)!.mql;
  });
  Object.defineProperty(window, "matchMedia", { writable: true, value: mock });
  return { mock, mqls };
}

describe("usePwaStandalone", () => {
  const originalMatchMedia = window.matchMedia;
  const originalNavigator = window.navigator;

  beforeEach(() => {
    Object.defineProperty(window, "navigator", {
      writable: true,
      value: { ...originalNavigator },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "navigator", {
      writable: true,
      value: originalNavigator,
    });
    vi.restoreAllMocks();
  });

  it("retourne false en navigateur standard (aucun display-mode)", () => {
    installMatchMedia({});
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(false);
  });

  it("retourne true quand display-mode: standalone matche", () => {
    installMatchMedia({ "(display-mode: standalone)": true });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(true);
  });

  it("retourne true quand display-mode: fullscreen matche", () => {
    installMatchMedia({ "(display-mode: fullscreen)": true });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(true);
  });

  it("retourne true quand display-mode: minimal-ui matche", () => {
    installMatchMedia({ "(display-mode: minimal-ui)": true });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(true);
  });

  it("retourne true sur iOS Safari (navigator.standalone === true)", () => {
    installMatchMedia({});
    Object.defineProperty(window, "navigator", {
      writable: true,
      value: { ...originalNavigator, standalone: true },
    });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(true);
  });

  it("retourne false sur iOS Safari (navigator.standalone === false)", () => {
    installMatchMedia({});
    Object.defineProperty(window, "navigator", {
      writable: true,
      value: { ...originalNavigator, standalone: false },
    });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(false);
  });

  it("enregistre un listener 'change' sur chaque display-mode", () => {
    const { mqls } = installMatchMedia({});
    renderHook(() => usePwaStandalone());
    for (const mode of ["standalone", "fullscreen", "minimal-ui"]) {
      const entry = mqls.get(`(display-mode: ${mode})`);
      expect(entry).toBeDefined();
      expect(entry!.mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    }
  });

  it("met à jour quand le display-mode passe à standalone (via listener)", () => {
    const { mqls } = installMatchMedia({ "(display-mode: standalone)": false });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(false);

    // Simuler le passage en standalone
    const standalone = mqls.get("(display-mode: standalone)");
    act(() => {
      standalone!.setMatches(true);
    });
    expect(result.current).toBe(true);
  });

  it("met à jour quand le display-mode quitte standalone (via listener)", () => {
    const { mqls } = installMatchMedia({ "(display-mode: standalone)": true });
    const { result } = renderHook(() => usePwaStandalone());
    expect(result.current).toBe(true);

    // Simuler le retour au navigateur
    const standalone = mqls.get("(display-mode: standalone)");
    act(() => {
      standalone!.setMatches(false);
    });
    expect(result.current).toBe(false);
  });

  it("nettoie les listeners au démontage", () => {
    const { mqls } = installMatchMedia({});
    const { unmount } = renderHook(() => usePwaStandalone());
    unmount();
    for (const mode of ["standalone", "fullscreen", "minimal-ui"]) {
      const entry = mqls.get(`(display-mode: ${mode})`);
      expect(entry!.mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    }
  });
});
