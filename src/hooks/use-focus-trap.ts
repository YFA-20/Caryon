"use client";

import { useEffect, useRef } from "react";

/**
 * Velora — focus trap pour les modales (WCAG 2.4.3).
 *
 * Quand `active` est vrai :
 * - le focus est déplacé sur le premier élément focusable du conteneur
 * - Tab / Shift+Tab bouclent à l'intérieur du conteneur
 * - à la désactivation, le focus revient sur l'élément qui avait le focus avant
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;
    const el = container;

    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const focusables = Array.from(el.querySelectorAll<HTMLElement>(focusableSelector));
    const first = focusables[0];
    if (first) {
      first.focus();
    } else {
      el.focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const current = el.querySelectorAll<HTMLElement>(focusableSelector);
      if (current.length === 0) return;
      const firstEl = current[0]!;
      const lastEl = current[current.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    el.addEventListener("keydown", handleKeyDown);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active]);

  return containerRef;
}
