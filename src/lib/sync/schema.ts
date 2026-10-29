import { z } from "zod";

/**
 * Velora — schémas de synchronisation multi-appareils (Phase 3).
 *
 * INVARIANT DE SÉCURITÉ : le serveur de sync ne reçoit et ne stocke JAMAIS
 * de données en clair. Chaque enregistrement envoyé est un `EncryptedRow`
 * existant (déjà chiffré AES-256-GCM avec la clé maîtresse du coffre).
 * Le serveur voit des blobs opaques. Voir docs/security/threat-model.md.
 *
 * Le deviceId identifie un appareil appairé. Il est généré localement
 * (UUID aléatoire) et n'est PAS secret — il sert à taguer les écritures.
 */

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

export const deviceIdSchema = z.string().uuid();
export type DeviceId = z.infer<typeof deviceIdSchema>;

// ---------------------------------------------------------------------------
// Enveloppe de synchronisation d'un enregistrement
// ---------------------------------------------------------------------------

/**
 * Enveloppe envoyée au serveur pour chaque enregistrement (record ou document).
 * Le `payload` est la sérialisation JSON d'un EncryptedRecord existant —
 * le serveur ne peut ni le lire ni le modifier sans invalider le tag GCM.
 */
export const syncEnvelopeSchema = z.object({
  /** Version du protocole de sync. */
  v: z.literal(1),
  /** ID du coffre (Vault.id) — permet d'isoler les coffres sur le serveur. */
  vaultId: z.string().uuid(),
  /** Type d'objet : enregistrement métier ou document binaire. */
  kind: z.enum(["record", "document"]),
  /** ID de l'enregistrement dans IndexedDB. */
  recordId: z.string().min(1).max(100),
  /** Collection métier (ex: "applications", "goals", "settings"). */
  collection: z.string().min(1).max(100),
  /** Payload chiffré (JSON d'EncryptedRecord) — opaque pour le serveur. */
  payload: z
    .string()
    .min(1)
    .max(20 * 1024 * 1024),
  /** Métadonnées non sensibles (JSON string), ex: {"status":"sent"}. */
  meta: z.string().max(4096).optional(),
  /** Date de dernière modification (ISO 8601) — résolution last-write-wins. */
  updatedAt: z.string().datetime(),
  /** Appareil auteur de cette version. */
  deviceId: deviceIdSchema,
  /** Tombstone : true si l'enregistrement a été supprimé (pas de perte silencieuse). */
  tombstone: z.boolean().default(false),
});

export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Réponses du serveur
// ---------------------------------------------------------------------------

/** Métadonnées d'un enregistrement telles que stockées par le serveur (D1). */
export const syncMetaSchema = z.object({
  vaultId: z.string().uuid(),
  kind: z.enum(["record", "document"]),
  recordId: z.string().min(1).max(100),
  collection: z.string().min(1).max(100),
  /** Taille du payload en octets (le contenu réel est dans R2). */
  size: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  deviceId: deviceIdSchema,
  tombstone: z.boolean().default(false),
});

export type SyncMeta = z.infer<typeof syncMetaSchema>;

/** Réponse GET /sync/pull?since=… : liste des changements depuis un timestamp. */
export const pullResponseSchema = z.object({
  /** Timestamp serveur de la réponse (pour le prochain appel `since`). */
  serverNow: z.string().datetime(),
  /** Métadonnées des enregistrements modifiés/supprimés depuis `since`. */
  changes: z.array(syncMetaSchema).max(5000),
});

export type PullResponse = z.infer<typeof pullResponseSchema>;

/** Réponse GET /sync/records/{kind}/{recordId} : payload chiffré complet. */
export const recordResponseSchema = z.object({
  envelope: syncEnvelopeSchema,
});

export type RecordResponse = z.infer<typeof recordResponseSchema>;

// ---------------------------------------------------------------------------
// Appairage (pairing)
// ---------------------------------------------------------------------------

/**
 * Étape 1 — l'appareil B (nouveau) envoie une demande d'appairage avec un
 * code à 6 chiffres affiché par l'appareil A (déjà appairé).
 */
export const pairingInitRequestSchema = z.object({
  vaultId: z.string().uuid(),
  /** ID du nouvel appareil (généré localement). */
  newDeviceId: deviceIdSchema,
  /** Nom lisible du nouvel appareil (ex: "MacBook de Yassine"). */
  newDeviceName: z.string().min(1).max(100),
  /** Code à 6 chiffres affiché sur l'appareil A. */
  code: z.string().regex(/^\d{6}$/),
});

export type PairingInitRequest = z.infer<typeof pairingInitRequestSchema>;

export const pairingInitResponseSchema = z.object({
  /** Demande créée, en attente de confirmation sur l'appareil A. */
  pending: z.boolean(),
  /** ID de la demande d'appairage (à confirmer depuis l'appareil A). */
  pairingId: z.string().uuid(),
});

export type PairingInitResponse = z.infer<typeof pairingInitResponseSchema>;

/** État d'une demande d'appairage (polling côté appareil B). */
export const pairingStatusSchema = z.object({
  status: z.enum(["pending", "approved", "denied", "expired"]),
  /** Renseigné quand approuvé : nom de l'appareil qui a confirmé. */
  approvedByDeviceName: z.string().max(100).optional(),
});

export type PairingStatus = z.infer<typeof pairingStatusSchema>;

/**
 * Étape 2 — l'appareil A (déjà appairé) confirme ou refuse la demande.
 * Authentifié par le deviceId + une preuve de possession de la clé maîtresse
 * (voir pairing-service côté client : HMAC de pairingId avec une clé dérivée).
 */
export const pairingConfirmRequestSchema = z.object({
  pairingId: z.string().uuid(),
  /** ID de l'appareil A qui confirme. */
  approvedByDeviceId: deviceIdSchema,
  /** true = approuver, false = refuser. */
  approved: z.boolean(),
  /** Preuve de possession : HMAC-SHA256(pairingId, clé dérivée du coffre). */
  proof: z.string().min(1).max(200),
});

export type PairingConfirmRequest = z.infer<typeof pairingConfirmRequestSchema>;

export const pairingConfirmResponseSchema = z.object({
  ok: z.boolean(),
});

export type PairingConfirmResponse = z.infer<typeof pairingConfirmResponseSchema>;

// ---------------------------------------------------------------------------
// Demandes d'appairage en attente (côté appareil A)
// ---------------------------------------------------------------------------

/** Une demande d'appairage en attente de confirmation. */
export const pendingPairingSchema = z.object({
  pairingId: z.string().uuid(),
  newDeviceId: deviceIdSchema,
  newDeviceName: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type PendingPairing = z.infer<typeof pendingPairingSchema>;

export const pendingPairingsResponseSchema = z.object({
  pending: z.array(pendingPairingSchema).max(20),
});

export type PendingPairingsResponse = z.infer<typeof pendingPairingsResponseSchema>;

// ---------------------------------------------------------------------------
// Liste des appareils appairés
// ---------------------------------------------------------------------------

export const pairedDeviceSchema = z.object({
  deviceId: deviceIdSchema,
  deviceName: z.string().min(1).max(100),
  /** Appareil courant (celui sur lequel on consulte). */
  isCurrent: z.boolean().default(false),
  /** Date d'appairage (ISO 8601). */
  pairedAt: z.string().datetime(),
  /** Date de dernière activité de sync (ISO 8601), si connue. */
  lastSeenAt: z.string().datetime().optional(),
  /** Révoqué ? Un appareil révoqué ne peut plus pousser/tirer. */
  revoked: z.boolean().default(false),
});

export type PairedDevice = z.infer<typeof pairedDeviceSchema>;

export const deviceListResponseSchema = z.object({
  devices: z.array(pairedDeviceSchema).max(100),
});

export type DeviceListResponse = z.infer<typeof deviceListResponseSchema>;

// ---------------------------------------------------------------------------
// Push batch
// ---------------------------------------------------------------------------

/** Requête POST /sync/push : lot d'enveloppes (max 500 par appel). */
export const pushRequestSchema = z.object({
  envelopes: z.array(syncEnvelopeSchema).min(1).max(500),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;

export const pushResponseSchema = z.object({
  /** Nombre d'enveloppes acceptées par le serveur. */
  accepted: z.number().int().nonnegative(),
  /** Timestamp serveur (pour le prochain pull). */
  serverNow: z.string().datetime(),
});

export type PushResponse = z.infer<typeof pushResponseSchema>;
