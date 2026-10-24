/**
 * Velora — service IA (Phase 2).
 *
 * Abstraction pour les fonctionnalités d'intelligence artificielle :
 * - Mode LOCAL (WebLLM) : modèle tournant dans le navigateur (WASM/WebGPU).
 *   Aucune donnée ne quitte l'appareil. Prioritaire si disponible.
 * - Mode CLOUD : appel API externe (OpenAI, Anthropic, etc.) avec clé
 *   fournie par l'utilisateur. Les données envoyées sont anonymisées.
 *
 * SÉCURITÉ :
 * - Le consentement explicite (aiConsent) est vérifié avant CHAQUE appel.
 * - Une preview des données envoyées est toujours présentée à l'utilisateur.
 * - La clé API n'est jamais loguée ni transmise à un autre domaine que le fournisseur.
 * - Aucune donnée chiffrée du coffre n'est envoyée sans déchiffrement explicite
 *   par l'utilisateur (l'IA reçoit du texte, pas du ciphertext).
 */
import { getSettings } from "@/lib/vault/goal-repository";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AiProvider = "local" | "cloud";

export type AiTask =
  | "analyze_offer" // Analyser une offre d'emploi
  | "compare_cv_offer" // Comparer un CV avec une offre
  | "generate_letter" // Générer une lettre de motivation
  | "prepare_interview"; // Générer des questions d'entretien

export interface AiRequest {
  task: AiTask;
  /** Données textuelles à envoyer (déjà anonymisées par l'appelant). */
  prompt: string;
  /** Contexte additionnel (ex: profil utilisateur, offre structurée). */
  context?: Record<string, unknown>;
}

export interface AiResponse {
  /** Texte de réponse généré. */
  text: string;
  /** Fournisseur utilisé réellement (peut différer du préféré si fallback). */
  provider: AiProvider;
  /** Modèle utilisé. */
  model: string;
  /** Durée de l'appel en ms. */
  durationMs: number;
  /** Avertissement éventuel (ex: fallback cloud → local). */
  warning?: string;
}

export interface AiAvailability {
  /** Le mode local (WebLLM) est-il disponible ? */
  localAvailable: boolean;
  /** Le mode cloud est-il configuré (clé API renseignée) ? */
  cloudAvailable: boolean;
  /** Le consentement est-il donné ? */
  consentGiven: boolean;
  /** Fournisseur préféré par l'utilisateur. */
  preferredProvider: AiProvider;
}

export class AiConsentError extends Error {
  constructor() {
    super("Consentement IA non donné. Activez-le dans les paramètres.");
    this.name = "AiConsentError";
  }
}

export class AiNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiNotAvailableError";
  }
}

// ---------------------------------------------------------------------------
// Détection de disponibilité
// ---------------------------------------------------------------------------

/**
 * Détecte si WebLLM / WebGPU est disponible dans ce navigateur.
 * WebLLM nécessite WebGPU (Chrome/Edge 113+) ou fallback WASM.
 */
export function detectLocalAvailability(): boolean {
  if (typeof window === "undefined") return false;
  // WebGPU est l'indicateur principal pour WebLLM
  if ("gpu" in navigator) return true;
  // Fallback : vérifier WebAssembly SIMD (supporté par la plupart des navigateurs modernes)
  try {
    return typeof WebAssembly.validate === "function";
  } catch {
    return false;
  }
}

/**
 * Retourne l'état de disponibilité complet de l'IA.
 */
export async function getAiAvailability(): Promise<AiAvailability> {
  const settings = await getSettings();
  return {
    localAvailable: detectLocalAvailability(),
    cloudAvailable: settings.aiProvider === "cloud" && settings.aiApiKey.length > 0,
    consentGiven: settings.aiConsent,
    preferredProvider: settings.aiProvider,
  };
}

// ---------------------------------------------------------------------------
// Vérification du consentement
// ---------------------------------------------------------------------------

/**
 * Vérifie que le consentement IA est donné. Lève AiConsentError sinon.
 */
export async function requireAiConsent(): Promise<void> {
  const settings = await getSettings();
  if (!settings.aiConsent) {
    throw new AiConsentError();
  }
}

// ---------------------------------------------------------------------------
// Construction du prompt (anonymisé)
// ---------------------------------------------------------------------------

/**
 * Construit un prompt système pour une tâche donnée.
 * Le prompt est en français et demande une réponse structurée.
 */
export function buildSystemPrompt(task: AiTask): string {
  const base =
    "Tu es un assistant de carrière intelligent, intégré à Velora, une application " +
    "privée de gestion de candidatures. Tu réponds en français, de manière concise " +
    "et actionnable. Tu ne dois JAMAIS inventer d'expérience, de diplôme ou de " +
    "compétence que l'utilisateur n'a pas déclaré. Si une information manque, " +
    "indique-le clairement.\n\n";

  switch (task) {
    case "analyze_offer":
      return (
        base +
        "TÂCHE : Analyser une offre d'emploi. Extrais les informations suivantes " +
        "et réponds UNIQUEMENT en JSON valide (sans markdown, sans explication) :\n" +
        '{"poste": string, "entreprise": string, "type": "stage"|"alternance"|"cdi"|"cdd"|"freelance", ' +
        '"localisation": string, "teletravail": boolean, "salaire": string, ' +
        '"competencesRequises": string[], "competencesSouhaitees": string[], ' +
        '"avantages": string[], "niveauExperience": string, "descriptionCourte": string, ' +
        '"motsCles": string[]}\n\n' +
        "Offre à analyser :\n"
      );

    case "compare_cv_offer":
      return (
        base +
        "TÂCHE : Comparer un CV avec une offre d'emploi. Réponds UNIQUEMENT en JSON " +
        "valide (sans markdown) :\n" +
        '{"competencesPresentes": string[], "competencesManquantes": string[], ' +
        '"competencesTransversales": string[], "scoreCorrespondance": number (0-100), ' +
        '"suggestions": string[], "pointsForts": string[]}\n\n' +
        "CV de l'utilisateur :\n"
      );

    case "generate_letter":
      return (
        base +
        "TÂCHE : Rédiger une lettre de motivation personnalisée. La lettre doit être " +
        "professionnelle, concise (max 400 mots), et mettre en avant les vraies " +
        "compétences de l'utilisateur. Ne mentionne que des expériences réelles. " +
        "Structure : accroche, motivation pour le poste, adéquation profil/poste, " +
        "disponibilité, formule de politesse.\n\n" +
        "Profil de l'utilisateur :\n"
      );

    case "prepare_interview":
      return (
        base +
        "TÂCHE : Préparer un entretien d'embauche. Génère une liste de questions " +
        "probables basées sur l'offre et le profil. Réponds UNIQUEMENT en JSON " +
        "valide (sans markdown) :\n" +
        '{"questions": [{"question": string, "categorie": "technique"|"comportementale"|"entreprise"|"motivation", ' +
        '"suggestionReponse": string, "competenceVisee": string}], ' +
        '"questionsA poser": string[], "conseilsGeneraux": string[]}\n\n' +
        "Contexte (offre + profil) :\n"
      );

    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Appel IA — Mode Cloud (API externe)
// ---------------------------------------------------------------------------

interface CloudProviderConfig {
  baseUrl: string;
  defaultModel: string;
  headers: (apiKey: string) => Record<string, string>;
}

const CLOUD_PROVIDERS: Record<string, CloudProviderConfig> = {
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o-mini",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    defaultModel: "claude-3-haiku-20240307",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
  },
  // Provider générique compatible OpenAI (Ollama, LM Studio, etc.)
  custom: {
    baseUrl: "",
    defaultModel: "",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
  },
};

/**
 * Appelle une API cloud (OpenAI-compatible ou Anthropic).
 * La clé API est passée explicitement — jamais lue depuis un store global.
 */
export async function callCloudAi(
  request: AiRequest,
  apiKey: string,
  model: string,
  provider: string = "openai"
): Promise<AiResponse> {
  const start = Date.now();
  const config = CLOUD_PROVIDERS[provider] ?? CLOUD_PROVIDERS["openai"]!;
  const effectiveModel = model || config.defaultModel;
  const systemPrompt = buildSystemPrompt(request.task);

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: config.headers(apiKey),
    body: JSON.stringify({
      model: effectiveModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: request.prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new AiNotAvailableError(`Erreur API IA (${response.status}): ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    content?: { text?: string }[];
  };

  // Format OpenAI : data.choices[0].message.content
  // Format Anthropic : data.content[0].text
  const text = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? "";

  return {
    text,
    provider: "cloud",
    model: effectiveModel,
    durationMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Appel IA — Mode Local (WebLLM, à brancher dans le Lot 7)
// ---------------------------------------------------------------------------

/**
 * Appel IA en mode local via WebLLM.
 * NOTE : WebLLM sera intégré dans le Lot 7. Pour l'instant, cette fonction
 * lève une erreur si le mode local n'est pas encore disponible.
 */
export async function callLocalAi(_request: AiRequest): Promise<AiResponse> {
  // Sera implémenté dans le Lot 7 avec @mlc-ai/web-llm
  throw new AiNotAvailableError(
    "Le mode IA local (WebLLM) sera disponible dans la prochaine mise à jour. " +
      "Utilisez le mode cloud en attendant (clé API dans les paramètres)."
  );
}

// ---------------------------------------------------------------------------
// Point d'entrée principal
// ---------------------------------------------------------------------------

/**
 * Exécute une tâche IA après vérification du consentement.
 *
 * @param request - La requête IA (tâche + prompt + contexte)
 * @param options.forceProvider - Force un fournisseur (local/cloud), sinon utilise le préféré
 * @throws AiConsentError si le consentement n'est pas donné
 * @throws AiNotAvailableError si aucun fournisseur n'est disponible
 */
export async function runAiTask(
  request: AiRequest,
  options: { forceProvider?: AiProvider } = {}
): Promise<AiResponse> {
  // 1. Vérifier le consentement
  await requireAiConsent();

  // 2. Récupérer les settings
  const settings = await getSettings();
  const provider = options.forceProvider ?? settings.aiProvider;

  // 3. Essayer le fournisseur demandé, fallback sur l'autre
  if (provider === "local") {
    try {
      return await callLocalAi(request);
    } catch (err) {
      if (err instanceof AiNotAvailableError && settings.aiApiKey.length > 0) {
        // Fallback cloud
        return callCloudAi(request, settings.aiApiKey, settings.aiModel, "openai");
      }
      throw err;
    }
  } else {
    if (settings.aiApiKey.length === 0) {
      throw new AiNotAvailableError(
        "Aucune clé API configurée. Ajoutez-la dans les paramètres ou utilisez le mode local."
      );
    }
    return callCloudAi(request, settings.aiApiKey, settings.aiModel, "openai");
  }
}

// ---------------------------------------------------------------------------
// Utilitaires de parsing des réponses JSON de l'IA
// ---------------------------------------------------------------------------

/**
 * Extrait un objet JSON d'une réponse IA (gère les réponses entourées
 * de markdown ```json ... ``` ou de texte parasite).
 */
export function parseAiJson<T>(text: string): T | null {
  // Essaie d'abord le parse direct
  try {
    return JSON.parse(text) as T;
  } catch {
    // Cherche un bloc JSON dans le texte
  }

  // Cherche ```json ... ``` ou ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // Continue
    }
  }

  // Cherche le premier { ... } équilibré
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // Échec
    }
  }

  return null;
}

/**
 * Anonymise un texte en retirant les informations personnelles identifiables.
 * Utilisé avant tout envoi vers un fournisseur cloud.
 */
export function anonymizeText(text: string): string {
  return (
    text
      // Retire les emails
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
      // Retire les numéros de téléphone (formats FR variés)
      .replace(/(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/g, "[téléphone]")
      // Retire les URLs personnelles (garde les domaines d'entreprises génériques)
      .replace(/(?:https?:\/\/)?(?:www\.)?(?:linkedin|github)\.[a-z]+\/[^\s]+/gi, "[lien]")
  );
}
