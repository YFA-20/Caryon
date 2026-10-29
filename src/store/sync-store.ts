import { create } from "zustand";

/**
 * Velora — état de synchronisation (Zustand).
 *
 * RÈGLE DE SÉCURITÉ : ce store ne contient JAMAIS de clé, de phrase secrète
 * ni de données métier en clair. Uniquement des drapeaux d'état de sync.
 *
 * `lastSyncAt` et `deviceId` sont persistés dans localStorage (données non
 * sensibles : un timestamp et un UUID aléatoire d'appareil).
 */

const LAST_SYNC_KEY = "velora:sync:lastSyncAt";
const DEVICE_ID_KEY = "velora:sync:deviceId";

type SyncStatus = "idle" | "syncing" | "error" | "offline";

interface SyncState {
  /** Synchronisation activée par l'utilisateur (paramètres). */
  enabled: boolean;
  status: SyncStatus;
  /** Dernier timestamp de sync réussi (ISO 8601), null si jamais synchronisé. */
  lastSyncAt: string | null;
  /** Erreur de la dernière sync (message court, non sensible). */
  lastError: string | null;
  /** ID de cet appareil (UUID, généré localement, non secret). */
  deviceId: string;
  /** Nombre d'appareils appairés (mis à jour après chaque sync). */
  pairedDevicesCount: number;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: SyncStatus) => void;
  setLastSyncAt: (iso: string | null) => void;
  setLastError: (message: string | null) => void;
  setPairedDevicesCount: (count: number) => void;
  /** Génère un deviceId si absent (appelé une fois au démarrage). */
  ensureDeviceId: () => string;
}

/**
 * Lit le deviceId depuis localStorage, ou en génère un nouveau.
 * Le deviceId est créé UNE FOIS au chargement du module (pas à chaque appel),
 * puis persisté immédiatement dans localStorage.
 */
function loadOrCreateDeviceId(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (
      existing &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing)
    ) {
      return existing;
    }
  } catch {
    // localStorage indisponible en lecture — on tente de créer quand même.
  }
  const created = crypto.randomUUID();
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, created);
  } catch {
    // localStorage indisponible en écriture (mode privé) — UUID volatil.
  }
  return created;
}

function loadLastSyncAt(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

function persistLastSyncAt(iso: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (iso) window.localStorage.setItem(LAST_SYNC_KEY, iso);
    else window.localStorage.removeItem(LAST_SYNC_KEY);
  } catch {
    // Ignore — la sync continuera de fonctionner sans persistance du timestamp.
  }
}

export const useSyncStore = create<SyncState>((set, get) => ({
  enabled: false,
  status: "idle",
  lastSyncAt: loadLastSyncAt(),
  lastError: null,
  deviceId: loadOrCreateDeviceId(),
  pairedDevicesCount: 0,
  setEnabled: (enabled) => set({ enabled }),
  setStatus: (status) => set({ status }),
  setLastSyncAt: (iso) => {
    persistLastSyncAt(iso);
    set({ lastSyncAt: iso });
  },
  setLastError: (lastError) => set({ lastError }),
  setPairedDevicesCount: (pairedDevicesCount) => set({ pairedDevicesCount }),
  ensureDeviceId: () => {
    const id = get().deviceId;
    return id;
  },
}));
