/**
 * Velora — tests du service d'audit de sécurité local.
 *
 * Vérifie la génération du rapport, le scoring, et la détection
 * des paramètres KDF sous-optimaux.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/db/database";
import { createVault, lock } from "@/lib/vault/vault-service";
import { generateSecurityAudit } from "@/lib/security/security-audit";

const TEST_PASSPHRASE = "ma-phrase-secrete-de-test-123";

describe("security-audit", () => {
  beforeEach(async () => {
    await db.vault.clear();
    await db.records.clear();
    await db.documents.clear();
    lock();
  });

  it("génère un rapport complet avec un coffre créé", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const report = await generateSecurityAudit(15 * 60 * 1000);

    expect(report.items.length).toBeGreaterThanOrEqual(8);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(report.generatedAt).toBeTruthy();

    // Vérifie la présence des items clés
    const ids = report.items.map((i) => i.id);
    expect(ids).toContain("kdf");
    expect(ids).toContain("encryption");
    expect(ids).toContain("passphrase");
    expect(ids).toContain("master-key");
    expect(ids).toContain("auto-lock");
    expect(ids).toContain("csp");
  });

  it("signale un avertissement si auto-lock est désactivé", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const report = await generateSecurityAudit(0);

    const autoLockItem = report.items.find((i) => i.id === "auto-lock");
    expect(autoLockItem).toBeTruthy();
    expect(autoLockItem!.status).toBe("warning");
    expect(report.score).toBeLessThan(100);
  });

  it("signale un avertissement si aucun coffre n'existe", async () => {
    const report = await generateSecurityAudit(15 * 60 * 1000);
    const vaultItem = report.items.find((i) => i.id === "vault");
    expect(vaultItem).toBeTruthy();
    expect(vaultItem!.status).toBe("warning");
  });

  it("KDF en mode test (paramètres réduits) est signalé warning", async () => {
    // createVault avec testMode utilise TEST_KDF_PARAMS (64 KiB, 1 itération)
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const report = await generateSecurityAudit(15 * 60 * 1000);

    const kdfItem = report.items.find((i) => i.id === "kdf");
    expect(kdfItem).toBeTruthy();
    expect(kdfItem!.status).toBe("warning");
    expect(kdfItem!.detail).toContain("sous-optimaux");
  });

  it("les items de base sont toujours « ok »", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const report = await generateSecurityAudit(15 * 60 * 1000);

    const encryption = report.items.find((i) => i.id === "encryption");
    const passphrase = report.items.find((i) => i.id === "passphrase");
    const csp = report.items.find((i) => i.id === "csp");
    const minimization = report.items.find((i) => i.id === "minimization");

    expect(encryption!.status).toBe("ok");
    expect(passphrase!.status).toBe("ok");
    expect(csp!.status).toBe("ok");
    expect(minimization!.status).toBe("ok");
  });

  it("le score baisse avec plusieurs warnings", async () => {
    await createVault(TEST_PASSPHRASE, { testMode: true });
    const reportBad = await generateSecurityAudit(0); // auto-lock off + KDF test
    const reportGood = await generateSecurityAudit(15 * 60 * 1000); // auto-lock ok, KDF test

    expect(reportBad.score).toBeLessThan(reportGood.score);
  });
});
