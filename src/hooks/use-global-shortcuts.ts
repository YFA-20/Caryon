"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useVaultStore } from "@/store/vault-store";

/**
 * Velora — raccourcis clavier globaux.
 *
 * - N           → Nouvelle candidature (depuis n'importe où)
 * - /           → Ouvrir la recherche globale (équivalent Ctrl+K)
 * - g h         → Accueil (dashboard)
 * - g c         → Candidatures
 * - g k         → Calendrier
 * - g d         → Documents
 * - g j         → Journal
 * - g o         → Offres
 * - g e         → Entretien
 * - g a         → Analyses
 * - g t         → Objectifs
 * - g s         → Sécurité
 * - g b         → Sauvegardes
 * - g p         → Paramètres
 * - ?           → (réservé aide — affiche les raccourcis dans la palette)
 *
 * Les raccourcis sont désactivés quand :
 * - le coffre est verrouillé
 * - le focus est dans un champ de saisie (input, textarea, select, contentEditable)
 * - une touche modificatrice (Ctrl, Alt, Meta) est pressée (sauf pour les combos g X)
 */

const NAV_SHORTCUTS: Record<string, string> = {
  h: "/",
  c: "/candidatures",
  k: "/calendrier",
  d: "/documents",
  j: "/journal",
  o: "/offres",
  e: "/entretien",
  a: "/analyses",
  t: "/objectifs",
  s: "/securite",
  b: "/sauvegardes",
  p: "/parametres",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useGlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const status = useVaultStore((s) => s.status);

  useEffect(() => {
    if (status !== "unlocked") return;

    let pendingG = false;
    let pendingGTimer: ReturnType<typeof setTimeout> | null = null;

    function resetPendingG() {
      pendingG = false;
      if (pendingGTimer) clearTimeout(pendingGTimer);
      pendingGTimer = null;
    }

    function onKeyDown(e: KeyboardEvent) {
      // Ignorer si champ éditable (sauf Échap qui ferme toujours)
      if (isEditableTarget(e.target) && e.key !== "Escape") return;

      // Ignorer avec modificateurs (sauf notre propre logique g X)
      const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

      // Séquence « g » puis lettre
      if (!hasModifier && e.key === "g") {
        pendingG = true;
        if (pendingGTimer) clearTimeout(pendingGTimer);
        pendingGTimer = setTimeout(resetPendingG, 1000);
        e.preventDefault();
        return;
      }

      if (pendingG && !hasModifier && e.key.length === 1) {
        const href = NAV_SHORTCUTS[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          if (href !== pathname) router.push(href);
        }
        resetPendingG();
        return;
      }

      // Raccourcis directs (sans modificateur)
      if (!hasModifier) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            router.push("/candidatures?new=1");
            return;
          case "/":
            e.preventDefault();
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
            return;
          case "Escape":
            resetPendingG();
            return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (pendingGTimer) clearTimeout(pendingGTimer);
    };
  }, [status, router, pathname]);
}
