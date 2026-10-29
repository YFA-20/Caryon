// @vitest-environment jsdom
/**
 * Velora — tests du moteur IA local (WebLLM).
 *
 * Vérifie :
 * - La détection WebGPU
 * - Le chargement dynamique (mock de @mlc-ai/web-llm)
 * - La construction des prompts par tâche
 * - La gestion d'erreur (WebGPU indisponible, modèle non chargé)
 * - La libération du moteur
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isWebGpuAvailable,
  unloadEngine,
  callLocalAiEngine,
  DEFAULT_LOCAL_MODEL,
  RECOMMENDED_MODELS,
} from "@/lib/ai/webllm-engine";
import type { AiRequest } from "@/lib/ai/ai-service";

// ---------------------------------------------------------------------------
// Mock de @mlc-ai/web-llm (chargé dynamiquement)
// ---------------------------------------------------------------------------

const mockChatCreate = vi.fn();
const mockUnload = vi.fn();

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: vi.fn().mockImplementation(async (modelId: string, config?: unknown) => {
    // Simule le callback de progression
    const cb = (
      config as { initProgressCallback?: (r: { text: string; progress: number }) => void }
    )?.initProgressCallback;
    cb?.({ text: "Téléchargement du modèle…", progress: 0 });
    cb?.({ text: "Chargement en mémoire GPU…", progress: 50 });
    cb?.({ text: "Prêt", progress: 100 });

    return {
      chat: {
        completions: {
          create: mockChatCreate,
        },
      },
      unload: mockUnload,
    };
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWebGpu(available: boolean) {
  if (available) {
    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: vi.fn() },
      configurable: true,
      writable: true,
    });
  } else {
    // Supprime la propriété pour que "gpu" in navigator retourne false
    // @ts-expect-error — suppression volontaire pour le test
    delete navigator.gpu;
  }
}

const sampleRequest: AiRequest = {
  task: "analyze_offer",
  prompt: "Développeur React, Paris, 45-55k€, télétravail partiel",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WebLLM — détection WebGPU", () => {
  afterEach(() => {
    mockWebGpu(false);
  });

  it("retourne true si navigator.gpu existe", () => {
    mockWebGpu(true);
    expect(isWebGpuAvailable()).toBe(true);
  });

  it("retourne false si navigator.gpu est absent", () => {
    mockWebGpu(false);
    expect(isWebGpuAvailable()).toBe(false);
  });
});

describe("WebLLM — constantes", () => {
  it("DEFAULT_LOCAL_MODEL est un modèle MLC valide", () => {
    expect(DEFAULT_LOCAL_MODEL).toContain("-MLC");
    expect(DEFAULT_LOCAL_MODEL).toMatch(/q4f16/);
  });

  it("RECOMMENDED_MODELS contient au moins 3 modèles", () => {
    expect(RECOMMENDED_MODELS.length).toBeGreaterThanOrEqual(3);
    for (const model of RECOMMENDED_MODELS) {
      expect(model.id).toContain("-MLC");
      expect(model.sizeMB).toBeGreaterThan(0);
      expect(model.label).toBeTruthy();
    }
  });
});

describe("WebLLM — chargement et inférence", () => {
  beforeEach(() => {
    mockWebGpu(true);
    mockChatCreate.mockReset();
    mockUnload.mockReset();
    mockChatCreate.mockResolvedValue({
      choices: [{ message: { content: '{"poste":"Dev React","entreprise":"Acme"}' } }],
    });
  });

  afterEach(async () => {
    await unloadEngine();
    mockWebGpu(false);
  });

  it("charge le moteur et retourne une réponse", async () => {
    const response = await callLocalAiEngine(sampleRequest);

    expect(response.provider).toBe("local");
    expect(response.model).toBe(DEFAULT_LOCAL_MODEL);
    expect(response.text).toContain("Dev React");
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("appelle le callback de progression", async () => {
    const progressCalls: { text: string; percent: number }[] = [];
    await callLocalAiEngine(sampleRequest, DEFAULT_LOCAL_MODEL, (text, percent) => {
      progressCalls.push({ text, percent });
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]!.percent).toBe(100);
  });

  it("réutilise le moteur pour le même modèle (pas de rechargement)", async () => {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const createSpy = vi.mocked(CreateMLCEngine);
    createSpy.mockClear();

    await callLocalAiEngine(sampleRequest);
    await callLocalAiEngine(sampleRequest);

    // CreateMLCEngine ne doit être appelé qu'une fois (moteur mis en cache)
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("construit le bon prompt système pour chaque tâche", async () => {
    const tasks: AiRequest["task"][] = [
      "analyze_offer",
      "compare_cv_offer",
      "generate_letter",
      "prepare_interview",
    ];

    for (const task of tasks) {
      mockChatCreate.mockClear();
      await callLocalAiEngine({ task, prompt: "test" });

      const call = mockChatCreate.mock.calls[0]?.[0] as {
        messages: { role: string; content: string }[];
      };
      expect(call.messages[0]!.role).toBe("system");
      expect(call.messages[0]!.content).toContain("Velora");
      expect(call.messages[1]!.role).toBe("user");
      expect(call.messages[1]!.content).toBe("test");
    }
  });

  it("lève une erreur si WebGPU n'est pas disponible", async () => {
    await unloadEngine(); // Libère le moteur éventuellement en cache
    mockWebGpu(false);
    await expect(callLocalAiEngine(sampleRequest)).rejects.toThrow("WebGPU");
  });

  it("libère le moteur avec unloadEngine", async () => {
    await callLocalAiEngine(sampleRequest);
    await unloadEngine();
    expect(mockUnload).toHaveBeenCalledTimes(1);
  });

  it("recharge le moteur si le modèle change", async () => {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const createSpy = vi.mocked(CreateMLCEngine);
    createSpy.mockClear();

    await callLocalAiEngine(sampleRequest, "Llama-3.2-1B-Instruct-q4f16_1-MLC");
    await callLocalAiEngine(sampleRequest, "Qwen2.5-0.5B-Instruct-q4f16_1-MLC");

    // Deux créations : modèle différent
    expect(createSpy).toHaveBeenCalledTimes(2);
    // L'ancien moteur doit avoir été libéré
    expect(mockUnload).toHaveBeenCalled();
  });
});
