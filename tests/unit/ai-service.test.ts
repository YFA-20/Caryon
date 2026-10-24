/**
 * Tests unitaires — ai-service (Phase 2).
 *
 * Vérifie :
 * - Le consentement est requis avant tout appel
 * - La détection de disponibilité local/cloud
 * - La construction des prompts système
 * - Le parsing JSON des réponses IA (robuste)
 * - L'anonymisation des textes
 */
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  buildSystemPrompt,
  parseAiJson,
  anonymizeText,
  detectLocalAvailability,
  requireAiConsent,
  runAiTask,
  getAiAvailability,
  AiConsentError,
  AiNotAvailableError,
  callCloudAi,
} from "@/lib/ai/ai-service";
import { createVault } from "@/lib/vault/vault-service";
import { saveSettings, getSettings } from "@/lib/vault/goal-repository";
import { db } from "@/lib/db/database";

const PASSPHRASE = "test-ai-service-passphrase-123!";

describe("buildSystemPrompt", () => {
  it("génère un prompt pour analyze_offer avec instructions JSON", () => {
    const prompt = buildSystemPrompt("analyze_offer");
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("poste");
    expect(prompt).toContain("competencesRequises");
    expect(prompt).toContain("français");
  });

  it("génère un prompt pour compare_cv_offer", () => {
    const prompt = buildSystemPrompt("compare_cv_offer");
    expect(prompt).toContain("competencesPresentes");
    expect(prompt).toContain("scoreCorrespondance");
  });

  it("génère un prompt pour generate_letter", () => {
    const prompt = buildSystemPrompt("generate_letter");
    expect(prompt).toContain("lettre de motivation");
    expect(prompt).toContain("400 mots");
  });

  it("génère un prompt pour prepare_interview", () => {
    const prompt = buildSystemPrompt("prepare_interview");
    expect(prompt).toContain("questions");
    expect(prompt).toContain("categorie");
  });

  it("inclut la règle 'ne jamais inventer' dans tous les prompts", () => {
    const tasks = [
      "analyze_offer",
      "compare_cv_offer",
      "generate_letter",
      "prepare_interview",
    ] as const;
    for (const task of tasks) {
      const prompt = buildSystemPrompt(task);
      expect(prompt.toLowerCase()).toContain("inventer");
    }
  });
});

describe("parseAiJson", () => {
  it("parse un JSON direct", () => {
    const result = parseAiJson<{ a: number }>('{"a": 42}');
    expect(result).toEqual({ a: 42 });
  });

  it("parse un JSON dans un bloc markdown ```json", () => {
    const text = 'Voici le résultat:\n```json\n{"poste": "Dev"}\n```\nCordialement';
    const result = parseAiJson<{ poste: string }>(text);
    expect(result).toEqual({ poste: "Dev" });
  });

  it("parse un JSON dans un bloc markdown ``` sans json", () => {
    const text = '```\n{"x": 1}\n```';
    const result = parseAiJson<{ x: number }>(text);
    expect(result).toEqual({ x: 1 });
  });

  it("parse le premier objet JSON trouvé dans du texte", () => {
    const text = 'Réponse: {"nom": "test", "valeur": 123} — fin';
    const result = parseAiJson<{ nom: string; valeur: number }>(text);
    expect(result).toEqual({ nom: "test", valeur: 123 });
  });

  it("retourne null si aucun JSON valide", () => {
    expect(parseAiJson("pas de JSON ici")).toBeNull();
  });

  it("retourne null pour un JSON malformé", () => {
    expect(parseAiJson('{"a": }')).toBeNull();
  });

  it("gère les JSON imbriqués", () => {
    const text = '{"outer": {"inner": [1, 2, 3]}}';
    const result = parseAiJson<{ outer: { inner: number[] } }>(text);
    expect(result?.outer.inner).toEqual([1, 2, 3]);
  });
});

describe("anonymizeText", () => {
  it("remplace les emails par [email]", () => {
    const result = anonymizeText("Contactez-moi sur jean.dupont@example.com svp");
    expect(result).toContain("[email]");
    expect(result).not.toContain("jean.dupont@example.com");
  });

  it("remplace les numéros de téléphone français", () => {
    const result = anonymizeText("Mon tel: 06 12 34 56 78");
    expect(result).toContain("[téléphone]");
    expect(result).not.toContain("06 12 34 56 78");
  });

  it("remplace les numéros avec indicatif international", () => {
    const result = anonymizeText("Tel: +33 6 12 34 56 78");
    expect(result).toContain("[téléphone]");
  });

  it("remplace les liens LinkedIn personnels", () => {
    const result = anonymizeText("Voir mon profil linkedin.com/in/jeandupont");
    expect(result).toContain("[lien]");
  });

  it("garde le texte normal intact", () => {
    const result = anonymizeText("Développeur React avec 5 ans d'expérience");
    expect(result).toBe("Développeur React avec 5 ans d'expérience");
  });

  it("anonymise plusieurs PII dans le même texte", () => {
    const text = "Jean Dupont, jean@example.com, 06 12 34 56 78, Paris";
    const result = anonymizeText(text);
    expect(result).not.toContain("jean@example.com");
    expect(result).not.toContain("06 12 34 56 78");
    expect(result).toContain("Jean Dupont"); // Le nom n'est pas anonymisé (trop complexe)
    expect(result).toContain("Paris");
  });
});

describe("detectLocalAvailability", () => {
  it("retourne un boolean", () => {
    const result = detectLocalAvailability();
    expect(typeof result).toBe("boolean");
  });
});

describe("requireAiConsent", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE, { testMode: true });
  });

  it("lève AiConsentError si consentement non donné (défaut)", async () => {
    await expect(requireAiConsent()).rejects.toThrow(AiConsentError);
  });

  it("ne lève pas d'erreur si consentement donné", async () => {
    await saveSettings({ aiConsent: true });
    await expect(requireAiConsent()).resolves.toBeUndefined();
  });
});

describe("getAiAvailability", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE, { testMode: true });
  });

  it("retourne consentGiven=false par défaut", async () => {
    const av = await getAiAvailability();
    expect(av.consentGiven).toBe(false);
  });

  it("retourne consentGiven=true après activation", async () => {
    await saveSettings({ aiConsent: true });
    const av = await getAiAvailability();
    expect(av.consentGiven).toBe(true);
  });

  it("cloudAvailable est false sans clé API", async () => {
    await saveSettings({ aiProvider: "cloud", aiApiKey: "" });
    const av = await getAiAvailability();
    expect(av.cloudAvailable).toBe(false);
  });

  it("cloudAvailable est true avec clé API en mode cloud", async () => {
    await saveSettings({ aiProvider: "cloud", aiApiKey: "sk-test-key" });
    const av = await getAiAvailability();
    expect(av.cloudAvailable).toBe(true);
  });

  it("retourne le fournisseur préféré", async () => {
    await saveSettings({ aiProvider: "cloud" });
    const av = await getAiAvailability();
    expect(av.preferredProvider).toBe("cloud");
  });
});

describe("runAiTask", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE, { testMode: true });
  });

  it("lève AiConsentError sans consentement", async () => {
    await expect(runAiTask({ task: "analyze_offer", prompt: "test" })).rejects.toThrow(
      AiConsentError
    );
  });

  it("lève AiNotAvailableError en mode local sans WebLLM", async () => {
    await saveSettings({ aiConsent: true, aiProvider: "local" });
    // Le mode local lève AiNotAvailableError (pas encore implémenté)
    await expect(runAiTask({ task: "analyze_offer", prompt: "test" })).rejects.toThrow(
      AiNotAvailableError
    );
  });

  it("lève AiNotAvailableError en mode cloud sans clé API", async () => {
    await saveSettings({ aiConsent: true, aiProvider: "cloud", aiApiKey: "" });
    await expect(runAiTask({ task: "analyze_offer", prompt: "test" })).rejects.toThrow(
      AiNotAvailableError
    );
  });
});

describe("callCloudAi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lève AiNotAvailableError si l'API retourne une erreur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      })
    );

    await expect(
      callCloudAi({ task: "analyze_offer", prompt: "test" }, "sk-bad-key", "gpt-4o-mini")
    ).rejects.toThrow(AiNotAvailableError);
  });

  it("parse la réponse OpenAI correctement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '{"poste": "Dev React"}' } }],
          }),
      })
    );

    const response = await callCloudAi(
      { task: "analyze_offer", prompt: "test" },
      "sk-test",
      "gpt-4o-mini"
    );

    expect(response.text).toBe('{"poste": "Dev React"}');
    expect(response.provider).toBe("cloud");
    expect(response.model).toBe("gpt-4o-mini");
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("envoie la clé API dans le header Authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await callCloudAi({ task: "analyze_offer", prompt: "test" }, "sk-secret-key", "gpt-4o-mini");

    const callArgs = fetchMock.mock.calls[0]!;
    const headers = callArgs[1].headers;
    expect(headers.Authorization).toBe("Bearer sk-secret-key");
  });
});

describe("Settings IA persistence", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    await createVault(PASSPHRASE, { testMode: true });
  });

  it("les préférences IA sont persistées chiffrées", async () => {
    await saveSettings({
      aiConsent: true,
      aiProvider: "cloud",
      aiApiKey: "sk-test-123",
      aiModel: "gpt-4o-mini",
    });

    const settings = await getSettings();
    expect(settings.aiConsent).toBe(true);
    expect(settings.aiProvider).toBe("cloud");
    expect(settings.aiApiKey).toBe("sk-test-123");
    expect(settings.aiModel).toBe("gpt-4o-mini");
  });

  it("les valeurs par défaut sont correctes", async () => {
    const settings = await getSettings();
    expect(settings.aiConsent).toBe(false);
    expect(settings.aiProvider).toBe("local");
    expect(settings.aiApiKey).toBe("");
    expect(settings.aiModel).toBe("");
  });
});
