/**
 * Velora — service de métadonnées du coffre pour la restauration multi-appareils.
 *
 * PRINCIPE :
 * - Quand un coffre est créé ou déverrouillé sur un appareil appairé, ses
 *   métadonnées (KDF params, salt, clé maîtresse WRAPPÉE, verifier) sont
 *   poussées vers le serveur de sync.
 * - Sur un nouvel appareil, l'utilisateur saisit son vaultId + sa phrase
 *   secrète. Le client récupère les métadonnées depuis le serveur, dérive
 *   la KEK depuis la phrase, vérifie le verifier, unwrappe la clé maîtresse,
 *   et recrée le coffre localement. Puis il tire toutes les données chiffrées.
 *
 * SÉCURITÉ :
 * - La clé maîtresse n'est JAMAIS en clair côté serveur (toujours wrappée
 *   par la KEK dérivée de la phrase via Argon2id).
 * - Sans la phrase secrète, les métadonnées sont inutilisables.
 * - C'est le même niveau de sécurité qu'un fichier de sauvegarde .velora.
 * - Le vaultId est un UUID aléatoire — le connaître ne suffit pas, il faut
 *   aussi la phrase secrète.
 */
import { db, type VaultRow } from "@/lib/db/database";
import { getSyncEndpoint, DEFAULT_SYNC_ENDPOINT } from "@/lib/sync/sync-service";
import { useSyncStore } from "@/store/sync-store";
import {
  vaultMetaSchema,
  putVaultRequestSchema,
  putVaultResponseSchema,
  type VaultMeta,
  type PutVaultRequest,
} from "@/lib/sync/schema";
import { deriveKey } from "@/lib/crypto/kdf";
import { importAesKey } from "@/lib/crypto/aes-gcm";
import { fromBase64Url } from "@/lib/crypto/bytes";
import type { Vault } from "@/lib/schema/vault";

// ---------------------------------------------------------------------------
// Push : pousser les métadonnées du coffre local vers le serveur
// ---------------------------------------------------------------------------

/**
 * Pousse les métadonnées du coffre local vers le serveur de sync.
 * Appelé automatiquement après création/déverrouillage si la sync est activée.
 * Ne fait rien si la sync est désactivée ou si le coffre n'existe pas.
 */
export async function pushVaultMetaToCloud(): Promise<void> {
  try {
    const { isUnlocked, getSession } = await import("@/lib/vault/vault-service");
    if (!isUnlocked()) return;

    const session = getSession();
    if (!session) return;

    const { getSettings } = await import("@/lib/vault/goal-repository");
    const settings = await getSettings();
    if (!settings.syncEnabled) return;

    const row = await db.vault.toCollection().first();
    if (!row) return;

    const endpoint = await getSyncEndpoint();
    const deviceId = useSyncStore.getState().deviceId;

    const body: PutVaultRequest = {
      vaultId: row.id,
      version: 1,
      createdAt: row.createdAt,
      kdf: JSON.stringify(row.kdf),
      salt: row.salt,
      wrappedMasterKey: row.wrappedMasterKey,
      wrapIv: row.wrapIv,
      verifier: row.verifier,
      verifierIv: row.verifierIv,
      autoLockMs: row.autoLockMs,
      deviceId,
    };
    const validated = putVaultRequestSchema.parse(body);

    const res = await fetch(`${endpoint}/vault`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validated),
    });
    if (!res.ok) {
      console.error(`[vault-meta] Push échoué (HTTP ${res.status})`);
      return;
    }
    const json = await res.json();
    const parsed = putVaultResponseSchema.safeParse(json);
    if (!parsed.success) {
      console.error("[vault-meta] Réponse serveur invalide (push)");
    }
  } catch (err) {
    // Erreur silencieuse — la restauration cloud est un bonus, pas un requis.
    console.error("[vault-meta] Erreur push:", err);
  }
}

// ---------------------------------------------------------------------------
// Restore : restaurer un coffre depuis le serveur
// ---------------------------------------------------------------------------

export interface RestoreFromCloudResult {
  success: boolean;
  error?: string;
  vault?: Vault;
}

/**
 * Tente de restaurer un coffre depuis le serveur de sync.
 *
 * @param vaultId — UUID du coffre (à récupérer sur l'appareil d'origine, page Appairage).
 * @param passphrase — Phrase secrète de l'utilisateur (vérifiée via le verifier).
 * @param testMode — true en tests (KDF allégé).
 *
 * Flux :
 * 1. GET /vault?vaultId= → récupère les métadonnées (clé wrappée, verifier, KDF).
 * 2. Dérive la KEK depuis la phrase + salt (Argon2id).
 * 3. Vérifie la phrase via le verifier (déchiffrement du marqueur).
 * 4. Si OK : unwrappe la clé maîtresse, recrée le coffre localement (IndexedDB).
 * 5. Persiste la session (comme unlockVault).
 * 6. L'utilisateur devra ensuite appairer cet appareil (via la page Appairage)
 *    pour tirer les données.
 */
export async function restoreVaultFromCloud(
  vaultId: string,
  passphrase: string,
  options: { testMode?: boolean } = {}
): Promise<RestoreFromCloudResult> {
  try {
    // 0. Vérifie qu'aucun coffre local n'existe déjà.
    const existing = await db.vault.toCollection().first();
    if (existing) {
      return { success: false, error: "Un coffre existe déjà sur cet appareil." };
    }

    // 1. Récupère les métadonnées depuis le serveur.
    const endpoint = await getSyncEndpoint();
    const res = await fetch(`${endpoint}/vault?vaultId=${encodeURIComponent(vaultId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      return {
        success: false,
        error: "Aucun coffre trouvé sur le serveur avec cet identifiant.",
      };
    }
    if (!res.ok) {
      return {
        success: false,
        error: `Erreur serveur (HTTP ${res.status}). Vérifiez votre connexion.`,
      };
    }
    const json = await res.json();
    const parsed = vaultMetaSchema.safeParse(json);
    if (!parsed.success) {
      return { success: false, error: "Réponse serveur invalide." };
    }
    const meta: VaultMeta = parsed.data;

    // 2. Parse les paramètres KDF.
    const kdfParams = JSON.parse(meta.kdf) as Vault["kdf"];
    const effectiveKdf = options.testMode
      ? { ...kdfParams, memoryKiB: Math.min(kdfParams.memoryKiB, 64), iterations: 1 }
      : kdfParams;

    // 3. Dérive la KEK depuis la phrase + salt.
    const salt = fromBase64Url(meta.salt);
    const { key: kek } = await deriveKey(passphrase, salt, effectiveKdf);

    // 4. Vérifie la phrase via le verifier.
    const kekKey = await importAesKey(kek);
    const verifierIv = fromBase64Url(meta.verifierIv);
    const verifierCt = fromBase64Url(meta.verifier);
    const verifierAad = new TextEncoder().encode(
      JSON.stringify({ purpose: "passphrase-verifier" })
    );
    let phraseOk = false;
    try {
      const raw = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: verifierIv as BufferSource,
          additionalData: verifierAad as BufferSource,
        },
        kekKey,
        verifierCt as BufferSource
      );
      const marker = new TextDecoder().decode(raw);
      phraseOk = marker === "velora-vault-verifier-v1";
    } catch {
      phraseOk = false;
    }
    if (!phraseOk) {
      return { success: false, error: "Phrase secrète incorrecte." };
    }

    // 5. Unwrappe la clé maîtresse.
    const wrapIv = fromBase64Url(meta.wrapIv);
    const wrappedCt = fromBase64Url(meta.wrappedMasterKey);
    const wrapAad = new TextEncoder().encode(JSON.stringify({ purpose: "wrap-master-key" }));
    const rawMasterKey = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: wrapIv as BufferSource,
        additionalData: wrapAad as BufferSource,
      },
      kekKey,
      wrappedCt as BufferSource
    );
    const masterKeyBytes = new Uint8Array(rawMasterKey);
    const masterKey = await importAesKey(masterKeyBytes);

    // 6. Recrée le coffre localement (IndexedDB).
    const vault: Vault = {
      id: meta.vaultId,
      version: 1,
      createdAt: meta.createdAt,
      kdf: kdfParams,
      salt: meta.salt,
      wrappedMasterKey: meta.wrappedMasterKey,
      wrapIv: meta.wrapIv,
      verifier: meta.verifier,
      verifierIv: meta.verifierIv,
      autoLockMs: meta.autoLockMs,
    };

    const row: VaultRow = {
      id: vault.id,
      version: vault.version,
      createdAt: vault.createdAt,
      kdf: vault.kdf,
      salt: vault.salt,
      wrappedMasterKey: vault.wrappedMasterKey,
      wrapIv: vault.wrapIv,
      verifier: vault.verifier,
      verifierIv: vault.verifierIv,
      autoLockMs: vault.autoLockMs,
    };
    await db.vault.add(row);

    // 7. Restaure la session en mémoire + persistence F5.
    const { setSessionForRestore } = await import("@/lib/vault/vault-service");
    await setSessionForRestore(vault, masterKey, masterKeyBytes);

    return { success: true, vault };
  } catch (err) {
    console.error("[vault-meta] Erreur restauration:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur lors de la restauration.",
    };
  }
}

/**
 * Vérifie si un vaultId existe sur le serveur (sans le restaurer).
 * Utilisé pour pré-valider le formulaire de restauration.
 */
export async function checkVaultExistsOnCloud(vaultId: string): Promise<boolean> {
  try {
    const endpoint = await getSyncEndpoint();
    const res = await fetch(`${endpoint}/vault?vaultId=${encodeURIComponent(vaultId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export { DEFAULT_SYNC_ENDPOINT };
