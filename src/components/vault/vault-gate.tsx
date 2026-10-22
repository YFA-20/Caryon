"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useVaultStore } from "@/store/vault-store";
import { vaultExists, unlockVault, createVault, isUnlocked } from "@/lib/vault/vault-service";

/**
 * Velora — portail du coffre-fort.
 *
 * Si aucun coffre n'existe : écran de création (phrase secrète).
 * Si un coffre existe mais est verrouillé : écran de déverrouillage.
 * Si déverrouillé : rend les enfants.
 */
export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, setStatus } = useVaultStore();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isUnlocked()) {
        setStatus("unlocked");
        return;
      }
      const exists = await vaultExists();
      if (!cancelled) setStatus(exists ? "locked" : "no-vault");
    })();
    return () => {
      cancelled = true;
    };
  }, [setStatus]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (passphrase.length < 12) {
      setError("La phrase secrète doit contenir au moins 12 caractères.");
      return;
    }
    if (passphrase !== confirm) {
      setError("Les deux phrases ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await createVault(passphrase, { testMode: process.env.NODE_ENV === "test" });
      setStatus("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await unlockVault(passphrase, { testMode: process.env.NODE_ENV === "test" });
      setStatus("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du déverrouillage");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
      </div>
    );
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  const isCreate = status === "no-vault";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-card-elevated shadow-glow">
            {isCreate ? (
              <ShieldCheck className="h-7 w-7 text-lavender" aria-hidden="true" />
            ) : (
              <Lock className="h-7 w-7 text-lavender" aria-hidden="true" />
            )}
          </div>
          <CardTitle className="mt-4 font-serif text-2xl">
            {isCreate ? "Créer votre coffre-fort" : "Déverrouiller le coffre"}
          </CardTitle>
          <CardDescription className="mt-2">
            {isCreate
              ? "Choisissez une phrase secrète forte. Elle ne sera jamais stockée ni transmise."
              : "Entrez votre phrase secrète pour accéder à vos données chiffrées."}
          </CardDescription>
        </div>

        <form onSubmit={isCreate ? handleCreate : handleUnlock} className="space-y-4">
          <div>
            <label htmlFor="passphrase" className="mb-1.5 block text-sm text-secondary">
              Phrase secrète
            </label>
            <input
              id="passphrase"
              type="password"
              autoComplete={isCreate ? "new-password" : "current-password"}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/50 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
              placeholder="Au moins 12 caractères"
              required
              minLength={12}
            />
          </div>

          {isCreate && (
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm text-secondary">
                Confirmer la phrase
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/50 focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
                placeholder="Retapez la phrase"
                required
              />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Traitement…" : isCreate ? "Créer le coffre" : "Déverrouiller"}
          </Button>
        </form>

        {isCreate && (
          <p className="mt-4 text-center text-xs text-secondary">
            Sans cette phrase, vos données sont irrécupérables. Aucune récupération côté serveur.
          </p>
        )}
      </Card>
    </div>
  );
}
