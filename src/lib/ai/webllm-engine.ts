/**
 * Velora — moteur IA local (WebLLM).
 *
 * Charge `@mlc-ai/web-llm` dynamiquement (import()) pour ne pas alourdir
 * le bundle initial. Le moteur est initialisé à la demande, avec un modèle
 * léger par défaut (Llama 3.2 1B quantized, ~700 Mo).
 *
 * SÉCURITÉ :
 * - Aucune donnée ne quitte l'appareil. Le modèle tourne dans le navigateur
 *   via WebGPU (ou WASM en fallback).
 * - Le modèle est téléchargé depuis Hugging Face (huggingface.co) et mis
 *   en cache dans IndexedDB / Cache API par WebLLM.
 * - L'engine est libéré explicitement (engine.unload()) pour vider la mémoire GPU.
 *
 * CSP requise (voir scripts/update-csp-hashes.mjs) :
 * - script-src 'wasm-unsafe-eval'  (WebAssembly, pas eval JS)
 * - worker-src 'self' blob:         (WebLLM crée un Web Worker)
 * - connect-src https://huggingface.co https://*.hf.co  (téléchargement modèles)
 */
import type { AiRequest, AiResponse, AiTask } from "./ai-service";

// ---------------------------------------------------------------------------
// Types (subset de @mlc-ai/web-llm, déclarés localement pour éviter
// d'importer le module au niveau type — le chargement reste dynamique)
// ---------------------------------------------------------------------------

interface WebLLMEngine {
  chat: {
    completions: {
      create: (params: {
        messages: { role: string; content: string }[];
        max_tokens?: number;
        temperature?: number;
      }) => Promise<{ choices: { message: { content: string } }[] }>;
    };
  };
  unload: () => Promise<void>;
}

interface WebLLMModule {
  CreateMLCEngine: (
    modelId: string,
    config?: {
      initProgressCallback?: (report: { text: string; progress: number }) => void;
    }
  ) => Promise<WebLLMEngine>;
}

// ---------------------------------------------------------------------------
// État du moteur (singleton)
// ---------------------------------------------------------------------------

let enginePromise: Promise<WebLLMEngine> | null = null;
let currentModelId: string | null = null;

/**
 * Modèle par défaut : Llama 3.2 1B Instruct, quantized q4f16_1 (~700 Mo).
 * C'est le plus petit modèle capable de réponses structurées en JSON.
 */
export const DEFAULT_LOCAL_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

/**
 * Modèles recommandés (sélection utilisateur dans les paramètres).
 */
export const RECOMMENDED_MODELS: { id: string; label: string; sizeMB: number }[] = [
  { id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B (léger, ~700 Mo)", sizeMB: 700 },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B (équilibré, ~2 Go)",
    sizeMB: 2000,
  },
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 0.5B (très léger, ~400 Mo)",
    sizeMB: 400,
  },
  { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen 2.5 1.5B (léger, ~1 Go)", sizeMB: 1000 },
  { id: "gemma-2-2b-it-q4f16_1-MLC", label: "Gemma 2 2B (Google, ~1.5 Go)", sizeMB: 1500 },
];

// ---------------------------------------------------------------------------
// Détection WebGPU
// ---------------------------------------------------------------------------

/**
 * Détecte si WebGPU est disponible (requis pour de bonnes performances).
 * En l'absence de WebGPU, WebLLM fonctionne en WASM (beaucoup plus lent).
 */
export function isWebGpuAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator;
}

// ---------------------------------------------------------------------------
// Initialisation du moteur
// ---------------------------------------------------------------------------

/**
 * Initialise (ou réutilise) le moteur WebLLM.
 * Le chargement est mis en cache : un seul engine par modèle.
 */
async function getEngine(
  modelId: string,
  onProgress?: (text: string, progress: number) => void
): Promise<WebLLMEngine> {
  if (enginePromise && currentModelId === modelId) {
    return enginePromise;
  }

  // Libère l'ancien moteur si le modèle change
  if (enginePromise && currentModelId !== modelId) {
    try {
      const oldEngine = await enginePromise;
      await oldEngine.unload();
    } catch {
      // Ignore — l'ancien moteur est peut-être déjà libéré
    }
    enginePromise = null;
  }

  currentModelId = modelId;
  enginePromise = (async () => {
    // Import dynamique : le bundle WebLLM (~14 Mo) n'est chargé que si nécessaire
    const webllm = (await import("@mlc-ai/web-llm")) as unknown as WebLLMModule;
    return webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        onProgress?.(report.text, report.progress);
      },
    });
  })();

  return enginePromise;
}

/**
 * Libère le moteur et vide la mémoire GPU.
 */
export async function unloadEngine(): Promise<void> {
  if (enginePromise) {
    try {
      const engine = await enginePromise;
      await engine.unload();
    } catch {
      // Ignore
    }
    enginePromise = null;
    currentModelId = null;
  }
}

// ---------------------------------------------------------------------------
// Construction du prompt
// ---------------------------------------------------------------------------

function buildMessages(task: AiTask, prompt: string): { role: string; content: string }[] {
  const systemPrompt =
    "Tu es un assistant de carrière intégré à Velora, une application privée de gestion " +
    "de candidatures. Tu réponds en français, de manière concise et actionnable. " +
    "Tu ne dois JAMAIS inventer d'expérience, de diplôme ou de compétence que " +
    "l'utilisateur n'a pas déclaré. Si une information manque, indique-le clairement. " +
    "Réponds UNIQUEMENT en JSON valide quand la tâche le demande (sans markdown, " +
    "sans explication autour).\n\n";

  const taskInstructions: Record<AiTask, string> = {
    analyze_offer:
      "TÂCHE : Analyser une offre d'emploi. Réponds UNIQUEMENT en JSON valide :\n" +
      '{"poste": string, "entreprise": string, "type": "stage"|"alternance"|"cdi"|"cdd"|"freelance", ' +
      '"localisation": string, "teletravail": boolean, "salaire": string, ' +
      '"competencesRequises": string[], "competencesSouhaitees": string[], ' +
      '"avantages": string[], "niveauExperience": string, "descriptionCourte": string, ' +
      '"motsCles": string[]}\n\nOffre à analyser :\n',
    compare_cv_offer:
      "TÂCHE : Comparer un CV avec une offre d'emploi. Réponds UNIQUEMENT en JSON valide :\n" +
      '{"competencesPresentes": string[], "competencesManquantes": string[], ' +
      '"competencesTransversales": string[], "scoreCorrespondance": number (0-100), ' +
      '"suggestions": string[], "pointsForts": string[]}\n\nCV de l\'utilisateur :\n',
    generate_letter:
      "TÂCHE : Rédiger une lettre de motivation personnalisée. La lettre doit être " +
      "professionnelle, concise (max 400 mots), et mettre en avant les vraies " +
      "compétences de l'utilisateur. Ne mentionne que des expériences réelles. " +
      "Structure : accroche, motivation pour le poste, adéquation profil/poste, " +
      "disponibilité, formule de politesse.\n\nProfil de l'utilisateur :\n",
    prepare_interview:
      "TÂCHE : Préparer un entretien d'embauche. Génère une liste de questions " +
      "probables basées sur l'offre et le profil. Réponds UNIQUEMENT en JSON valide :\n" +
      '{"questions": [{"question": string, "categorie": "technique"|"comportementale"|"entreprise"|"motivation", ' +
      '"suggestionReponse": string, "competenceVisee": string}], ' +
      '"questionsA poser": string[], "conseilsGeneraux": string[]}\n\nContexte (offre + profil) :\n',
  };

  return [
    { role: "system", content: systemPrompt + taskInstructions[task] },
    { role: "user", content: prompt },
  ];
}

// ---------------------------------------------------------------------------
// Appel IA local
// ---------------------------------------------------------------------------

/**
 * Appelle le modèle local via WebLLM.
 *
 * @param request - La requête IA (tâche + prompt)
 * @param modelId - Identifiant du modèle WebLLM (défaut: DEFAULT_LOCAL_MODEL)
 * @param onProgress - Callback de progression du chargement du modèle (0-100)
 */
export async function callLocalAiEngine(
  request: AiRequest,
  modelId: string = DEFAULT_LOCAL_MODEL,
  onProgress?: (text: string, progress: number) => void
): Promise<AiResponse> {
  const start = Date.now();

  if (!isWebGpuAvailable()) {
    throw new Error(
      "WebGPU n'est pas disponible dans ce navigateur. " +
        "Utilisez Chrome/Edge 113+ ou le mode cloud."
    );
  }

  const engine = await getEngine(modelId, onProgress);
  const messages = buildMessages(request.task, request.prompt);

  const completion = await engine.chat.completions.create({
    messages,
    max_tokens: 2000,
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content ?? "";

  return {
    text,
    provider: "local",
    model: modelId,
    durationMs: Date.now() - start,
  };
}
