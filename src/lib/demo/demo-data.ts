import type { Application, ApplicationStatus } from "@/lib/schema/application";

/**
 * Velora — données de DÉMONSTRATION.
 *
 * Ces données sont FICTIES, clairement identifiées comme telles dans l'interface
 * (bandeau « Mode démonstration »), et ne sont JAMAIS persistées dans IndexedDB.
 * Elles servent uniquement à présenter l'interface.
 */

export const DEMO_FIRST_NAME = "Camille";

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const DEMO_APPLICATIONS: Application[] = [
  {
    id: "d1111111-1111-4111-8111-111111111111",
    company: "Studio Lumen (fictif)",
    position: "Développeur·se front-end — stage",
    type: "stage",
    offerUrl: "",
    location: "Lyon (fictif)",
    remote: true,
    salary: "1 200 € / mois (fictif)",
    appliedAt: daysAgo(6),
    deadline: "",
    source: "Site fictif",
    contactName: "Mme Durand (fictive)",
    contactEmail: "recrutement@example.invalid",
    contactPhone: "",
    status: "en_attente",
    priority: "haute",
    notes: "Relancer la semaine prochaine. (donnée fictive)",
    tags: ["front-end", "stage"],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(2),
  },
  {
    id: "d2222222-2222-4222-8222-222222222222",
    company: "Atelier Nova (fictif)",
    position: "Alternance développeur·se web",
    type: "alternance",
    offerUrl: "",
    location: "Paris (fictif)",
    remote: false,
    salary: "Selon profil (fictif)",
    appliedAt: daysAgo(12),
    deadline: "",
    source: "École (fictif)",
    contactName: "M. Martin (fictif)",
    contactEmail: "alternance@example.invalid",
    contactPhone: "",
    status: "entretien",
    priority: "haute",
    notes: "Entretien technique le 28. (donnée fictive)",
    tags: ["alternance"],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(1),
  },
  {
    id: "d3333333-3333-4333-8333-333333333333",
    company: "Cabinet Aster (fictif)",
    position: "Consultant·e junior — CDI",
    type: "cdi",
    offerUrl: "",
    location: "Bordeaux (fictif)",
    remote: true,
    salary: "38 000 € (fictif)",
    appliedAt: daysAgo(20),
    deadline: "",
    source: "LinkedIn (fictif)",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "offre_recue",
    priority: "normale",
    notes: "Offre reçue, répondre avant vendredi. (donnée fictive)",
    tags: ["cdi"],
    createdAt: daysAgo(20),
    updatedAt: daysAgo(0),
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    company: "Bureau Orion (fictif)",
    position: "Développeur·se back-end — CDI",
    type: "cdi",
    offerUrl: "",
    location: "Nantes (fictif)",
    remote: false,
    salary: "",
    appliedAt: daysAgo(3),
    deadline: "",
    source: "Recommandation (fictive)",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "envoyee",
    priority: "normale",
    notes: "Candidature envoyée, en attente de retour. (donnée fictive)",
    tags: ["back-end"],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: "d5555555-5555-4555-8555-555555555555",
    company: "Agence Pixel (fictif)",
    position: "Intégrateur·rice web — CDD",
    type: "cdd",
    offerUrl: "",
    location: "Remote (fictif)",
    remote: true,
    salary: "",
    appliedAt: "",
    deadline: "",
    source: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    status: "brouillon",
    priority: "basse",
    notes: "À préparer avant envoi. (donnée fictive)",
    tags: ["cdd"],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

export interface DemoStats {
  active: number;
  interviewsUpcoming: number;
  positiveResponses: number;
  followupsNeeded: number;
}

export function computeDemoStats(apps: Application[]): DemoStats {
  const activeStatuses: ApplicationStatus[] = [
    "a_envoyer",
    "envoyee",
    "en_attente",
    "entretien",
    "offre_recue",
  ];
  return {
    active: apps.filter((a) => activeStatuses.includes(a.status)).length,
    interviewsUpcoming: apps.filter((a) => a.status === "entretien").length,
    positiveResponses: apps.filter((a) => a.status === "offre_recue" || a.status === "acceptee")
      .length,
    followupsNeeded: apps.filter((a) => a.status === "envoyee" || a.status === "en_attente").length,
  };
}

export function pipelineBreakdown(
  apps: Application[]
): { status: ApplicationStatus; count: number }[] {
  const statuses: ApplicationStatus[] = [
    "brouillon",
    "a_envoyer",
    "envoyee",
    "en_attente",
    "entretien",
    "offre_recue",
    "acceptee",
    "refusee",
    "abandonnee",
  ];
  return statuses
    .map((status) => ({ status, count: apps.filter((a) => a.status === status).length }))
    .filter((s) => s.count > 0);
}
