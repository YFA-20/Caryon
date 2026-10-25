/**
 * Velora — persistance de session pour survivre au F5 / refresh.
 *
 * PROBLÈME RÉSOLU :
 * Avant, la session (clé maître) ne vivait qu'en mémoire. Un F5 effaçait
 * la session → le coffre se verrouillait → l'utilisateur devait retaper
 * sa phrase secrète à chaque refresh. Inacceptable UX.
 *
 * ARCHITECTURE (défense en profondeur) :
 *
 *   sessionStorage (clé aléatoire 256 bits, effacée à la fermeture de l'onglet)
 *     └── déchiffre ──►  IndexedDB (clé maître chiffrée, persiste sur disque)
 *
 * - Au déverrouillage : on génère une clé de session aléatoire (256 bits),
 *   on la stocke dans sessionStorage, et on chiffre la clé maître avec
 *   cette clé de session (AES-256-GCM) → stockée dans IndexedDB.
 * - Au F5 / refresh : sessionStorage survit (même onglet), on lit la clé
 *   de session, on déchiffre la clé maître depuis IndexedDB → session
 *   restaurée automatiquement. L'utilisateur reste déverrouillé.
 * - À la fermeture de l'onglet : sessionStorage est effacé par le navigateur
 *   → la clé de session disparaît → la clé maître chiffrée dans IndexedDB
 *   devient inutilisable → coffre verrouillé automatiquement.
 * - Au verrouillage manuel / auto-lock : on supprime explicitement les deux
 *   entrées (sessionStorage + IndexedDB).
 *
 * SÉCURITÉ :
 * - La phrase secrète n'est JAMAIS stockée (ni en clair, ni chiffrée).
 * - La clé maître en clair n'est JAMAIS sur disque (toujours chiffrée par
 *   la clé de session, ou wrappée par la KEK dérivée de la phrase).
 * - La clé de session est dans sessionStorage (pas localStorage) : elle ne
 *   survit pas à la fermeture de l'onglet.
 * - Si un attaquant vole le disque (IndexedDB), il a la clé maître CHIFFRÉE
 *   mais pas la clé de session (qui est dans sessionStorage, en mémoire).
 * - Si un attaquant a accès à la mémoire vive (sessionStorage + IndexedDB),
 *   il peut déchiffrer — mais c'est équivalent à avoir la session ouverte,
 *   ce qui est le modèle de menace accepté pour une app déverrouillée.
 * - Le verrouillage manuel efface les deux côtés → irrécupérable sans la
 *   phrase secrète.
 *
 * CYCLE DE VIE :
 *   unlockVault() / createVault()
 *     → persistSession(masterKey)         [écrit sessionStorage + IndexedDB]
 *   F5 / refresh
 *     → tryRestoreSession()              [lit sessionStorage → déchiffre IndexedDB]
 *   lock() / forceLock()
 *     → clearPersistedSession()          [efface sessionStorage + IndexedDB]
 *   Fermeture onglet
 *     → navigateur efface sessionStorage  [IndexedDB devient inutilisable]
 */
import { db } from "@//lib/db/database";
import { encryptBytes, decryptBytes, importAesKey } from "@/lib/crypto/aes-gcm";
import { toBase64Url, fromBase64Url } from "@/lib/crypto/bytes";
import type { EncryptedRecord } from "@/lib/schema/encrypted-record";

// ── Constantes ──────────────────────────────────────────────────────────────

const SESSION_STORAGE_KEY = "velora:sessionKey";
const SESSION_DB_ID = "__session__";
const SESSION_AAD = { purpose: "session-persistence", version: 1 };

// ── Types ───────────────────────────────────────────────────────────────────

interface PersistedSessionRow {
  id: string;
  /** EncryptedRecord contenant la clé maître brute chiffrée par la clé de session. */
  payload: string;
  updatedAt: string;
}

// ── Helpers sessionStorage ──────────────────────────────────────────────────

function getSessionKeyFromStorage(): Uint8Array | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return fromBase64Url(raw);
  } catch {
    return null;
  }
}

function setSessionKeyInStorage(key: Uint8Array): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, toBase64Url(key));
  } catch {
    // sessionStorage indisponible — la session ne survivra pas au F5
  }
}

function clearSessionKeyFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ── API publique ────────────────────────────────────────────────────────────

/**
 * Persiste la clé maître pour la session courante.
 * Appelé après unlockVault() ou createVault().
 *
 * 1. Génère une clé de session aléatoire (256 bits) si elle n'existe pas.
 * 2. Exporte la clé maître brute (elle est non-extractible, donc on doit
 *    la ré-importer temporairement comme extractible — voir note ci-dessous).
 * 3. Chiffre la clé maître avec la clé de session (AES-256-GCM).
 * 4. Stocke le ciphertext dans IndexedDB.
 * 5. Stocke la clé de session dans sessionStorage.
 *
 * NOTE : importAesKey importe toujours comme non-extractible. Pour persister,
 * on doit re-générer la clé maître brute au moment de l'unlock, la garder
 * temporairement, puis l'importer comme non-extractible pour la session.
 * C'est le flux dans vault-service.ts (rawMasterKey disponible avant import).
 */
export async function persistSession(rawMasterKey: Uint8Array): Promise<void> {
  if (typeof window === "undefined") return;

  // 1. Clé de session (aléatoire, 256 bits) — réutilise l'existante si présente
  let sessionKeyBytes = getSessionKeyFromStorage();
  if (!sessionKeyBytes) {
    sessionKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    setSessionKeyInStorage(sessionKeyBytes);
  }

  // 2. Importe la clé de session
  const sessionKey = await importAesKey(sessionKeyBytes);

  // 3. Chiffre la clé maître avec la clé de session
  const encrypted = await encryptBytes(sessionKey, rawMasterKey, { aad: SESSION_AAD });

  // 4. Stocke dans IndexedDB (table records, collection spéciale)
  const row: PersistedSessionRow = {
    id: SESSION_DB_ID,
    payload: JSON.stringify(encrypted),
    updatedAt: new Date().toISOString(),
  };

  // Utilise la table records avec une collection dédiée
  await db.records.put({
    id: SESSION_DB_ID,
    collection: "__session__",
    payload: JSON.stringify(encrypted),
    updatedAt: row.updatedAt,
  });
}

/**
 * Tente de restaurer la session après un F5 / refresh.
 * Retourne la clé maître brute si la restauration réussit, null sinon.
 *
 * 1. Lit la clé de session depuis sessionStorage.
 * 2. Lit le ciphertext depuis IndexedDB.
 * 3. Déchiffre la clé maître.
 * 4. Retourne les 32 octets bruts (à ré-importer comme CryptoKey non-extractible).
 */
export async function tryRestoreSession(): Promise<Uint8Array | null> {
  if (typeof window === "undefined") return null;

  // 1. Clé de session depuis sessionStorage
  const sessionKeyBytes = getSessionKeyFromStorage();
  if (!sessionKeyBytes) return null;

  try {
    // 2. Ciphertext depuis IndexedDB
    const row = await db.records.get(SESSION_DB_ID);
    if (!row) return null;

    const encrypted = JSON.parse(row.payload) as EncryptedRecord;

    // 3. Déchiffre
    const sessionKey = await importAesKey(sessionKeyBytes);
    const rawMasterKey = await decryptBytes(sessionKey, encrypted);

    if (rawMasterKey.length !== 32) return null;

    return rawMasterKey;
  } catch {
    // Déchiffrement échoué (données corrompues, mauvaise clé, etc.)
    return null;
  }
}

/**
 * Efface la session persistée (sessionStorage + IndexedDB).
 * Appelé par lock() et forceLock().
 */
export async function clearPersistedSession(): Promise<void> {
  clearSessionKeyFromStorage();
  try {
    await db.records.delete(SESSION_DB_ID);
  } catch {
    // ignore
  }
}

/**
 * Vérifie si une session persistée existe (pour savoir si on peut
 * restaurer automatiquement au chargement).
 */
export function hasPersistedSession(): boolean {
  if (typeof window === "undefined") return false;
  return getSessionKeyFromStorage() !== null;
}
