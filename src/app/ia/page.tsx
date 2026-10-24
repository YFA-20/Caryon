"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  FileText,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getSettings } from "@/lib/vault/goal-repository";
import { getAiAvailability, type AiAvailability } from "@/lib/ai/ai-service";

interface AiFeature {
  icon: typeof Sparkles;
  title: string;
  description: string;
  href: string;
  available: boolean;
}

const AI_FEATURES: Omit<AiFeature, "available">[] = [
  {
    icon: Briefcase,
    title: "Analyser une offre",
    description:
      "Collez une offre d'emploi pour en extraire le poste, les compétences requises, le salaire et les avantages. Pré-remplissez une candidature en un clic.",
    href: "/offres",
  },
  {
    icon: FileText,
    title: "Comparer CV ↔ Offre",
    description:
      "L'IA compare votre CV avec une offre et identifie les compétences présentes, manquantes et transversales. Suggestions d'amélioration personnalisées.",
    href: "/documents",
  },
  {
    icon: PenLine,
    title: "Générer une lettre",
    description:
      "Rédigez une lettre de motivation personnalisée à partir de l'offre et de votre profil. Toujours en brouillon — vous éditez avant d'envoyer.",
    href: "/candidatures",
  },
  {
    icon: MessageSquare,
    title: "Préparer un entretien",
    description:
      "Générez des questions probables et des suggestions de réponses basées sur l'offre et votre profil. Arrivez préparé.",
    href: "/entretien",
  },
];

export default function IaPage() {
  const [availability, setAvailability] = useState<AiAvailability | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [settings, av] = await Promise.all([getSettings(), getAiAvailability()]);
      setAvailability({ ...av, consentGiven: settings.aiConsent });
      setLoading(false);
    })();
  }, []);

  const ready =
    availability?.consentGiven && (availability.localAvailable || availability.cloudAvailable);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
        {/* En-tête */}
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Assistant IA</h1>
          <p className="mt-2 text-secondary">
            Votre copilote de carrière intelligent. Analyse, comparaison, génération — avec votre
            consentement explicite à chaque étape.
          </p>
        </div>

        {/* État de disponibilité */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge variant={availability?.consentGiven ? "success" : "warning"}>
              {availability?.consentGiven ? "Consentement donné" : "Consentement requis"}
            </Badge>
            <Badge variant={availability?.localAvailable ? "success" : "default"}>
              {availability?.localAvailable ? "Mode local disponible" : "Mode local indisponible"}
            </Badge>
            <Badge variant={availability?.cloudAvailable ? "success" : "default"}>
              {availability?.cloudAvailable ? "Mode cloud configuré" : "Mode cloud non configuré"}
            </Badge>
          </div>
        )}

        {/* Alerte si pas prêt */}
        {!loading && !ready && (
          <Card className="border-warning/30 bg-warning/5 p-5">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
              <div>
                <p className="font-medium text-primary">L&apos;assistant IA n&apos;est pas prêt</p>
                <p className="mt-1 text-sm text-secondary">
                  {!availability?.consentGiven &&
                    "Donnez votre consentement dans les paramètres pour activer l'assistant. "}
                  {!availability?.localAvailable &&
                    !availability?.cloudAvailable &&
                    "Aucun fournisseur IA n'est disponible. Configurez une clé API (mode cloud) dans les paramètres."}
                </p>
                <Link
                  href="/parametres#ia"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-card-elevated px-3 py-1.5 text-sm text-lavender hover:brightness-110"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Ouvrir les paramètres IA
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* Fonctionnalités */}
        <div>
          <h2 className="font-serif text-xl font-semibold text-primary">
            Fonctionnalités disponibles
          </h2>
          <p className="mt-1 text-sm text-secondary">
            Chaque fonctionnalité demande votre consentement avant d&apos;envoyer des données.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {AI_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.href} href={ready ? feature.href : "/parametres#ia"}>
                  <Card
                    className={`h-full p-5 transition-colors ${
                      ready ? "hover:border-lavender/30 hover:bg-card-elevated" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-elevated shadow-glow">
                        <Icon className="h-5 w-5 text-lavender" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                        <CardDescription className="mt-1.5 text-xs leading-relaxed">
                          {feature.description}
                        </CardDescription>
                      </div>
                    </div>
                    {!ready && (
                      <Badge variant="warning" className="mt-3">
                        Consentement requis
                      </Badge>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Garanties de confidentialité */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15">
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Vos données, vos règles</CardTitle>
              <CardDescription>
                Ce que l&apos;IA voit — et ce qu&apos;elle ne voit jamais.
              </CardDescription>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-success">
                ✅ Envoyé (avec consentement)
              </p>
              <ul className="mt-2 space-y-1 text-sm text-secondary">
                <li>• Le texte d&apos;une offre que vous collez</li>
                <li>• Le contenu de votre CV (texte extrait)</li>
                <li>• Votre profil (compétences, expérience)</li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-danger">
                ❌ Jamais envoyé
              </p>
              <ul className="mt-2 space-y-1 text-sm text-secondary">
                <li>• Vos candidatures chiffrées</li>
                <li>• Vos documents chiffrés</li>
                <li>• Votre phrase secrète / clé de chiffrement</li>
                <li>• Votre nom, email, téléphone (anonymisés en cloud)</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Comment ça marche */}
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
              <Target className="h-5 w-5 text-rose" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base">Comment ça marche ?</CardTitle>
            </div>
          </div>
          <ol className="mt-4 space-y-3 text-sm text-secondary">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender/15 text-xs font-medium text-lavender">
                1
              </span>
              <span>
                <strong className="text-primary">Activez l&apos;IA</strong> dans les paramètres et
                choisissez local (navigateur) ou cloud (API).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender/15 text-xs font-medium text-lavender">
                2
              </span>
              <span>
                <strong className="text-primary">Lancez une analyse</strong> depuis une offre, un CV
                ou une candidature.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender/15 text-xs font-medium text-lavender">
                3
              </span>
              <span>
                <strong className="text-primary">Vérifiez avant envoi</strong> — une fenêtre vous
                montre exactement quelles données seront traitées.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender/15 text-xs font-medium text-lavender">
                4
              </span>
              <span>
                <strong className="text-primary">Éditez le résultat</strong> — l&apos;IA produit un
                brouillon, vous gardez le contrôle final.
              </span>
            </li>
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
