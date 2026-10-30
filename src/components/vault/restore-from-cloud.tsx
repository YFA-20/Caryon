"use client";

/**
 * Velora — restauration d'un coffre depuis le cloud (multi-appareils).
 *
 * Affichée sur l'écran de création du coffre (quand aucun coffre local
 * n'existe) : permet de restaurer un coffre existant sur un autre appareil
 * en saisissant le vaultId + la phrase secrète.
 *
 * SÉCURITÉ :
 * - Le vaultId seul ne suffit pas : il faut aussi la phrase secrète.
 * - La phrase est vérifiée localement via le verifier (AEAD) avant tout
 *   déverrouillage. Une mauvaise phrase ne crée aucun coffre local.
 * - La clé maîtresse wrappée sur le serveur est inutilisable sans la phrase.
 */
import { useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreVaultFromCloud } from "@/lib/sync/vault-meta-service";
import { isTestBuild } from "@/lib/env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RestoreFromCloudProps {
  onRestored: () => void;
}

export function RestoreFromCloud({ onRestored }: RestoreFromCloudProps) {
  const [open, setOpen] = useState(false);
  const [vaultId, setVaultId] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedId = vaultId.trim().toLowerCase();
    if (!UUID_RE.test(trimmedId)) {
      setError(
        "L'identifiant du coffre doit être un UUID valide (copié depuis la page Appairage)."
      );
      return;
    }
    if (passphrase.length < 12) {
      setError("La phrase secrète doit contenir au moins 12 caractères.");
      return;
    }

    setBusy(true);
    try {
      const result = await restoreVaultFromCloud(trimmedId, passphrase, {
        testMode: isTestBuild(),
      });
      if (result.success) {
        onRestored();
      } else {
        setError(result.error ?? "Erreur lors de la restauration.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la restauration.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full text-lavender hover:bg-lavender/10"
        onClick={() => setOpen(true)}
      >
        <CloudDownload className="h-4 w-4" aria-hidden="true" />
        Restaurer depuis un autre appareil (cloud)
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleRestore}
      className="space-y-3 rounded-xl border border-lavender/25 bg-lavender/5 p-4"
    >
      <p className="text-xs text-secondary">
        Restaurez votre coffre depuis un appareil déjà synchronisé. Saisissez l&apos;identifiant du
        coffre (visible sur la page <strong>Appairage</strong> de votre autre appareil) et votre
        phrase secrète.
      </p>

      <div>
        <label htmlFor="vaultId" className="mb-1 block text-xs text-secondary">
          Identifiant du coffre
        </label>
        <input
          id="vaultId"
          type="text"
          value={vaultId}
          onChange={(e) => setVaultId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 font-mono text-xs text-primary placeholder:text-secondary/40 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          required
        />
      </div>

      <div>
        <label htmlFor="cloud-passphrase" className="mb-1 block text-xs text-secondary">
          Phrase secrète
        </label>
        <input
          id="cloud-passphrase"
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Votre phrase secrète"
          className="w-full rounded-lg border border-subtle bg-surface px-3 py-2 text-xs text-primary placeholder:text-secondary/40 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          required
          minLength={12}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy} className="flex-1">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <CloudDownload className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {busy ? "Restauration…" : "Restaurer"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
            setVaultId("");
            setPassphrase("");
          }}
        >
          Annuler
        </Button>
      </div>

      <p className="text-xs text-secondary/70">
        Après restauration, appairez cet appareil depuis la page <strong>Appairage</strong> pour
        récupérer vos données synchronisées.
      </p>
    </form>
  );
}
