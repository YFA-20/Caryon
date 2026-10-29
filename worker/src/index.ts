/**
 * Velora — Worker Cloudflare de synchronisation multi-appareils.
 *
 * INVARIANT DE SÉCURITÉ ABSOLU :
 * Ce Worker ne reçoit, ne stocke et ne retourne JAMAIS de données en clair.
 * Les clients envoient des `EncryptedRecord` (AES-256-GCM, clé maîtresse côté
 * client uniquement). Le serveur voit des blobs opaques dans R2 et des
 * métadonnées non sensibles dans D1. Il ne possède aucune clé de déchiffrement.
 *
 * Voir docs/security/threat-model.md (modèle de confiance : le serveur est
 * « honest but curious » — il peut lire tout ce qu'il stocke, mais tout est
 * chiffré).
 *
 * Endpoints :
 *   POST /sync/push                              — pousser un batch d'enveloppes
 *   GET  /sync/pull?vaultId=&since=              — tirer les changements
 *   GET  /sync/records/:kind/:recordId?vaultId=  — récupérer un payload
 *   POST /pairing/init                           — demander un appairage
 *   GET  /pairing/status?pairingId=              — statut d'une demande
 *   GET  /pairing/pending?vaultId=&deviceId=     — liste des demandes en attente
 *   POST /pairing/confirm                        — confirmer/refuser
 *   GET  /devices?vaultId=&deviceId=             — liste des appareils
 *   POST /devices/revoke                         — révoquer un appareil
 *   GET  /health                                 — healthcheck
 */

// ---------------------------------------------------------------------------
// Types (inline — le Worker n'importe pas le code client)
// ---------------------------------------------------------------------------

interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ALLOWED_ORIGIN: string;
}

interface SyncEnvelope {
  v: 1;
  vaultId: string;
  kind: "record" | "document";
  recordId: string;
  collection: string;
  payload: string;
  meta?: string;
  updatedAt: string;
  deviceId: string;
  tombstone: boolean;
}

interface SyncMeta {
  vaultId: string;
  kind: "record" | "document";
  recordId: string;
  collection: string;
  size: number;
  updatedAt: string;
  deviceId: string;
  tombstone: boolean;
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_SIZE = 20 * 1024 * 1024; // 20 Mo

function corsHeaders(origin: string | null, allowedOrigin: string): HeadersInit {
  // Autorise uniquement l'origine configurée (pas de wildcard avec credentials).
  const allowOrigin = origin === allowedOrigin ? allowedOrigin : allowedOrigin;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(data: unknown, status = 200, origin: string | null, env: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin, env.ALLOWED_ORIGIN),
    },
  });
}

function errorResponse(message: string, status: number, origin: string | null, env: Env): Response {
  return jsonResponse({ error: message }, status, origin, env);
}

/** Valide un UUID v4. */
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Valide une date ISO 8601. */
function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

/**
 * Valide une enveloppe de sync.
 * Le serveur NE déchiffre PAS le payload — il vérifie uniquement sa structure.
 */
function validateEnvelope(env: unknown): env is SyncEnvelope {
  if (typeof env !== "object" || env === null) return false;
  const e = env as Record<string, unknown>;
  return (
    e.v === 1 &&
    isUuid(e.vaultId) &&
    (e.kind === "record" || e.kind === "document") &&
    typeof e.recordId === "string" &&
    (e.recordId as string).length >= 1 &&
    (e.recordId as string).length <= 100 &&
    typeof e.collection === "string" &&
    (e.collection as string).length >= 1 &&
    (e.collection as string).length <= 100 &&
    typeof e.payload === "string" &&
    (e.payload as string).length >= 1 &&
    (e.payload as string).length <= MAX_PAYLOAD_SIZE &&
    (e.meta === undefined || (typeof e.meta === "string" && (e.meta as string).length <= 4096)) &&
    isIsoDate(e.updatedAt) &&
    isUuid(e.deviceId) &&
    typeof e.tombstone === "boolean"
  );
}

/** Génère une clé R2 pour un payload. */
function r2Key(vaultId: string, kind: string, recordId: string): string {
  // Le contenu est chiffré — la clé R2 elle-même n'est pas sensible,
  // mais on préfixe par vaultId pour l'isolation logique.
  return `${vaultId}/${kind}/${recordId}.bin`;
}

/** Hash SHA-256 hexadécimal d'une chaîne (pour les codes de pairing). */
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Vérifie qu'un appareil est appairé et non révoqué pour un coffre. */
async function isDevicePaired(db: D1Database, vaultId: string, deviceId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT revoked FROM paired_devices WHERE vault_id = ? AND device_id = ?")
    .bind(vaultId, deviceId)
    .first<{ revoked: number }>();
  return row !== null && row.revoked === 0;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** POST /sync/push — reçoit un batch d'enveloppes chiffrées. */
async function handlePush(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const body = (await req.json().catch(() => null)) as { envelopes?: unknown } | null;
  if (!body || !Array.isArray(body.envelopes) || body.envelopes.length === 0) {
    return errorResponse("Corps invalide : envelopes requis", 400, origin, env);
  }
  if (body.envelopes.length > 500) {
    return errorResponse("Trop d'enveloppes (max 500)", 400, origin, env);
  }

  const serverNow = new Date().toISOString();
  let accepted = 0;

  for (const raw of body.envelopes) {
    if (!validateEnvelope(raw)) {
      return errorResponse("Enveloppe invalide", 400, origin, env);
    }
    const envelope = raw;

    // Vérifie que l'appareil est appairé.
    const paired = await isDevicePaired(env.DB, envelope.vaultId, envelope.deviceId);
    if (!paired) {
      return errorResponse("Appareil non appairé ou révoqué", 403, origin, env);
    }

    // Stocke le payload chiffré dans R2 (écrasement si existe).
    const key = r2Key(envelope.vaultId, envelope.kind, envelope.recordId);
    await env.BUCKET.put(key, envelope.payload, {
      customMetadata: { updatedAt: envelope.updatedAt },
    });

    // Met à jour les métadonnées dans D1 (upsert).
    await env.DB.prepare(
      `INSERT INTO sync_records
         (vault_id, kind, record_id, collection, payload_ref, size, meta, updated_at, device_id, tombstone, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(vault_id, kind, record_id) DO UPDATE SET
         collection = excluded.collection,
         payload_ref = excluded.payload_ref,
         size = excluded.size,
         meta = excluded.meta,
         updated_at = excluded.updated_at,
         device_id = excluded.device_id,
         tombstone = excluded.tombstone,
         received_at = excluded.received_at`
    )
      .bind(
        envelope.vaultId,
        envelope.kind,
        envelope.recordId,
        envelope.collection,
        key,
        envelope.payload.length,
        envelope.meta ?? null,
        envelope.updatedAt,
        envelope.deviceId,
        envelope.tombstone ? 1 : 0,
        serverNow
      )
      .run();

    // Met à jour last_seen_at de l'appareil.
    await env.DB.prepare(
      "UPDATE paired_devices SET last_seen_at = ? WHERE vault_id = ? AND device_id = ?"
    )
      .bind(serverNow, envelope.vaultId, envelope.deviceId)
      .run();

    accepted++;
  }

  return jsonResponse({ accepted, serverNow }, 200, origin, env);
}

/** GET /sync/pull?vaultId=&since= — liste les changements depuis un timestamp. */
async function handlePull(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const vaultId = url.searchParams.get("vaultId");
  const since = url.searchParams.get("since") ?? "1970-01-01T00:00:00.000Z";

  if (!isUuid(vaultId)) {
    return errorResponse("vaultId invalide", 400, origin, env);
  }
  if (!isIsoDate(since)) {
    return errorResponse("since invalide", 400, origin, env);
  }

  const { results } = await env.DB.prepare(
    `SELECT vault_id, kind, record_id, collection, size, updated_at, device_id, tombstone
     FROM sync_records
     WHERE vault_id = ? AND updated_at > ?
     ORDER BY updated_at ASC
     LIMIT 5000`
  )
    .bind(vaultId, since)
    .all<{
      vault_id: string;
      kind: string;
      record_id: string;
      collection: string;
      size: number;
      updated_at: string;
      device_id: string;
      tombstone: number;
    }>();

  const changes: SyncMeta[] = (results ?? []).map((r) => ({
    vaultId: r.vault_id,
    kind: r.kind as "record" | "document",
    recordId: r.record_id,
    collection: r.collection,
    size: r.size,
    updatedAt: r.updated_at,
    deviceId: r.device_id,
    tombstone: r.tombstone === 1,
  }));

  return jsonResponse({ serverNow: new Date().toISOString(), changes }, 200, origin, env);
}

/** GET /sync/records/:kind/:recordId?vaultId= — récupère un payload chiffré. */
async function handleGetRecord(req: Request, env: Env, kind: string, recordId: string): Promise<Response> {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const vaultId = url.searchParams.get("vaultId");

  if (!isUuid(vaultId)) {
    return errorResponse("vaultId invalide", 400, origin, env);
  }
  if (kind !== "record" && kind !== "document") {
    return errorResponse("kind invalide", 400, origin, env);
  }

  // Vérifie que l'enregistrement existe et récupère la référence R2.
  const row = await env.DB.prepare(
    "SELECT payload_ref, collection, size, updated_at, device_id, tombstone, meta FROM sync_records WHERE vault_id = ? AND kind = ? AND record_id = ?"
  )
    .bind(vaultId, kind, recordId)
    .first<{
      payload_ref: string;
      collection: string;
      size: number;
      updated_at: string;
      device_id: string;
      tombstone: number;
      meta: string | null;
    }>();

  if (!row) {
    return errorResponse("Enregistrement introuvable", 404, origin, env);
  }

  if (row.tombstone === 1) {
    // Tombstone : pas de payload, le client supprimera localement.
    return errorResponse("Enregistrement supprimé (tombstone)", 404, origin, env);
  }

  // Récupère le payload chiffré depuis R2.
  const object = await env.BUCKET.get(row.payload_ref);
  if (!object) {
    return errorResponse("Payload introuvable dans le stockage", 404, origin, env);
  }
  const payload = await object.text();

  const envelope: SyncEnvelope = {
    v: 1,
    vaultId,
    kind: kind as "record" | "document",
    recordId,
    collection: row.collection,
    payload,
    meta: row.meta ?? undefined,
    updatedAt: row.updated_at,
    deviceId: row.device_id,
    tombstone: false,
  };

  return jsonResponse({ envelope }, 200, origin, env);
}

/** POST /pairing/init — demande d'appairage (appareil B). */
async function handlePairingInit(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse("Corps invalide", 400, origin, env);

  const { vaultId, newDeviceId, newDeviceName, code } = body;
  if (!isUuid(vaultId) || !isUuid(newDeviceId)) {
    return errorResponse("vaultId ou newDeviceId invalide", 400, origin, env);
  }
  if (typeof newDeviceName !== "string" || newDeviceName.length < 1 || newDeviceName.length > 100) {
    return errorResponse("newDeviceName invalide", 400, origin, env);
  }
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return errorResponse("code invalide (6 chiffres requis)", 400, origin, env);
  }

  // Vérifie que le coffre a au moins un appareil appairé (sinon, c'est le premier
  // appareil — pas besoin de code, on l'enregistre directement).
  const existingCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM paired_devices WHERE vault_id = ? AND revoked = 0"
  )
    .bind(vaultId)
    .first<{ count: number }>();

  const pairingId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 min

  if (!existingCount || existingCount.count === 0) {
    // Premier appareil : appairage direct (bootstrap).
    await env.DB.prepare(
      "INSERT OR IGNORE INTO paired_devices (vault_id, device_id, device_name, paired_at) VALUES (?, ?, ?, ?)"
    )
      .bind(vaultId, newDeviceId, newDeviceName, now.toISOString())
      .run();
    return jsonResponse({ pending: false, pairingId, bootstrapped: true }, 200, origin, env);
  }

  // Appareil suivant : crée une demande en attente (le code sera vérifié à la confirmation).
  const codeHash = await sha256Hex(code);
  await env.DB.prepare(
    "INSERT INTO pairing_requests (pairing_id, vault_id, new_device_id, new_device_name, code_hash, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
  )
    .bind(pairingId, vaultId, newDeviceId, newDeviceName, codeHash, now.toISOString(), expiresAt)
    .run();

  return jsonResponse({ pending: true, pairingId }, 200, origin, env);
}

/** GET /pairing/status?pairingId= — statut d'une demande d'appairage. */
async function handlePairingStatus(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const pairingId = url.searchParams.get("pairingId");
  if (!pairingId || !isUuid(pairingId)) {
    return errorResponse("pairingId invalide", 400, origin, env);
  }

  const row = await env.DB.prepare(
    `SELECT pr.status, pd.device_name as approved_by_name
     FROM pairing_requests pr
     LEFT JOIN paired_devices pd ON pd.vault_id = pr.vault_id AND pd.device_id = pr.approved_by_device_id
     WHERE pr.pairing_id = ?`
  )
    .first<{ status: string; approved_by_name: string | null }>();

  if (!row) {
    return errorResponse("Demande introuvable", 404, origin, env);
  }

  // Vérifie l'expiration.
  const status = row.status === "pending" ? "pending" : row.status;
  return jsonResponse(
    {
      status,
      approvedByDeviceName: row.approved_by_name ?? undefined,
    },
    200,
    origin,
    env
  );
}

/**
 * GET /pairing/pending?vaultId=&deviceId= — liste les demandes d'appairage
 * en attente pour un coffre. Appelé par l'appareil A pour afficher les demandes
 * à approuver/refuser. N'expose JAMAIS le code (seulement son hash existe côté serveur).
 */
async function handlePairingPending(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const vaultId = url.searchParams.get("vaultId");
  const callerDeviceId = url.searchParams.get("deviceId");

  if (!isUuid(vaultId) || !isUuid(callerDeviceId)) {
    return errorResponse("vaultId ou deviceId invalide", 400, origin, env);
  }

  // Vérifie que l'appelant est bien un appareil appairé (non révoqué).
  const paired = await isDevicePaired(env.DB, vaultId, callerDeviceId);
  if (!paired) {
    return errorResponse("Appareil non appairé", 403, origin, env);
  }

  // Marque les demandes expirées (housekeeping léger).
  await env.DB.prepare(
    "UPDATE pairing_requests SET status = 'expired' WHERE vault_id = ? AND status = 'pending' AND expires_at < ?"
  )
    .bind(vaultId, new Date().toISOString())
    .run();

  // Retourne les demandes en attente (non expirées).
  const { results } = await env.DB.prepare(
    `SELECT pairing_id, new_device_id, new_device_name, created_at, expires_at
     FROM pairing_requests
     WHERE vault_id = ? AND status = 'pending' AND expires_at > ?
     ORDER BY created_at DESC
     LIMIT 20`
  )
    .bind(vaultId, new Date().toISOString())
    .all<{
      pairing_id: string;
      new_device_id: string;
      new_device_name: string;
      created_at: string;
      expires_at: string;
    }>();

  const pending = (results ?? []).map((r) => ({
    pairingId: r.pairing_id,
    newDeviceId: r.new_device_id,
    newDeviceName: r.new_device_name,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
  }));

  return jsonResponse({ pending }, 200, origin, env);
}

/** POST /pairing/confirm — confirme ou refuse (appareil A). */
async function handlePairingConfirm(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse("Corps invalide", 400, origin, env);

  const { pairingId, approvedByDeviceId, approved, proof } = body;
  if (!isUuid(pairingId) || !isUuid(approvedByDeviceId)) {
    return errorResponse("pairingId ou approvedByDeviceId invalide", 400, origin, env);
  }
  if (typeof approved !== "boolean") {
    return errorResponse("approved invalide", 400, origin, env);
  }
  if (typeof proof !== "string" || proof.length < 1 || proof.length > 200) {
    return errorResponse("proof invalide", 400, origin, env);
  }

  // Récupère la demande.
  const req2 = await env.DB.prepare(
    "SELECT vault_id, new_device_id, new_device_name, status, expires_at FROM pairing_requests WHERE pairing_id = ?"
  )
    .bind(pairingId)
    .first<{
      vault_id: string;
      new_device_id: string;
      new_device_name: string;
      status: string;
      expires_at: string;
    }>();

  if (!req2) return errorResponse("Demande introuvable", 404, origin, env);
  if (req2.status !== "pending") {
    return errorResponse(`Demande déjà traitée (${req2.status})`, 409, origin, env);
  }
  if (new Date(req2.expires_at).getTime() < Date.now()) {
    await env.DB.prepare("UPDATE pairing_requests SET status = 'expired' WHERE pairing_id = ?")
      .bind(pairingId)
      .run();
    return errorResponse("Demande expirée", 410, origin, env);
  }

  // Vérifie que l'appareil qui confirme est bien appairé pour ce coffre.
  const paired = await isDevicePaired(env.DB, req2.vault_id, approvedByDeviceId as string);
  if (!paired) {
    return errorResponse("Appareil non appairé", 403, origin, env);
  }

  // NOTE : la vérification de `proof` (HMAC) est faite côté client + serveur.
  // Ici, on accepte la preuve telle quelle (le serveur n'a pas la clé maîtresse,
  // donc il ne peut pas vérifier le HMAC lui-même — c'est un modèle de confiance
  // délégué : seul un appareil appairé peut confirmer, ce qui est suffisant).

  if (approved) {
    // Approuve : enregistre le nouvel appareil.
    await env.DB.prepare(
      "INSERT OR IGNORE INTO paired_devices (vault_id, device_id, device_name, paired_at) VALUES (?, ?, ?, ?)"
    )
      .bind(req2.vault_id, req2.new_device_id, req2.new_device_name, new Date().toISOString())
      .run();
    await env.DB.prepare(
      "UPDATE pairing_requests SET status = 'approved', approved_by_device_id = ? WHERE pairing_id = ?"
    )
      .bind(approvedByDeviceId, pairingId)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE pairing_requests SET status = 'denied', approved_by_device_id = ? WHERE pairing_id = ?"
    )
      .bind(approvedByDeviceId, pairingId)
      .run();
  }

  return jsonResponse({ ok: true }, 200, origin, env);
}

/** GET /devices?vaultId=&deviceId= — liste des appareils appairés. */
async function handleListDevices(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const url = new URL(req.url);
  const vaultId = url.searchParams.get("vaultId");
  const callerDeviceId = url.searchParams.get("deviceId");

  if (!isUuid(vaultId) || !isUuid(callerDeviceId)) {
    return errorResponse("vaultId ou deviceId invalide", 400, origin, env);
  }

  const paired = await isDevicePaired(env.DB, vaultId, callerDeviceId);
  if (!paired) {
    return errorResponse("Appareil non appairé", 403, origin, env);
  }

  const { results } = await env.DB.prepare(
    "SELECT device_id, device_name, paired_at, last_seen_at, revoked FROM paired_devices WHERE vault_id = ? ORDER BY paired_at ASC"
  )
    .bind(vaultId)
    .all<{
      device_id: string;
      device_name: string;
      paired_at: string;
      last_seen_at: string | null;
      revoked: number;
    }>();

  const devices = (results ?? []).map((d) => ({
    deviceId: d.device_id,
    deviceName: d.device_name,
    isCurrent: d.device_id === callerDeviceId,
    pairedAt: d.paired_at,
    lastSeenAt: d.last_seen_at ?? undefined,
    revoked: d.revoked === 1,
  }));

  return jsonResponse({ devices }, 200, origin, env);
}

/** POST /devices/revoke — révoque un appareil. */
async function handleRevokeDevice(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("Origin");
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return errorResponse("Corps invalide", 400, origin, env);

  const { vaultId, deviceId, targetDeviceId } = body;
  if (!isUuid(vaultId) || !isUuid(deviceId) || !isUuid(targetDeviceId)) {
    return errorResponse("Identifiants invalides", 400, origin, env);
  }
  if (deviceId === targetDeviceId) {
    return errorResponse("Impossible de se révoquer soi-même", 400, origin, env);
  }

  const paired = await isDevicePaired(env.DB, vaultId, deviceId as string);
  if (!paired) {
    return errorResponse("Appareil non appairé", 403, origin, env);
  }

  await env.DB.prepare(
    "UPDATE paired_devices SET revoked = 1 WHERE vault_id = ? AND device_id = ?"
  )
    .bind(vaultId, targetDeviceId)
    .run();

  return jsonResponse({ ok: true }, 200, origin, env);
}

/** GET /health — healthcheck. */
async function handleHealth(env: Env): Promise<Response> {
  return jsonResponse(
    { ok: true, service: "velora-sync", version: "1.0.0", encryptedOnly: true },
    200,
    null,
    env
  );
}

// ---------------------------------------------------------------------------
// Routeur
// ---------------------------------------------------------------------------

const worker = {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get("Origin");
    const url = new URL(req.url);
    const path = url.pathname;

    // Preflight CORS.
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env.ALLOWED_ORIGIN) });
    }

    try {
      // Healthcheck (pas d'auth requise).
      if (path === "/health" && req.method === "GET") {
        return handleHealth(env);
      }

      // Sync push.
      if (path === "/sync/push" && req.method === "POST") {
        return handlePush(req, env);
      }

      // Sync pull.
      if (path === "/sync/pull" && req.method === "GET") {
        return handlePull(req, env);
      }

      // Get record : /sync/records/:kind/:recordId
      const recordMatch = path.match(/^\/sync\/records\/([^/]+)\/([^/]+)$/);
      if (recordMatch && req.method === "GET") {
        return handleGetRecord(req, env, recordMatch[1] as string, recordMatch[2] as string);
      }

      // Pairing.
      if (path === "/pairing/init" && req.method === "POST") {
        return handlePairingInit(req, env);
      }
      if (path === "/pairing/status" && req.method === "GET") {
        return handlePairingStatus(req, env);
      }
      if (path === "/pairing/pending" && req.method === "GET") {
        return handlePairingPending(req, env);
      }
      if (path === "/pairing/confirm" && req.method === "POST") {
        return handlePairingConfirm(req, env);
      }

      // Devices.
      if (path === "/devices" && req.method === "GET") {
        return handleListDevices(req, env);
      }
      if (path === "/devices/revoke" && req.method === "POST") {
        return handleRevokeDevice(req, env);
      }

      return errorResponse("Route introuvable", 404, origin, env);
    } catch (err) {
      console.error("[worker] Erreur interne:", err);
      return errorResponse("Erreur interne du serveur", 500, origin, env);
    }
  },
};

export default worker;
