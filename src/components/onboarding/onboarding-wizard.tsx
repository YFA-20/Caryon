"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CheckCircle2,
  FileText,
  Lock,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getSettings, saveSettings } from "@/lib/vault/goal-repository";
import { requestNotificationPermission } from "@/lib/notifications/notification-service";
import { cn } from "@/lib/utils/cn";

interface Step {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  bullets: string[];
}

const STEPS: Step[] = [
  {
    id: "welcome",
    icon: Sparkles,
    title: "Bienvenue dans Velora",
    description:
      "Votre espace privé pour gérer vos candidatures. Tout est chiffré sur votre appareil — aucune donnée ne quitte votre navigateur.",
    bullets: [
      "Chiffrement AES-256-GCM de toutes vos données",
      "Fonctionne 100% hors ligne",
      "Vos données restent sur cet appareil",
    ],
  },
  {
    id: "features",
    icon: Briefcase,
    title: "Vos outils au quotidien",
    description: "Découvrez les fonctionnalités principales pour organiser votre recherche.",
    bullets: [
      "Kanban des candidatures (glisser-déposer entre les statuts)",
      "Calendrier des entretiens, relances et échéances",
      "Recherche globale instantanée (Ctrl+K)",
      "Documents chiffrés (CV, lettres, diplômes)",
      "Statistiques et objectifs de progression",
    ],
  },
  {
    id: "security",
    icon: Lock,
    title: "Votre coffre-fort",
    description:
      "Votre phrase secrète protège vos données. Elle n'est jamais stockée ni transmise.",
    bullets: [
      "Verrouillage manuel ou automatique (15 min par défaut)",
      "Sauvegarde chiffrée exportable (.velora)",
      "Restauration sur un nouvel appareil",
      "Sans votre phrase, vos données sont irrécupérables",
    ],
  },
];

/**
 * Velora — wizard d'onboarding (3 étapes).
 *
 * S'affiche automatiquement après la création du coffre (première utilisation),
 * si `onboardingCompleted` est false dans les paramètres chiffrés.
 * L'utilisateur peut sauter à tout moment.
 */
export function OnboardingWizard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [enablingNotifs, setEnablingNotifs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled && !settings.onboardingCompleted) {
          setOpen(true);
        }
      })
      .catch(() => {
        /* erreur silencieuse — pas d'onboarding si lecture impossible */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback(async () => {
    try {
      await saveSettings({ onboardingCompleted: true });
    } catch (err) {
      console.error("[onboarding] Erreur sauvegarde:", err);
    }
    setOpen(false);
  }, []);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  async function handleEnableNotifications() {
    setEnablingNotifs(true);
    try {
      await requestNotificationPermission();
    } finally {
      setEnablingNotifs(false);
    }
  }

  if (!open) return null;

  const currentStep = STEPS[step]!;
  const Icon = currentStep.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Guide de démarrage"
    >
      <Card className="relative w-full max-w-lg p-8">
        <button
          type="button"
          onClick={skip}
          aria-label="Passer le guide"
          className="transition-velora absolute right-4 top-4 rounded-lg p-1.5 text-secondary hover:text-primary"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        {/* Indicateur d'étapes */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "transition-velora h-1.5 flex-1 rounded-full",
                i <= step ? "bg-lavender" : "bg-card-elevated"
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-card-elevated shadow-glow">
            <Icon className="h-8 w-8 text-rose" aria-hidden />
          </div>
          <CardTitle className="mt-4 font-serif text-2xl">{currentStep.title}</CardTitle>
          <CardDescription className="mt-2">{currentStep.description}</CardDescription>
        </div>

        <ul className="mt-6 space-y-2.5">
          {currentStep.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-secondary">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              {bullet}
            </li>
          ))}
        </ul>

        {/* Étape finale : actions concrètes */}
        {isLast && (
          <div className="mt-6 space-y-3 rounded-xl border border-subtle bg-background/40 p-4">
            <p className="text-sm font-medium text-primary">Pour bien démarrer :</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleEnableNotifications}
                disabled={enablingNotifs}
              >
                <Bell className="h-3.5 w-3.5" aria-hidden />
                Activer les rappels
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  complete();
                  router.push("/candidatures?new=1");
                }}
              >
                <Briefcase className="h-3.5 w-3.5" aria-hidden />
                Créer une candidature
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  complete();
                  router.push("/documents");
                }}
              >
                <FileText className="h-3.5 w-3.5" aria-hidden />
                Importer un document
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  complete();
                  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
                }}
              >
                <Search className="h-3.5 w-3.5" aria-hidden />
                Essayer la recherche (Ctrl+K)
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={skip}>
            Passer
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Précédent
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={complete}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Commencer
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Suivant
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
