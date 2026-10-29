"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useVaultStore } from "@/store/vault-store";
import {
  vaultExists,
  unlockVault,
  createVault,
  isUnlocked,
  forceLock,
  tryRestoreSessionFromDisk,
} from "@/lib/vault/vault-service";
import {
  parseBackup,
  restoreVaultFromBackup,
  verifyBackupIntegrity,
} from "@/lib/vault/backup-service";
import { getSettings } from "@/lib/vault/goal-repository";
import { RestoreFromCloud } from "@/components/vault/restore-from-cloud";

/**
 * Velora — portail du coffre-fort.
 *
 * Si aucun coffre n'existe : écran de création (phrase secrète) + restauration
 * depuis une sauvegarde .velora (nouvel appareil).
 * Si un coffre existe mais est verrouillé : écran de déverrouillage.
 * Si déverrouillé : rend les enfants.
 *
 * SÉCURITÉ (fix page blanche) : un guard vérifie périodiquement (toutes les
 * 5 secondes) que la session est toujours vivante quand le statut est
 * « unlocked ». Si la session a été effacée (auto-lock, fermeture forcée)
 * sans que le store Zustand n'ait été notifié, le guard force le retour
 * au portail de déverrouillage.
 *
 * FIX ÉCRAN VIERGE F5 (définitif) : on NE redirige PLUS vers « / » quand le
 * coffre est verrouillé sur une page profonde. Le portail de déverrouillage
 * s'affiche directement sur la page demandée (ex: /candidatures). Après
 * déverrouillage, les enfants sont rendus normalement sans changement d'URL.
 * Le redirect window.location.replace(« / ») causait un écran vierge transitoire
 * car il était déclenché pendant l'hydratation React — le navigateur annulait
 * le rendu actuel et chargeait « / », laissant un écran vide pendant le
 * chargement.
 *
 * PERSISTANCE F5 : la session survit au refresh grâce à session-persistence.ts.
 * La clé maître est chiffrée par une clé aléatoire dans sessionStorage
 * (survit au F5, effacée à la fermeture de l'onglet). Au chargement, on tente
 * tryRestoreSessionFromDisk() — si ça marche, l'utilisateur reste déverrouillé.
 * Sinon, le portail de déverrouillage s'affiche normalement.
 *
 * FIX auto-lock : au déverrouillage, on appelle touchActivity() pour
 * réinitialiser lastActivityAt. Sinon, après un F5, lastActivityAt date
 * du chargement de la page (avant le déverrouillage), ce qui fait que
 * le délai d'inactivité est déjà dépassé au moment du déverrouillage.
 */
export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status, setStatus, setAutoLockMs, touchActivity } = useVaultStore();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Session déjà en mémoire (navigation interne sans F5)
      if (isUnlocked()) {
        try {
          const settings = await getSettings();
          setAutoLockMs(settings.autoLockMs);
        } catch {
          // Ignore si les settings ne sont pas lisibles
        }
        if (!cancelled) setStatus("unlocked");
        touchActivity();
        return;
      }

      // 2. Tentative de restauration après F5 / refresh.
      // La clé maître est chiffrée dans IndexedDB, déchiffrée par une clé
      // de session dans sessionStorage (survit au F5, effacée à la fermeture
      // de l'onglet). Si la restauration réussit, l'utilisateur reste connecté.
      const restored = await tryRestoreSessionFromDisk();
      if (restored && !cancelled) {
        try {
          const settings = await getSettings();
          setAutoLockMs(settings.autoLockMs);
        } catch {
          // Ignore
        }
        setStatus("unlocked");
        touchActivity();
        return;
      }

      // 3. Pas de session restaurable → portail de déverrouillage
      const exists = await vaultExists();
      if (!cancelled) setStatus(exists ? "locked" : "no-vault");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStatus]);

  // Guard : vérifie que la session est toujours vivante quand status === "unlocked"
  useEffect(() => {
    if (status !== "unlocked") return;

    const guardInterval = setInterval(() => {
      if (!isUnlocked()) {
        // La session a été effacée (auto-lock ou autre) mais le store
        // ne le sait pas encore → forcer le verrouillage propre
        forceLock();
      }
    }, 5000); // Vérification toutes les 5 secondes

    return () => clearInterval(guardInterval);
  }, [status]);

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
      // Défaut 15 min pour un nouveau coffre
      setAutoLockMs(15 * 60 * 1000);
      touchActivity(); // FIX: démarre le timer d'inactivité à la création
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
      // Charge autoLockMs depuis les settings chiffrées
      try {
        const settings = await getSettings();
        setAutoLockMs(settings.autoLockMs);
      } catch {
        // Ignore si les settings ne sont pas lisibles
      }
      touchActivity(); // FIX: réinitialise le timer d'inactivité au déverrouillage
      setStatus("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du déverrouillage");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFromBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setRestoring(true);
    try {
      const text = await file.text();
      const archive = parseBackup(text);
      await verifyBackupIntegrity(archive);
      await restoreVaultFromBackup(archive);
      setStatus("locked");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la restauration. Vérifiez le fichier .velora."
      );
    } finally {
      setRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
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
          <>
            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-secondary">
              <span className="bg-subtle h-px flex-1" />
              ou
              <span className="bg-subtle h-px flex-1" />
            </div>
            <input
              ref={restoreInputRef}
              type="file"
              accept=".velora,.json,application/json"
              className="hidden"
              onChange={handleRestoreFromBackup}
              aria-label="Restaurer depuis une sauvegarde"
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={restoring}
              onClick={() => restoreInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              {restoring ? "Vérification en cours…" : "Restaurer depuis une sauvegarde .velora"}
            </Button>
            <p className="mt-4 text-center text-xs text-secondary">
              Sur un nouvel appareil, restaurez votre sauvegarde puis déverrouillez avec votre
              phrase secrète. Sans cette phrase, vos données sont irrécupérables. Aucune
              récupération côté serveur.
            </p>
            <div className="mt-4">
              <RestoreFromCloud
                onRestored={() => {
                  // Le coffre est restauré et déverrouillé : on repasse en mode locked
                  // pour que l'utilisateur confirme avec sa phrase (double vérification).
                  setStatus("locked");
                  setPassphrase("");
                  setConfirm("");
                }}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
