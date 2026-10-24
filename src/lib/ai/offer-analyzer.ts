/**
 * Velora — Analyseur d'offre IA (Phase 2, Lot 7).
 *
 * Utilise le service IA pour extraire des informations structurées
 * d'une offre d'emploi texte. Le résultat peut pré-remplir une candidature.
 *
 * SÉCURITÉ :
 * - Vérifie le consentement avant tout appel
 * - L'offre est anonymisée avant envoi (emails, téléphones retirés)
 * - Le résultat est un brouillon — jamais sauvegardé automatiquement
 */
import { runAiTask, parseAiJson, anonymizeText, requireAiConsent } from "./ai-service";
import type { ApplicationType } from "@/lib/schema/application";

/** Résultat structuré d'une analyse d'offre. */
export interface OfferAnalysis {
  poste: string;
  entreprise: string;
  type: ApplicationType | "";
  localisation: string;
  teletravail: boolean;
  salaire: string;
  competencesRequises: string[];
  competencesSouhaitees: string[];
  avantages: string[];
  niveauExperience: string;
  descriptionCourte: string;
  motsCles: string[];
}

/** Données pré-remplies pour une candidature, dérivées de l'analyse. */
export interface PrefillData {
  company: string;
  position: string;
  type?: ApplicationType;
  location: string;
  remote: boolean;
  salary: string;
  source: string;
  notes: string;
}

/**
 * Analyse une offre d'emploi avec l'IA.
 *
 * @param offerText - Le texte brut de l'offre (collé par l'utilisateur)
 * @returns L'analyse structurée, ou null en cas d'erreur
 * @throws AiConsentError si le consentement n'est pas donné
 */
export async function analyzeOfferWithAi(offerText: string): Promise<OfferAnalysis | null> {
  await requireAiConsent();

  const anonymized = anonymizeText(offerText);
  const response = await runAiTask({
    task: "analyze_offer",
    prompt: anonymized,
  });

  const parsed = parseAiJson<Partial<OfferAnalysis>>(response.text);
  if (!parsed) return null;

  return {
    poste: parsed.poste ?? "",
    entreprise: parsed.entreprise ?? "",
    type: isValidType(parsed.type) ? parsed.type : "",
    localisation: parsed.localisation ?? "",
    teletravail: parsed.teletravail ?? false,
    salaire: parsed.salaire ?? "",
    competencesRequises: parsed.competencesRequises ?? [],
    competencesSouhaitees: parsed.competencesSouhaitees ?? [],
    avantages: parsed.avantages ?? [],
    niveauExperience: parsed.niveauExperience ?? "",
    descriptionCourte: parsed.descriptionCourte ?? "",
    motsCles: parsed.motsCles ?? [],
  };
}

/**
 * Convertit une analyse d'offre en données de pré-remplissage
 * pour le formulaire de candidature.
 */
export function analysisToPrefill(analysis: OfferAnalysis): PrefillData {
  const notesParts: string[] = [];
  if (analysis.descriptionCourte) notesParts.push(analysis.descriptionCourte);
  if (analysis.competencesRequises.length > 0) {
    notesParts.push(`Compétences requises : ${analysis.competencesRequises.join(", ")}`);
  }
  if (analysis.competencesSouhaitees.length > 0) {
    notesParts.push(`Compétences souhaitées : ${analysis.competencesSouhaitees.join(", ")}`);
  }
  if (analysis.avantages.length > 0) {
    notesParts.push(`Avantages : ${analysis.avantages.join(", ")}`);
  }
  if (analysis.niveauExperience) {
    notesParts.push(`Niveau d'expérience : ${analysis.niveauExperience}`);
  }

  return {
    company: analysis.entreprise,
    position: analysis.poste,
    type: analysis.type || undefined,
    location: analysis.localisation,
    remote: analysis.teletravail,
    salary: analysis.salaire,
    source: "Analyse IA",
    notes: notesParts.join("\n\n"),
  };
}

function isValidType(type: unknown): type is ApplicationType {
  return (
    typeof type === "string" && ["stage", "alternance", "cdi", "cdd", "freelance"].includes(type)
  );
}

// ---------------------------------------------------------------------------
// Comparaison CV ↔ Offre (pour /documents)
// ---------------------------------------------------------------------------

export interface CvOfferComparison {
  competencesPresentes: string[];
  competencesManquantes: string[];
  competencesTransversales: string[];
  scoreCorrespondance: number;
  suggestions: string[];
  pointsForts: string[];
}

/**
 * Compare un CV (texte) avec une offre (texte) via l'IA.
 *
 * @param cvText - Le contenu texte du CV
 * @param offerText - Le texte de l'offre
 */
export async function compareCvWithOffer(
  cvText: string,
  offerText: string
): Promise<CvOfferComparison | null> {
  await requireAiConsent();

  const prompt = `OFFRE D'EMPLOI :\n${anonymizeText(offerText)}\n\n---\n\n${anonymizeText(cvText)}`;

  const response = await runAiTask({
    task: "compare_cv_offer",
    prompt,
  });

  const parsed = parseAiJson<Partial<CvOfferComparison>>(response.text);
  if (!parsed) return null;

  return {
    competencesPresentes: parsed.competencesPresentes ?? [],
    competencesManquantes: parsed.competencesManquantes ?? [],
    competencesTransversales: parsed.competencesTransversales ?? [],
    scoreCorrespondance: Math.min(100, Math.max(0, parsed.scoreCorrespondance ?? 0)),
    suggestions: parsed.suggestions ?? [],
    pointsForts: parsed.pointsForts ?? [],
  };
}

// ---------------------------------------------------------------------------
// Génération de lettre de motivation (pour /candidatures)
// ---------------------------------------------------------------------------

/**
 * Génère une lettre de motivation personnalisée via l'IA.
 *
 * @param offerText - Le texte de l'offre
 * @param profileText - Le profil de l'utilisateur (CV, compétences, expérience)
 * @returns Le texte de la lettre (brouillon), ou null en cas d'erreur
 */
export async function generateCoverLetter(
  offerText: string,
  profileText: string
): Promise<string | null> {
  await requireAiConsent();

  const prompt = `${anonymizeText(profileText)}\n\n---\n\nOFFRE :\n${anonymizeText(offerText)}`;

  const response = await runAiTask({
    task: "generate_letter",
    prompt,
  });

  return response.text.trim() || null;
}

// ---------------------------------------------------------------------------
// Préparation d'entretien IA (pour /entretien)
// ---------------------------------------------------------------------------

export interface InterviewQuestion {
  question: string;
  categorie: "technique" | "comportementale" | "entreprise" | "motivation";
  suggestionReponse: string;
  competenceVisee: string;
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
  questionsAPoser: string[];
  conseilsGeneraux: string[];
}

/**
 * Génère une préparation d'entretien via l'IA.
 *
 * @param offerText - Le texte de l'offre
 * @param profileText - Le profil de l'utilisateur
 */
export async function prepareInterviewWithAi(
  offerText: string,
  profileText: string
): Promise<InterviewPrepResult | null> {
  await requireAiConsent();

  const prompt = `${anonymizeText(profileText)}\n\n---\n\nOFFRE :\n${anonymizeText(offerText)}`;

  const response = await runAiTask({
    task: "prepare_interview",
    prompt,
  });

  const parsed = parseAiJson<Partial<InterviewPrepResult>>(response.text);
  if (!parsed) return null;

  return {
    questions: (parsed.questions ?? []).map((q) => ({
      question: q.question ?? "",
      categorie: isValidCategory(q.categorie) ? q.categorie : "motivation",
      suggestionReponse: q.suggestionReponse ?? "",
      competenceVisee: q.competenceVisee ?? "",
    })),
    questionsAPoser: parsed.questionsAPoser ?? [],
    conseilsGeneraux: parsed.conseilsGeneraux ?? [],
  };
}

function isValidCategory(
  cat: unknown
): cat is "technique" | "comportementale" | "entreprise" | "motivation" {
  return (
    typeof cat === "string" &&
    ["technique", "comportementale", "entreprise", "motivation"].includes(cat)
  );
}
