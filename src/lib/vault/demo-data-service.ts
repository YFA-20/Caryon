/**
 * Velora — service de données de démonstration.
 *
 * Génère un jeu de données fictives RÉALISTES et les insère dans le coffre
 * chiffré via les repositories existants (même pipeline de chiffrement AES-256-GCM).
 *
 * RÈGLES :
 * - Les données sont 100% fictives (entreprises, postes, contacts inventés).
 * - Elles sont chiffrées exactement comme les vraies données.
 * - Un marqueur `demoMode` dans VaultSettings identifie le mode.
 * - La suppression du mode démo efface toutes les données (wipe + re-seed optionnel).
 */
import { createApplication, listApplications } from "./application-repository";
import { createEvent, listEvents } from "./calendar-repository";
import { createGoal, listGoals } from "./goal-repository";
import { createJournalEntry, listJournalEntries } from "./journal-repository";
import { createDocument } from "./document-repository";
import { createInterviewPrep } from "./interview-repository";
import type { ApplicationStatus, ApplicationType } from "@/lib/schema/application";

// ---------------------------------------------------------------------------
// Helpers de génération déterministe (dates relatives à "maintenant")
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysAhead(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function makePdfContent(text: string): Uint8Array {
  // Contenu PDF minimal fictif (juste du texte encodé — pas un vrai PDF,
  // mais suffisant pour démontrer le pipeline de chiffrement de documents)
  const encoder = new TextEncoder();
  return encoder.encode(`%PDF-1.4\n% Demo document — Velora\n${text}\n%%EOF`);
}

// ---------------------------------------------------------------------------
// Jeu de données fictives
// ---------------------------------------------------------------------------

interface DemoApplicationSeed {
  company: string;
  position: string;
  type: ApplicationType;
  status: ApplicationStatus;
  location: string;
  remote: boolean;
  salary: string;
  source: string;
  contactName: string;
  contactEmail: string;
  appliedAt: string;
  notes: string;
  createdAgo: number;
  tags: string[];
}

const DEMO_APPLICATIONS: DemoApplicationSeed[] = [
  {
    company: "Atelier Nova",
    position: "Développeur Front-end React",
    type: "cdi",
    status: "entretien",
    location: "Paris 11e",
    remote: true,
    salary: "48-55k€",
    source: "LinkedIn",
    contactName: "Julie Martin",
    contactEmail: "julie.martin@ateliernova.fr",
    appliedAt: daysAgo(12),
    notes:
      "Entretien technique prévu la semaine prochaine. Équipe de 12 devs, stack React/Next.js/TS. Ambiance startup studio digital.",
    createdAgo: 14,
    tags: ["react", "nextjs", "startup"],
  },
  {
    company: "Lumina Studio",
    position: "Stage Développeur Full-stack (6 mois)",
    type: "stage",
    status: "envoyee",
    location: "Lyon",
    remote: false,
    salary: "1 200€/mois",
    source: "Welcome to the Jungle",
    contactName: "Thomas Bernard",
    contactEmail: "thomas@luminastudio.io",
    appliedAt: daysAgo(5),
    notes:
      "Candidature envoyée avec CV + lettre. Agence web spécialisée e-commerce. Stage de fin d'études.",
    createdAgo: 6,
    tags: ["stage", "nodejs", "e-commerce"],
  },
  {
    company: "DataFlow Analytics",
    position: "Alternance Développeur Data/ML",
    type: "alternance",
    status: "en_attente",
    location: "Bordeaux",
    remote: true,
    salary: "1 400€/mois",
    source: "Site entreprise",
    contactName: "Sophie Chen",
    contactEmail: "sophie.chen@dataflow.fr",
    appliedAt: daysAgo(20),
    notes: "Candidature spontanée + dossier complet. 3 semaines sans réponse, prévoir une relance.",
    createdAgo: 21,
    tags: ["alternance", "python", "data"],
  },
  {
    company: "Crédit Horizon",
    position: "Développeur Back-end Java (CDI)",
    type: "cdi",
    status: "refusee",
    location: "Nantes",
    remote: false,
    salary: "42-48k€",
    source: "Indeed",
    contactName: "Marc Lefevre",
    contactEmail: "marc.lefevre@credithorizon.fr",
    appliedAt: daysAgo(35),
    notes:
      "Refus reçu après entretien RH + technique. Profil junior pas assez aligné sur Java Spring. Dommage, bonne expérience.",
    createdAgo: 38,
    tags: ["java", "backend", "banque"],
  },
  {
    company: "GreenTech Solutions",
    position: "Freelance — Développeur d'app mobile React Native",
    type: "freelance",
    status: "offre_recue",
    location: "Remote",
    remote: true,
    salary: "550€/jour",
    source: "Malt",
    contactName: "Inès Dubois",
    contactEmail: "ines@greentech-solutions.com",
    appliedAt: daysAgo(8),
    notes:
      "Mission 3 mois renouvelable, app de suivi environnemental. Offre reçue, à étudier (TJM, conditions).",
    createdAgo: 10,
    tags: ["freelance", "react-native", "mission"],
  },
  {
    company: "Mairie de Villeurbanne",
    position: "CDD — Développeur web (6 mois)",
    type: "cdd",
    status: "brouillon",
    location: "Villeurbanne",
    remote: false,
    salary: "1 800€/mois",
    source: "Site emploi public",
    contactName: "",
    contactEmail: "",
    appliedAt: "",
    notes:
      "Offre repérée, brouillon commencé. Portail citoyen, stack PHP/Symfony. À compléter et envoyer.",
    createdAgo: 2,
    tags: ["cdd", "php", "secteur-public"],
  },
  {
    company: "Pixel & Co",
    position: "Stage — UX/UI Designer + Dev (6 mois)",
    type: "stage",
    status: "a_envoyer",
    location: "Toulouse",
    remote: true,
    salary: "900€/mois",
    source: "Apec",
    contactName: "Karim Benali",
    contactEmail: "karim@pixelandco.fr",
    appliedAt: "",
    notes: "CV à adapter pour ce poste hybride design/dev. Dossier prêt, envoi prévu demain.",
    createdAgo: 1,
    tags: ["stage", "ux", "design"],
  },
  {
    company: "Nexus Santé",
    position: "CDI — Développeur Full-stack TypeScript",
    type: "cdi",
    status: "acceptee",
    location: "Paris 13e",
    remote: true,
    salary: "52-60k€",
    source: "Recommandation",
    contactName: "Dr. Amine Khelifi",
    contactEmail: "amine.khelifi@nexussante.fr",
    appliedAt: daysAgo(45),
    notes:
      "Offre acceptée ! Contrat signé, début le mois prochain. Plateforme de télémédecine, équipe de 8 devs.",
    createdAgo: 50,
    tags: ["typescript", "santé", "accepte"],
  },
];

// ---------------------------------------------------------------------------
// Service principal
// ---------------------------------------------------------------------------

export interface DemoSeedResult {
  applications: number;
  documents: number;
  events: number;
  goals: number;
  journalEntries: number;
  interviewPreps: number;
}

/**
 * Génère et insère les données de démonstration dans le coffre chiffré.
 * Retourne le nombre d'entités créées par collection.
 *
 * @throws si le coffre est verrouillé (les repositories lèvent déjà)
 */
export async function seedDemoData(): Promise<DemoSeedResult> {
  const result: DemoSeedResult = {
    applications: 0,
    documents: 0,
    events: 0,
    goals: 0,
    journalEntries: 0,
    interviewPreps: 0,
  };

  // 1. Candidatures
  const createdApps: { id: string; company: string }[] = [];
  for (const seed of DEMO_APPLICATIONS) {
    const created = await createApplication({
      company: seed.company,
      position: seed.position,
      type: seed.type,
      status: seed.status,
      location: seed.location,
      remote: seed.remote,
      salary: seed.salary,
      source: seed.source,
      contactName: seed.contactName,
      contactEmail: seed.contactEmail,
      appliedAt: seed.appliedAt || undefined,
      notes: seed.notes,
      priority: "normale",
      tags: seed.tags,
    });
    createdApps.push({ id: created.id, company: seed.company });
    result.applications++;
  }

  // On retrouve les IDs par entreprise pour lier les entités
  const allApps = await listApplications();
  const appByCompany = (name: string) => allApps.find((a) => a.company === name);

  const atelierNova = appByCompany("Atelier Nova");
  const lumina = appByCompany("Lumina Studio");
  const dataflow = appByCompany("DataFlow Analytics");
  const greentech = appByCompany("GreenTech Solutions");
  const nexus = appByCompany("Nexus Santé");

  // 2. Documents (CV, lettres fictifs)
  const demoDocs: {
    name: string;
    type: "cv" | "lettre" | "autre";
    text: string;
    appId?: string;
  }[] = [
    {
      name: "CV — Développeur Full-stack.pdf",
      type: "cv",
      text: "CV fictif — 5 ans d'expérience React/Node.js/TypeScript. Disponible pour démonstration.",
    },
    {
      name: "Lettre — Atelier Nova.pdf",
      type: "lettre",
      text: "Lettre de motivation fictive pour Atelier Nova — passion pour le produit, stack React/Next.js.",
      appId: atelierNova?.id,
    },
    {
      name: "Lettre — Lumina Studio.pdf",
      type: "lettre",
      text: "Lettre de motivation fictive pour Lumina Studio — intérêt pour l'e-commerce et le design d'interfaces.",
      appId: lumina?.id,
    },
  ];

  for (const doc of demoDocs) {
    await createDocument({
      name: doc.name,
      type: doc.type,
      mimeType: "application/pdf",
      content: makePdfContent(doc.text),
      tags: ["demo"],
      applicationId: doc.appId,
    });
    result.documents++;
  }

  // 3. Événements calendrier
  const demoEvents: {
    title: string;
    type: "entretien" | "relance" | "echeance" | "preparation" | "personnel";
    startAt: string;
    endAt?: string;
    allDay?: boolean;
    applicationId?: string;
    notes: string;
  }[] = [
    {
      title: "Entretien technique — Atelier Nova",
      type: "entretien",
      startAt: daysAhead(3),
      endAt: new Date(new Date(daysAhead(3)).getTime() + 60 * 60 * 1000).toISOString(),
      applicationId: atelierNova?.id,
      notes: "Visio — test live coding React. Préparer un mini-projet démo.",
    },
    {
      title: "Relance — DataFlow Analytics",
      type: "relance",
      startAt: daysAhead(1),
      allDay: true,
      applicationId: dataflow?.id,
      notes: "3 semaines sans réponse — envoyer un email de relance poli.",
    },
    {
      title: "Envoi candidature — Pixel & Co",
      type: "echeance",
      startAt: daysAhead(2),
      allDay: true,
      applicationId: appByCompany("Pixel & Co")?.id,
      notes: "Date limite d'envoi du dossier stage UX/Dev.",
    },
    {
      title: "Préparation entretien Atelier Nova",
      type: "preparation",
      startAt: daysAhead(2),
      endAt: new Date(new Date(daysAhead(2)).getTime() + 90 * 60 * 1000).toISOString(),
      applicationId: atelierNova?.id,
      notes: "Revoir les hooks React, préparer 3 questions pour l'équipe.",
    },
    {
      title: "Signature contrat — Nexus Santé",
      type: "personnel",
      startAt: daysAhead(15),
      allDay: true,
      applicationId: nexus?.id,
      notes: "RDV signature contrat au siège, 10h.",
    },
    {
      title: "Appel découverte — GreenTech Solutions",
      type: "entretien",
      startAt: daysAhead(5),
      endAt: new Date(new Date(daysAhead(5)).getTime() + 30 * 60 * 1000).toISOString(),
      applicationId: greentech?.id,
      notes: "Premier échange téléphonique pour discuter de la mission freelance.",
    },
  ];

  for (const ev of demoEvents) {
    await createEvent({
      title: ev.title,
      type: ev.type,
      startAt: ev.startAt,
      endAt: ev.endAt || "",
      allDay: ev.allDay ?? false,
      applicationId: ev.applicationId || "",
      notes: ev.notes,
    });
    result.events++;
  }

  // 4. Objectifs
  const demoGoals: {
    title: string;
    description: string;
    metric: "applications_sent" | "applications_created" | "interviews" | "responses";
    target: number;
    period: "week" | "month" | "quarter" | "custom";
  }[] = [
    {
      title: "10 candidatures ce mois-ci",
      description: "Objectif principal : envoyer 10 candidatures qualifiés en octobre.",
      metric: "applications_sent",
      target: 10,
      period: "month",
    },
    {
      title: "3 entretiens décrochés",
      description: " décrocher au moins 3 entretiens ce trimestre.",
      metric: "interviews",
      target: 3,
      period: "quarter",
    },
  ];

  for (const g of demoGoals) {
    await createGoal({
      title: g.title,
      description: g.description,
      metric: g.metric,
      target: g.target,
      period: g.period,
      startAt: daysAgo(15),
      endAt: "",
    });
    result.goals++;
  }

  // 5. Entrées de journal
  const demoJournal: {
    date: string;
    title: string;
    content: string;
    mood: "bien" | "motive" | "neutre" | "stress";
    appId?: string;
  }[] = [
    {
      date: daysAgo(7),
      title: "Bilan de semaine",
      content:
        "Bonne semaine : 2 candidatures envoyées, 1 entretien décroché chez Atelier Nova. Le feeling était bon, j'ai hâte du technique.\n\nÀ faire la semaine prochaine : relancer DataFlow, envoyer Pixel & Co.",
      mood: "motive",
    },
    {
      date: daysAgo(20),
      title: "Retour sur le refus Crédit Horizon",
      content:
        "Refus de Crédit Horizon après 2 entretiens. C'est dur mais formateur : ils cherchaient un profil plus senior sur Spring. Je vais monter en compétence sur Java en parallèle.\n\nLeçon : ne pas postuler trop tôt, bien lire les prérequis.",
      mood: "neutre",
      appId: appByCompany("Crédit Horizon")?.id,
    },
    {
      date: daysAgo(3),
      title: "Offre Nexus Santé acceptée 🎉",
      content:
        "J'ai accepté l'offre de Nexus Santé ! Début dans 3 semaines. Plateforme de télémédecine, équipe sympa, full remote possible.\n\nProchaines étapes : signer le contrat, préparer l'arrivée.",
      mood: "bien",
      appId: nexus?.id,
    },
  ];

  for (const j of demoJournal) {
    await createJournalEntry({
      date: j.date,
      title: j.title,
      content: j.content,
      mood: j.mood,
      tags: ["demo"],
      applicationId: j.appId || "",
    });
    result.journalEntries++;
  }

  // 6. Fiches de préparation d'entretien
  if (atelierNova) {
    await createInterviewPrep(atelierNova.id, daysAhead(3));
    result.interviewPreps++;
  }
  if (greentech) {
    await createInterviewPrep(greentech.id, daysAhead(5));
    result.interviewPreps++;
  }

  return result;
}

/**
 * Vérifie si le coffre contient déjà des données (non-démo).
 * Utilisé pour avertir avant d'activer le mode démo sur un coffre existant.
 */
export async function hasExistingData(): Promise<boolean> {
  const [apps, events, goals, journal] = await Promise.all([
    listApplications(),
    listEvents(),
    listGoals(),
    listJournalEntries(),
  ]);
  return apps.length > 0 || events.length > 0 || goals.length > 0 || journal.length > 0;
}
