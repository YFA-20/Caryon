/**
 * Tests unitaires — schémas Zod de synchronisation (src/lib/sync/schema.ts).
 *
 * Vérifie que :
 * - Les enveloppes valides passent la validation.
 * - Les enveloppes invalides (mauvvais UUID, payload vide, etc.) sont rejetées.
 * - Les réponses serveur sont validées strictement (pas de confiance aveugle).
 */
import { describe, it, expect } from "vitest";
import {
  syncEnvelopeSchema,
  pullResponseSchema,
  recordResponseSchema,
  pushRequestSchema,
  pushResponseSchema,
  pairingInitRequestSchema,
  pairingInitResponseSchema,
  pairingStatusSchema,
  pairingConfirmRequestSchema,
  pendingPairingSchema,
  pendingPairingsResponseSchema,
  pairedDeviceSchema,
  deviceListResponseSchema,
  syncMetaSchema,
} from "@/lib/sync/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function validEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    v: 1 as const,
    vaultId: VALID_UUID,
    kind: "record" as const,
    recordId: "app-123",
    collection: "applications",
    payload: JSON.stringify({ v: 1, alg: "AES-256-GCM", iv: "abc", ct: "def", aad: "ghi" }),
    meta: JSON.stringify({ status: "sent" }),
    updatedAt: "2025-01-15T10:30:00.000Z",
    deviceId: VALID_UUID_2,
    tombstone: false,
    ...overrides,
  };
}

describe("syncEnvelopeSchema", () => {
  it("accepte une enveloppe valide (record)", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope());
    expect(result.success).toBe(true);
  });

  it("accepte une enveloppe valide (document)", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ kind: "document" }));
    expect(result.success).toBe(true);
  });

  it("accepte une tombstone", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ tombstone: true }));
    expect(result.success).toBe(true);
  });

  it("rejette une version incorrecte", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ v: 2 }));
    expect(result.success).toBe(false);
  });

  it("rejette un vaultId non-UUID", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ vaultId: "pas-un-uuid" }));
    expect(result.success).toBe(false);
  });

  it("rejette un payload vide", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ payload: "" }));
    expect(result.success).toBe(false);
  });

  it("rejette un kind invalide", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ kind: "unknown" }));
    expect(result.success).toBe(false);
  });

  it("rejette une date updatedAt invalide", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ updatedAt: "pas-une-date" }));
    expect(result.success).toBe(false);
  });

  it("rejette un deviceId non-UUID", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ deviceId: "xxx" }));
    expect(result.success).toBe(false);
  });

  it("rejette un recordId trop long", () => {
    const result = syncEnvelopeSchema.safeParse(validEnvelope({ recordId: "a".repeat(101) }));
    expect(result.success).toBe(false);
  });
});

describe("syncMetaSchema", () => {
  it("accepte des métadonnées valides", () => {
    const result = syncMetaSchema.safeParse({
      vaultId: VALID_UUID,
      kind: "record",
      recordId: "app-1",
      collection: "applications",
      size: 1024,
      updatedAt: "2025-01-15T10:30:00.000Z",
      deviceId: VALID_UUID_2,
      tombstone: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejette une taille négative", () => {
    const result = syncMetaSchema.safeParse({
      vaultId: VALID_UUID,
      kind: "record",
      recordId: "app-1",
      collection: "applications",
      size: -1,
      updatedAt: "2025-01-15T10:30:00.000Z",
      deviceId: VALID_UUID_2,
      tombstone: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("pullResponseSchema", () => {
  it("accepte une réponse de pull valide", () => {
    const result = pullResponseSchema.safeParse({
      serverNow: "2025-01-15T10:30:00.000Z",
      changes: [
        {
          vaultId: VALID_UUID,
          kind: "record",
          recordId: "app-1",
          collection: "applications",
          size: 512,
          updatedAt: "2025-01-15T10:00:00.000Z",
          deviceId: VALID_UUID_2,
          tombstone: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepte une réponse vide (pas de changements)", () => {
    const result = pullResponseSchema.safeParse({
      serverNow: "2025-01-15T10:30:00.000Z",
      changes: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejette une réponse sans serverNow", () => {
    const result = pullResponseSchema.safeParse({ changes: [] });
    expect(result.success).toBe(false);
  });
});

describe("recordResponseSchema", () => {
  it("accepte une réponse record valide", () => {
    const result = recordResponseSchema.safeParse({
      envelope: validEnvelope(),
    });
    expect(result.success).toBe(true);
  });

  it("rejette une réponse sans envelope", () => {
    const result = recordResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("pushRequestSchema", () => {
  it("accepte un batch valide", () => {
    const result = pushRequestSchema.safeParse({
      envelopes: [validEnvelope(), validEnvelope({ recordId: "app-2" })],
    });
    expect(result.success).toBe(true);
  });

  it("rejette un batch vide", () => {
    const result = pushRequestSchema.safeParse({ envelopes: [] });
    expect(result.success).toBe(false);
  });

  it("rejette un batch de plus de 500 enveloppes", () => {
    const envelopes = Array.from({ length: 501 }, (_, i) =>
      validEnvelope({ recordId: `app-${i}` })
    );
    const result = pushRequestSchema.safeParse({ envelopes });
    expect(result.success).toBe(false);
  });
});

describe("pushResponseSchema", () => {
  it("accepte une réponse valide", () => {
    const result = pushResponseSchema.safeParse({
      accepted: 42,
      serverNow: "2025-01-15T10:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});

describe("pairingInitRequestSchema", () => {
  it("accepte une demande valide", () => {
    const result = pairingInitRequestSchema.safeParse({
      vaultId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "MacBook de Yassine",
      code: "123456",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un code non numérique", () => {
    const result = pairingInitRequestSchema.safeParse({
      vaultId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "Test",
      code: "abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un code de mauvaise longueur", () => {
    const result = pairingInitRequestSchema.safeParse({
      vaultId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "Test",
      code: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("pairingInitResponseSchema", () => {
  it("accepte une réponse valide", () => {
    const result = pairingInitResponseSchema.safeParse({
      pending: true,
      pairingId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });
});

describe("pairingStatusSchema", () => {
  it("accepte tous les statuts", () => {
    for (const status of ["pending", "approved", "denied", "expired"]) {
      const result = pairingStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejette un statut inconnu", () => {
    const result = pairingStatusSchema.safeParse({ status: "unknown" });
    expect(result.success).toBe(false);
  });
});

describe("pairingConfirmRequestSchema", () => {
  it("accepte une confirmation valide", () => {
    const result = pairingConfirmRequestSchema.safeParse({
      pairingId: VALID_UUID,
      approvedByDeviceId: VALID_UUID_2,
      approved: true,
      proof: "hmac-sha256-hex",
    });
    expect(result.success).toBe(true);
  });

  it("rejette une preuve vide", () => {
    const result = pairingConfirmRequestSchema.safeParse({
      pairingId: VALID_UUID,
      approvedByDeviceId: VALID_UUID_2,
      approved: true,
      proof: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("pairedDeviceSchema", () => {
  it("accepte un appareil valide", () => {
    const result = pairedDeviceSchema.safeParse({
      deviceId: VALID_UUID,
      deviceName: "iPhone de Yassine",
      isCurrent: true,
      pairedAt: "2025-01-15T10:00:00.000Z",
      lastSeenAt: "2025-01-15T10:30:00.000Z",
      revoked: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejette un nom trop long", () => {
    const result = pairedDeviceSchema.safeParse({
      deviceId: VALID_UUID,
      deviceName: "a".repeat(101),
      pairedAt: "2025-01-15T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("pendingPairingSchema", () => {
  it("accepte une demande en attente valide", () => {
    const result = pendingPairingSchema.safeParse({
      pairingId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "iPhone de Yassine",
      createdAt: "2025-01-15T10:00:00.000Z",
      expiresAt: "2025-01-15T10:10:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un newDeviceName vide", () => {
    const result = pendingPairingSchema.safeParse({
      pairingId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "",
      createdAt: "2025-01-15T10:00:00.000Z",
      expiresAt: "2025-01-15T10:10:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejette un pairingId non-UUID", () => {
    const result = pendingPairingSchema.safeParse({
      pairingId: "pas-un-uuid",
      newDeviceId: VALID_UUID_2,
      newDeviceName: "Test",
      createdAt: "2025-01-15T10:00:00.000Z",
      expiresAt: "2025-01-15T10:10:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("pendingPairingsResponseSchema", () => {
  it("accepte une liste de demandes en attente", () => {
    const result = pendingPairingsResponseSchema.safeParse({
      pending: [
        {
          pairingId: VALID_UUID,
          newDeviceId: VALID_UUID_2,
          newDeviceName: "MacBook",
          createdAt: "2025-01-15T10:00:00.000Z",
          expiresAt: "2025-01-15T10:10:00.000Z",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepte une liste vide", () => {
    const result = pendingPairingsResponseSchema.safeParse({ pending: [] });
    expect(result.success).toBe(true);
  });

  it("rejette plus de 20 demandes", () => {
    const pending = Array.from({ length: 21 }, () => ({
      pairingId: VALID_UUID,
      newDeviceId: VALID_UUID_2,
      newDeviceName: "Test",
      createdAt: "2025-01-15T10:00:00.000Z",
      expiresAt: "2025-01-15T10:10:00.000Z",
    }));
    const result = pendingPairingsResponseSchema.safeParse({ pending });
    expect(result.success).toBe(false);
  });
});

describe("deviceListResponseSchema", () => {
  it("accepte une liste d'appareils", () => {
    const result = deviceListResponseSchema.safeParse({
      devices: [
        {
          deviceId: VALID_UUID,
          deviceName: "MacBook",
          isCurrent: true,
          pairedAt: "2025-01-15T10:00:00.000Z",
          revoked: false,
        },
        {
          deviceId: VALID_UUID_2,
          deviceName: "iPhone",
          isCurrent: false,
          pairedAt: "2025-01-16T10:00:00.000Z",
          revoked: false,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejette une liste de plus de 100 appareils", () => {
    const devices = Array.from({ length: 101 }, () => ({
      deviceId: VALID_UUID,
      deviceName: "Test",
      pairedAt: "2025-01-15T10:00:00.000Z",
    }));
    const result = deviceListResponseSchema.safeParse({ devices });
    expect(result.success).toBe(false);
  });
});
