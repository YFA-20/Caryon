/**
 * Velora — service de synchronisation multi-appareils (Phase 3).
 *
 * INVARIANT DE SÉCURITÉ : ce service ne manipule QUE des données déjà chiffrées
 * (EncryptedRow.payload = JSON d'EncryptedRecord AES-256-GCM). Le serveur de sync
 * (Cloudflare Worker) ne reçoit jamais de données en clair, ni de clés.
 *
 * La sync est OPT-IN : si `syncEnabled` est false dans les settings, aucune
 * requête réseau n'est émise. L'app reste 100 % local-first par défaut.
 *
 * Résolution des conflits : last-write-wins par `updatedAt` (ISO 8601, donc
 * comparaison lexicographique fiable). Les suppressions sont des tombstones
 * (pas de perte silencieuse).
 */
import { db, type EncryptedRow, type DocumentRow } from "@/lib/db/database";
import { getSettings } from "@/lib/vault/goal-repository";
import { isUnlocked, getSession } from "@/lib/vault/vault-service";
import { useSyncStore } from "@/store/sync-store";
import {
  pushRequestSchema,
  pushResponseSchema,
  pullResponseSchema,
  recordResponseSchema,
  deviceListResponseSchema,
  pairingInitRequestSchema,
  pairingInitResponseSchema,
  pairingStatusSchema,
  pairingConfirmRequestSchema,
  pairingConfirmResponseSchema,
  pendingPairingsResponseSchema,
  type PendingPairingsResponse,
  type SyncEnvelope,
  type PullResponse,
  type DeviceListResponse,
  type PairingInitResponse,
  type PairingStatus,
  type PairingInitRequest,
  type PairingConfirmRequest,
} from "@/lib/sync/schema";

/** URL par défaut du Worker de sync (peut être surchargée dans les settings). */
export const DEFAULT_SYNC_ENDPOINT = "https://sync.caryon.workers.dev";

/** Nombre max d'enregistrements dans un batch push. */
const PUSH_BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Retourne l'endpoint de sync configuré (settings ou défaut). */
export async function getSyncEndpoint(): Promise<string> {
  const settings = await getSettings();
  const endpoint = settings.syncEndpoint.trim();
  return endpoint.length > 0 ? endpoint : DEFAULT_SYNC_ENDPOINT;
}

/** La sync est-elle activée ET le coffre déverrouillé ? */
export async function isSyncReady(): Promise<boolean> {
  if (!isUnlocked()) return false;
  const settings = await getSettings();
  return settings.syncEnabled;
}

// ---------------------------------------------------------------------------
// Construction des enveloppes (depuis les données locales chiffrées)
// ---------------------------------------------------------------------------

function rowToEnvelope(row: EncryptedRow, vaultId: string, deviceId: string): SyncEnvelope {
  return {
    v: 1,
    vaultId,
    kind: "record",
    recordId: row.id,
    collection: row.collection,
    payload: row.payload,
    meta: row.meta,
    updatedAt: row.updatedAt,
    deviceId,
    tombstone: false,
  };
}

function documentToEnvelope(doc: DocumentRow, vaultId: string, deviceId: string): SyncEnvelope {
  // Un document est stocké comme un payload JSON {meta, content} chiffré.
  const payload = JSON.stringify({ meta: doc.meta, content: doc.content });
  return {
    v: 1,
    vaultId,
    kind: "document",
    recordId: doc.id,
    collection: "documents",
    payload,
    updatedAt: doc.updatedAt,
    deviceId,
    tombstone: false,
  };
}

// ---------------------------------------------------------------------------
// Push : envoi des changements locaux vers le serveur
// ---------------------------------------------------------------------------

/**
 * Pousse TOUTES les données locales chiffrées vers le serveur.
 * Appelé lors de l'activation de la sync, ou manuellement ("Synchroniser").
 * Retourne le nombre d'enveloppes envoyées.
 */
export async function pushAll(): Promise<number> {
  const store = useSyncStore.getState();
  const endpoint = await getSyncEndpoint();
  const session = getSession();
  if (!session) throw new Error("Coffre verrouillé");

  const vaultId = session.vault.id;
  const deviceId = store.deviceId;

  // Récupère tous les enregistrements et documents locaux.
  const rows = await db.records.toArray();
  const docs = await db.documents.toArray();

  const envelopes: SyncEnvelope[] = [
    ...rows.map((r) => rowToEnvelope(r, vaultId, deviceId)),
    ...docs.map((d) => documentToEnvelope(d, vaultId, deviceId)),
  ];

  // Envoi par batch pour ne pas dépasser les limites du Worker.
  let total = 0;
  for (let i = 0; i < envelopes.length; i += PUSH_BATCH_SIZE) {
    const batch = envelopes.slice(i, i + PUSH_BATCH_SIZE);
    const body = pushRequestSchema.parse({ envelopes: batch });
    const res = await fetch(`${endpoint}/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Push échoué (HTTP ${res.status})`);
    }
    const json = await res.json();
    // Validation stricte de la réponse serveur (Zod).
    const parsed = pushResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error("Réponse serveur invalide (push)");
    }
    // Mémorise le timestamp serveur pour le prochain pull.
    useSyncStore.getState().setLastSyncAt(parsed.data.serverNow);
    total += batch.length;
  }

  return total;
}

// ---------------------------------------------------------------------------
// Pull : récupération des changements distants
// ---------------------------------------------------------------------------

/**
 * Tire les changements depuis le serveur depuis le dernier sync.
 * Applique les enveloppes reçues en local (last-write-wins + tombstones).
 * Retourne le nombre de changements appliqués.
 */
export async function pullChanges(): Promise<number> {
  const store = useSyncStore.getState();
  const endpoint = await getSyncEndpoint();
  const session = getSession();
  if (!session) throw new Error("Coffre verrouillé");

  const vaultId = session.vault.id;
  const since = store.lastSyncAt ?? "1970-01-01T00:00:00.000Z";

  const res = await fetch(
    `${endpoint}/sync/pull?vaultId=${encodeURIComponent(vaultId)}&since=${encodeURIComponent(since)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    throw new Error(`Pull échoué (HTTP ${res.status})`);
  }
  const json = await res.json();
  const parsed = pullResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Réponse serveur invalide (pull)");
  }
  const data: PullResponse = parsed.data;

  let applied = 0;
  for (const meta of data.changes) {
    // Ignore les changements provenant de cet appareil (pas d'écho inutile).
    if (meta.deviceId === store.deviceId) continue;

    // Récupère le payload complet.
    const recRes = await fetch(
      `${endpoint}/sync/records/${meta.kind}/${encodeURIComponent(meta.recordId)}?vaultId=${encodeURIComponent(vaultId)}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );
    if (recRes.status === 404) {
      // Tombstone sans payload — on applique la suppression locale.
      await applyRemoteTombstone(meta.kind, meta.recordId);
      applied++;
      continue;
    }
    if (!recRes.ok) continue;

    const recJson = await recRes.json();
    const recParsed = recordResponseSchema.safeParse(recJson);
    if (!recParsed.success) continue;
    const envelope = recParsed.data.envelope;

    await applyRemoteEnvelope(envelope);
    applied++;
  }

  // Mémorise le timestamp serveur pour le prochain pull.
  useSyncStore.getState().setLastSyncAt(data.serverNow);
  return applied;
}

/**
 * Applique une enveloppe reçue du serveur en local.
 * Last-write-wins : on écrase uniquement si la version distante est plus récente.
 * Les tombstones suppriment l'enregistrement local.
 */
async function applyRemoteEnvelope(envelope: SyncEnvelope): Promise<void> {
  if (envelope.kind === "record") {
    const existing = await db.records.get(envelope.recordId);
    if (envelope.tombstone) {
      if (existing) await db.records.delete(envelope.recordId);
      return;
    }
    if (existing && existing.updatedAt > envelope.updatedAt) {
      // Version locale plus récente — on garde la locale (last-write-wins).
      return;
    }
    await db.records.put({
      id: envelope.recordId,
      collection: envelope.collection,
      payload: envelope.payload,
      meta: envelope.meta,
      updatedAt: envelope.updatedAt,
    });
  } else {
    const existing = await db.documents.get(envelope.recordId);
    if (envelope.tombstone) {
      if (existing) await db.documents.delete(envelope.recordId);
      return;
    }
    if (existing && existing.updatedAt > envelope.updatedAt) return;
    // Le payload document est {meta, content} sérialisé.
    const parsed = JSON.parse(envelope.payload) as { meta: string; content: string };
    await db.documents.put({
      id: envelope.recordId,
      meta: parsed.meta,
      content: parsed.content,
      version: 1,
      updatedAt: envelope.updatedAt,
    });
  }
}

async function applyRemoteTombstone(kind: "record" | "document", recordId: string): Promise<void> {
  if (kind === "record") {
    await db.records.delete(recordId);
  } else {
    await db.documents.delete(recordId);
  }
}

// ---------------------------------------------------------------------------
// Sync complète (push + pull)
// ---------------------------------------------------------------------------

/**
 * Effectue une synchronisation complète : push de tout le local, puis pull
 * des changements distants. Met à jour le store Zustand (status, lastSyncAt).
 */
export async function syncNow(): Promise<{ pushed: number; pulled: number }> {
  const store = useSyncStore.getState();
  store.setStatus("syncing");
  store.setLastError(null);
  try {
    const pushed = await pushAll();
    const pulled = await pullChanges();
    store.setStatus("idle");
    return { pushed, pulled };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur de synchronisation";
    store.setStatus("error");
    store.setLastError(message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Appairage (pairing)
// ---------------------------------------------------------------------------

/**
 * Génère un code à 6 chiffres pour l'appairage (affiché sur l'appareil A).
 * Le code est valide 10 minutes côté serveur.
 */
export function generatePairingCode(): string {
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % 1000000;
  return n.toString().padStart(6, "0");
}

/**
 * Étape 1 (appareil B) : envoie une demande d'appairage avec le code
 * affiché sur l'appareil A. Retourne le pairingId à surveiller.
 */
export async function requestPairing(
  vaultId: string,
  deviceName: string,
  code: string
): Promise<PairingInitResponse> {
  const endpoint = await getSyncEndpoint();
  const deviceId = useSyncStore.getState().deviceId;
  const body: PairingInitRequest = {
    vaultId,
    newDeviceId: deviceId,
    newDeviceName: deviceName,
    code,
  };
  const validated = pairingInitRequestSchema.parse(body);
  const res = await fetch(`${endpoint}/pairing/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });
  if (!res.ok) throw new Error(`Appairage refusé (HTTP ${res.status})`);
  const json = await res.json();
  const parsed = pairingInitResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("Réponse serveur invalide (pairing init)");
  return parsed.data;
}

/** Étape 1b (appareil B) : surveille le statut de la demande d'appairage. */
export async function pollPairingStatus(pairingId: string): Promise<PairingStatus> {
  const endpoint = await getSyncEndpoint();
  const res = await fetch(`${endpoint}/pairing/status?pairingId=${encodeURIComponent(pairingId)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Statut pairing indisponible (HTTP ${res.status})`);
  const json = await res.json();
  const parsed = pairingStatusSchema.safeParse(json);
  if (!parsed.success) throw new Error("Réponse serveur invalide (pairing status)");
  return parsed.data;
}

/**
 * Étape 2 (appareil A) : confirme ou refuse une demande d'appairage.
 * La `proof` est un HMAC-SHA256 du pairingId avec une clé dérivée du coffre
 * (HKDF depuis la clé maîtresse) — le serveur vérifie cette preuve pour
 * s'assurer que seul un appareil possédant la clé maîtresse peut approuver.
 */
export async function confirmPairing(
  pairingId: string,
  approved: boolean,
  proof: string
): Promise<void> {
  const endpoint = await getSyncEndpoint();
  const deviceId = useSyncStore.getState().deviceId;
  const body: PairingConfirmRequest = {
    pairingId,
    approvedByDeviceId: deviceId,
    approved,
    proof,
  };
  const validated = pairingConfirmRequestSchema.parse(body);
  const res = await fetch(`${endpoint}/pairing/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(validated),
  });
  if (!res.ok) throw new Error(`Confirmation refusée (HTTP ${res.status})`);
  const json = await res.json();
  const parsed = pairingConfirmResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("Réponse serveur invalide (pairing confirm)");
}

/**
 * Liste les demandes d'appairage en attente pour ce coffre (appareil A).
 * Appelé par l'appareil déjà appairé pour afficher les demandes à approuver.
 */
export async function listPendingPairings(vaultId: string): Promise<PendingPairingsResponse> {
  const endpoint = await getSyncEndpoint();
  const deviceId = useSyncStore.getState().deviceId;
  const res = await fetch(
    `${endpoint}/pairing/pending?vaultId=${encodeURIComponent(vaultId)}&deviceId=${encodeURIComponent(deviceId)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Demandes en attente indisponibles (HTTP ${res.status})`);
  const json = await res.json();
  const parsed = pendingPairingsResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("Réponse serveur invalide (pairing pending)");
  return parsed.data;
}

/**
 * Confirme ou refuse une demande d'appairage (appareil A).
 * Génère automatiquement la preuve de possession (HMAC dérivée du coffre).
 */
export async function approvePairing(pairingId: string, approved: boolean): Promise<void> {
  const { generatePairingProof } = await import("@/lib/sync/pairing-proof");
  const proof = await generatePairingProof(pairingId);
  await confirmPairing(pairingId, approved, proof);
}

/** Liste les appareils appairés pour ce coffre. */
export async function listPairedDevices(vaultId: string): Promise<DeviceListResponse> {
  const endpoint = await getSyncEndpoint();
  const deviceId = useSyncStore.getState().deviceId;
  const res = await fetch(
    `${endpoint}/devices?vaultId=${encodeURIComponent(vaultId)}&deviceId=${encodeURIComponent(deviceId)}`,
    { method: "GET", headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`Liste des appareils indisponible (HTTP ${res.status})`);
  const json = await res.json();
  const parsed = deviceListResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error("Réponse serveur invalide (devices)");
  return parsed.data;
}

/** Révoque un appareil appairé (il ne pourra plus pousser/tirer). */
export async function revokeDevice(vaultId: string, targetDeviceId: string): Promise<void> {
  const endpoint = await getSyncEndpoint();
  const deviceId = useSyncStore.getState().deviceId;
  const res = await fetch(`${endpoint}/devices/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vaultId, deviceId, targetDeviceId }),
  });
  if (!res.ok) throw new Error(`Révocation refusée (HTTP ${res.status})`);
}
