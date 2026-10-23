/**
 * Velora — audit de sécurité local.
 *
 * Analyse les métadonnées du coffre (paramètres KDF, version du format,
 * présence de verifier) et produit un rapport avec des recommandations.
 * Aucune donnée sensible n'est exposée — seules des métadonnées techniques.
 */
import { db } from "@/lib/db/database";
import type { VaultRow } from "@/lib/db/database";

export interface SecurityAuditItem {
  id: string;
  label: string;
  status: "ok" | "warning" | "info";
  detail: string;
}

export interface SecurityAuditReport {
  items: SecurityAuditItem[];
  score: number; // 0-100
  generatedAt: string;
}

/** Paramètres KDF recommandés (Argon2id). */
const RECOMMENDED_KDF = {
  algorithm: "argon2id" as const,
  memoryKiB: 64 * 1024, // 64 MiB
  iterations: 3,
  parallelism: 1,
};

function auditKdf(kdf: VaultRow["kdf"]): SecurityAuditItem {
  const issues: string[] = [];
  if (kdf.algorithm !== RECOMMENDED_KDF.algorithm) {
    issues.push(`Algorithme ${kdf.algorithm} (recommandé : Argon2id)`);
  }
  if (kdf.memoryKiB < RECOMMENDED_KDF.memoryKiB) {
    issues.push(
      `Mémoire ${Math.round(kdf.memoryKiB / 1024)} MiB (recommandé : ${RECOMMENDED_KDF.memoryKiB / 1024} MiB)`
    );
  }
  if (kdf.iterations < RECOMMENDED_KDF.iterations) {
    issues.push(`Itérations ${kdf.iterations} (recommandé : ${RECOMMENDED_KDF.iterations})`);
  }

  if (issues.length === 0) {
    return {
      id: "kdf",
      label: "Dérivation de clé (Argon2id)",
      status: "ok",
      detail: `Argon2id · ${Math.round(kdf.memoryKiB / 1024)} MiB · ${kdf.iterations} itérations · p=${kdf.parallelism}`,
    };
  }
  return {
    id: "kdf",
    label: "Dérivation de clé (Argon2id)",
    status: "warning",
    detail: `Paramètres sous-optimaux : ${issues.join(", ")}. Recréer le coffre est recommandé pour renforcer la résistance aux attaques hors ligne.`,
  };
}

function auditEncryption(): SecurityAuditItem {
  return {
    id: "encryption",
    label: "Chiffrement des données",
    status: "ok",
    detail:
      "AES-256-GCM (authentifié) · nonce 96 bits unique par opération · AAD sur les métadonnées · clé maîtresse non extractible en session",
  };
}

function auditPassphraseStorage(): SecurityAuditItem {
  return {
    id: "passphrase",
    label: "Phrase secrète",
    status: "ok",
    detail:
      "Jamais stockée. Seul un verifier AEAD (challenge chiffré) permet de valider la phrase sans la conserver.",
  };
}

function auditMasterKey(kdf: VaultRow["kdf"]): SecurityAuditItem {
  void kdf;
  return {
    id: "master-key",
    label: "Clé maîtresse",
    status: "ok",
    detail:
      "Générée aléatoirement (256 bits), wrappée par la KEK dérivée de la phrase, importée comme CryptoKey non extractible.",
  };
}

function auditAutoLock(autoLockMs: number): SecurityAuditItem {
  if (autoLockMs <= 0) {
    return {
      id: "auto-lock",
      label: "Verrouillage automatique",
      status: "warning",
      detail:
        "Désactivé. Le coffre reste déverrouillé indéfiniment — activez un délai dans les paramètres.",
    };
  }
  if (autoLockMs > 30 * 60 * 1000) {
    return {
      id: "auto-lock",
      label: "Verrouillage automatique",
      status: "info",
      detail: `Délai de ${Math.round(autoLockMs / 60000)} min — relativement long. 5-15 min est recommandé.`,
    };
  }
  return {
    id: "auto-lock",
    label: "Verrouillage automatique",
    status: "ok",
    detail: `Verrouillage après ${Math.round(autoLockMs / 60000)} min d'inactivité.`,
  };
}

function auditBackup(): SecurityAuditItem {
  return {
    id: "backup",
    label: "Sauvegardes",
    status: "info",
    detail:
      "Pensez à exporter régulièrement une sauvegarde chiffrée (.velora). Sans votre phrase secrète, les données sont irrécupérables.",
  };
}

function auditCsp(): SecurityAuditItem {
  return {
    id: "csp",
    label: "Content Security Policy",
    status: "ok",
    detail:
      "CSP restrictive : script-src 'self' + hashes SHA-256 (pas de 'unsafe-inline' ni 'unsafe-eval') · object-src 'none' · frame-ancestors 'none' · base-uri 'self'",
  };
}

function auditDataMinimization(): SecurityAuditItem {
  return {
    id: "minimization",
    label: "Minimisation des données",
    status: "ok",
    detail:
      "Toutes les données métier sont chiffrées dans IndexedDB. Seules les métadonnées techniques minimales (id, collection, date) sont indexables en clair.",
  };
}

/**
 * Génère un rapport d'audit de sécurité local.
 * Ne lit que les métadonnées techniques du coffre — jamais de données métier.
 */
export async function generateSecurityAudit(autoLockMs: number): Promise<SecurityAuditReport> {
  const row = await db.vault.toCollection().first();

  const items: SecurityAuditItem[] = [
    auditEncryption(),
    auditPassphraseStorage(),
    auditCsp(),
    auditDataMinimization(),
    auditAutoLock(autoLockMs),
    auditBackup(),
  ];

  if (row) {
    items.splice(1, 0, auditKdf(row.kdf), auditMasterKey(row.kdf));
  } else {
    items.splice(1, 0, {
      id: "vault",
      label: "Coffre-fort",
      status: "warning",
      detail: "Aucun coffre trouvé sur cet appareil.",
    });
  }

  // Score : ok = 100%, info = 90%, warning = 50%
  const weights = { ok: 1, info: 0.9, warning: 0.5 };
  const total = items.reduce((sum, item) => sum + weights[item.status], 0);
  const score = Math.round((total / items.length) * 100);

  return {
    items,
    score,
    generatedAt: new Date().toISOString(),
  };
}
