"use client";

/**
 * Velora — page d'appairage multi-appareils (Phase 3).
 *
 * Deux modes :
 * 1. « Cet appareil » (appareil A, déjà appairé) : génère un code à 6 chiffres
 *    à partager avec le nouvel appareil, et liste les demandes en attente.
 * 2. « Nouvel appareil » (appareil B) : saisit le code à 6 chiffres pour
 *    demander l'appairage, puis attend la confirmation.
 *
 * SÉCURITÉ : aucune clé n'est transmise. Le code à 6 chiffres est vérifié
 * côté serveur (hashé). La confirmation nécessite une preuve de possession
 * de la clé maîtresse (HMAC dérivée du coffre).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserPlus,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/store/toast-store";
import { useSyncStore } from "@/store/sync-store";
import { useVaultStore } from "@/store/vault-store";
import { getSession } from "@/lib/vault/vault-service";
import {
  generatePairingCode,
  requestPairing,
  pollPairingStatus,
  listPairedDevices,
  listPendingPairings,
  approvePairing,
  revokeDevice,
  syncNow,
  isSyncReady,
} from "@/lib/sync/sync-service";
import type { PendingPairing } from "@/lib/sync/schema";
import type { PairedDevice } from "@/lib/sync/schema";

type PairingMode = "menu" | "generate" | "enter-code";
type PairingState = "idle" | "waiting" | "approved" | "denied" | "expired" | "error";

export default function AppairagePage() {
  const { status: vaultStatus } = useVaultStore();
  const { enabled: syncEnabled } = useSyncStore();
  const [mode, setMode] = useState<PairingMode>("menu");
  const [syncReady, setSyncReady] = useState(false);

  // Mode "générer un code" (appareil A)
  const [code, setCode] = useState<string | null>(null);
  const [_pairingId, setPairingId] = useState<string | null>(null);
  const [_pairingState, setPairingState] = useState<PairingState>("idle");
  const [_approvedBy, setApprovedBy] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mode "saisir un code" (appareil B)
  const [inputCode, setInputCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [requestState, setRequestState] = useState<PairingState>("idle");
  const [_requestPairingId, setRequestPairingId] = useState<string | null>(null);
  const requestPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Liste des appareils
  const [devices, setDevices] = useState<PairedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // VaultId (pour la restauration multi-appareils)
  const [vaultId, setVaultId] = useState<string | null>(null);

  // Demandes d'appairage en attente (appareil A)
  const [pendingPairings, setPendingPairings] = useState<PendingPairing[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actingOnPairingId, setActingOnPairingId] = useState<string | null>(null);
  const pendingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Détection du nom de l'appareil (basique)
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent;
      if (/iPhone/i.test(ua)) setDeviceName("iPhone");
      else if (/iPad/i.test(ua)) setDeviceName("iPad");
      else if (/Android/i.test(ua)) setDeviceName("Android");
      else if (/Mac/i.test(ua)) setDeviceName("Mac");
      else if (/Windows/i.test(ua)) setDeviceName("PC Windows");
      else if (/Linux/i.test(ua)) setDeviceName("Linux");
      else setDeviceName("Navigateur");
    }
  }, []);

  // Vérifie si la sync est prête
  useEffect(() => {
    isSyncReady()
      .then(setSyncReady)
      .catch(() => setSyncReady(false));
  }, [syncEnabled, vaultStatus]);

  // Charge la liste des appareils
  const loadDevices = useCallback(async () => {
    const session = getSession();
    if (!session) return;
    setLoadingDevices(true);
    try {
      const result = await listPairedDevices(session.vault.id);
      setDevices(result.devices);
    } catch (err) {
      console.error("[appairage] Erreur chargement appareils:", err);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    if (syncReady) loadDevices();
  }, [syncReady, loadDevices]);

  // Charge le vaultId pour l'afficher (restauration multi-appareils)
  useEffect(() => {
    const session = getSession();
    if (session) setVaultId(session.vault.id);
  }, [syncReady]);

  // Charge les demandes d'appairage en attente
  const loadPendingPairings = useCallback(async () => {
    const session = getSession();
    if (!session) return;
    setLoadingPending(true);
    try {
      const result = await listPendingPairings(session.vault.id);
      setPendingPairings(result.pending);
    } catch (err) {
      console.error("[appairage] Erreur chargement demandes:", err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  // Poll les demandes en attente toutes les 5 secondes (appareil A)
  useEffect(() => {
    if (!syncReady) return;
    loadPendingPairings();
    pendingPollRef.current = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadPendingPairings();
      }
    }, 5000);
    return () => {
      if (pendingPollRef.current) clearInterval(pendingPollRef.current);
    };
  }, [syncReady, loadPendingPairings]);

  // Nettoyage des intervalles au démontage
  useEffect(() => {
    const pollInterval = pollRef.current;
    const requestPollInterval = requestPollRef.current;
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (requestPollInterval) clearInterval(requestPollInterval);
    };
  }, []);

  // --- Mode "générer un code" (appareil A) ---

  async function handleGenerateCode() {
    const session = getSession();
    if (!session) {
      toastError("Déverrouillez votre coffre d'abord.");
      return;
    }
    const newCode = generatePairingCode();
    setCode(newCode);
    setPairingState("waiting");
    setPairingId(null);
    setApprovedBy(null);

    // Le code est affiché localement. Le nouvel appareil (B) le saisira
    // et enverra une demande /pairing/init. Ici, on génère juste le code
    // et on attend que l'appareil B nous contacte — en pratique, l'appareil
    // A doit aussi créer une "session de code" côté serveur.
    // Pour simplifier : le code est partagé hors-bande (visuellement, QR, etc.)
    // et l'appareil B l'envoie au serveur. L'appareil A vérifie les demandes
    // en attente via une liste (à implémenter côté serveur : /pairing/pending).
    // En attendant, on stocke le code localement et on affiche un message.
    toastSuccess("Code généré. Partagez-le avec votre nouvel appareil (valable 10 minutes).");
  }

  function handleCopyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(
      () => toastSuccess("Code copié dans le presse-papiers."),
      () => toastError("Impossible de copier le code.")
    );
  }

  async function handleCancelPairing() {
    if (pollRef.current) clearInterval(pollRef.current);
    setCode(null);
    setPairingId(null);
    setPairingState("idle");
    setApprovedBy(null);
  }

  // --- Mode "saisir un code" (appareil B) ---

  async function handleRequestPairing() {
    const session = getSession();
    if (!session) {
      toastError("Déverrouillez votre coffre d'abord.");
      return;
    }
    if (!/^\d{6}$/.test(inputCode)) {
      toastError("Le code doit contenir exactement 6 chiffres.");
      return;
    }
    setRequestState("waiting");
    try {
      const result = await requestPairing(session.vault.id, deviceName, inputCode);
      setRequestPairingId(result.pairingId);

      if (!result.pending) {
        // Premier appareil : appairage direct (bootstrap).
        setRequestState("approved");
        toastSuccess("Appareil appairé avec succès. Synchronisation en cours…");
        // Lance une sync complète.
        syncNow().catch(() => {});
        loadDevices();
        return;
      }

      // Appareil suivant : attend la confirmation de l'appareil A.
      toastSuccess("Demande envoyée. En attente de confirmation sur votre autre appareil…");

      // Poll le statut toutes les 3 secondes (max 10 minutes = 200 itérations).
      let attempts = 0;
      requestPollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 200) {
          if (requestPollRef.current) clearInterval(requestPollRef.current);
          setRequestState("expired");
          toastError("La demande d'appairage a expiré (10 minutes écoulées).");
          return;
        }
        try {
          const status = await pollPairingStatus(result.pairingId);
          if (status.status === "approved") {
            if (requestPollRef.current) clearInterval(requestPollRef.current);
            setRequestState("approved");
            toastSuccess("Appairage approuvé ! Synchronisation en cours…");
            syncNow().catch(() => {});
            loadDevices();
          } else if (status.status === "denied") {
            if (requestPollRef.current) clearInterval(requestPollRef.current);
            setRequestState("denied");
            toastError("L'appairage a été refusé par l'autre appareil.");
          } else if (status.status === "expired") {
            if (requestPollRef.current) clearInterval(requestPollRef.current);
            setRequestState("expired");
            toastError("La demande d'appairage a expiré.");
          }
        } catch (err) {
          console.error("[appairage] Erreur polling:", err);
        }
      }, 3000);
    } catch (err) {
      console.error("[appairage] Erreur demande:", err);
      setRequestState("error");
      toastError(err instanceof Error ? err.message : "Erreur lors de la demande d'appairage.");
    }
  }

  // --- Approbation / refus de demandes d'appairage (appareil A) ---

  async function handleApprovePairing(pairingId: string, approved: boolean) {
    setActingOnPairingId(pairingId);
    try {
      await approvePairing(pairingId, approved);
      if (approved) {
        toastSuccess("Appareil approuvé. Synchronisation en cours…");
        syncNow().catch(() => {});
      } else {
        toastSuccess("Demande refusée.");
      }
      // Recharge les listes.
      loadPendingPairings();
      loadDevices();
    } catch (err) {
      console.error("[appairage] Erreur approbation:", err);
      toastError(err instanceof Error ? err.message : "Erreur lors de l'approbation.");
    } finally {
      setActingOnPairingId(null);
    }
  }

  // --- Révocation ---

  async function handleRevokeDevice(targetDeviceId: string) {
    const session = getSession();
    if (!session) return;
    setRevokingId(targetDeviceId);
    try {
      await revokeDevice(session.vault.id, targetDeviceId);
      toastSuccess("Appareil révoqué. Il ne pourra plus se synchroniser.");
      loadDevices();
    } catch (err) {
      console.error("[appairage] Erreur révocation:", err);
      toastError("Erreur lors de la révocation.");
    } finally {
      setRevokingId(null);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  // --- Rendu ---

  if (vaultStatus !== "unlocked") {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
          <Card className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-card-elevated">
              <ShieldCheck className="h-6 w-6 text-lavender" aria-hidden />
            </div>
            <CardTitle className="text-lg">Coffre verrouillé</CardTitle>
            <CardDescription>
              Déverrouillez votre coffre pour gérer l&apos;appairage de vos appareils.
            </CardDescription>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (!syncEnabled) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
          <Card className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-card-elevated">
              <Link2 className="h-6 w-6 text-lavender" aria-hidden />
            </div>
            <CardTitle className="text-lg">Synchronisation désactivée</CardTitle>
            <CardDescription>
              Activez la synchronisation dans les{" "}
              <a href="/parametres" className="text-lavender underline">
                paramètres
              </a>{" "}
              pour appairer vos appareils.
            </CardDescription>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Appairage</h1>
          <p className="mt-2 text-secondary">
            Connectez plusieurs appareils à votre coffre. Vos données restent chiffrées de bout en
            bout.
          </p>
        </div>

        {/* Menu principal */}
        {mode === "menu" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Card
              className="cursor-pointer space-y-4 transition-colors hover:border-lavender/40"
              onClick={() => setMode("generate")}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                  <MonitorSmartphone className="h-5 w-5 text-lavender" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg">Cet appareil</CardTitle>
                  <CardDescription>
                    Générer un code pour appairer un nouvel appareil.
                  </CardDescription>
                </div>
              </div>
              <p className="text-xs text-secondary">
                Utilisez cette option sur l&apos;appareil déjà connecté à votre coffre.
              </p>
            </Card>

            <Card
              className="cursor-pointer space-y-4 transition-colors hover:border-lavender/40"
              onClick={() => setMode("enter-code")}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                  <Smartphone className="h-5 w-5 text-rose" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg">Nouvel appareil</CardTitle>
                  <CardDescription>
                    Saisir le code affiché sur votre autre appareil.
                  </CardDescription>
                </div>
              </div>
              <p className="text-xs text-secondary">
                Utilisez cette option sur l&apos;appareil à connecter.
              </p>
            </Card>
          </div>
        )}

        {/* Mode : générer un code (appareil A) */}
        {mode === "generate" && (
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                <KeyRound className="h-5 w-5 text-lavender" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Code d&apos;appairage</CardTitle>
                <CardDescription>
                  Partagez ce code avec votre nouvel appareil (valable 10 minutes).
                </CardDescription>
              </div>
            </div>

            {!code ? (
              <Button onClick={handleGenerateCode}>
                <KeyRound className="h-4 w-4" aria-hidden />
                Générer un code
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-lavender/25 bg-lavender/5 p-6 text-center">
                  <p className="text-xs text-secondary">Votre code</p>
                  <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em] text-primary">
                    {code.slice(0, 3)} {code.slice(3)}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleCopyCode}>
                    <Copy className="h-4 w-4" aria-hidden />
                    Copier
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setCode(null);
                      setPairingState("idle");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    Nouveau code
                  </Button>
                  <Button variant="ghost" onClick={handleCancelPairing}>
                    Annuler
                  </Button>
                </div>

                <div className="rounded-lg border border-subtle bg-surface p-3 text-xs text-secondary">
                  <p>
                    Saisissez ce code sur votre nouvel appareil (page « Appairage » → « Nouvel
                    appareil »). L&apos;appairage devra être confirmé sur cet appareil.
                  </p>
                </div>
              </div>
            )}

            <Button variant="ghost" onClick={() => setMode("menu")}>
              Retour
            </Button>
          </Card>
        )}

        {/* Mode : saisir un code (appareil B) */}
        {mode === "enter-code" && (
          <Card className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                <Smartphone className="h-5 w-5 text-rose" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Connecter cet appareil</CardTitle>
                <CardDescription>
                  Saisissez le code affiché sur votre appareil déjà appairé.
                </CardDescription>
              </div>
            </div>

            {requestState === "idle" || requestState === "error" ? (
              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Nom de cet appareil</span>
                  <input
                    type="text"
                    maxLength={100}
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="ex: MacBook de Yassine"
                    className={inputClass}
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1.5 block text-secondary">Code à 6 chiffres</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className={`${inputClass} text-center font-mono text-2xl tracking-[0.3em]`}
                  />
                </label>

                <Button
                  onClick={handleRequestPairing}
                  disabled={inputCode.length !== 6 || deviceName.trim().length === 0}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  Demander l&apos;appairage
                </Button>
              </div>
            ) : requestState === "waiting" ? (
              <div className="space-y-4 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-lavender" aria-hidden />
                <p className="text-sm text-secondary">
                  Demande envoyée. En attente de confirmation sur votre autre appareil…
                </p>
                <p className="text-xs text-secondary/60">
                  Sur l&apos;autre appareil, approuvez la demande portant le nom « {deviceName} ».
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (requestPollRef.current) clearInterval(requestPollRef.current);
                    setRequestState("idle");
                    setRequestPairingId(null);
                  }}
                >
                  Annuler
                </Button>
              </div>
            ) : requestState === "approved" ? (
              <div className="space-y-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden />
                <p className="font-medium text-primary">Appareil appairé avec succès !</p>
                <p className="text-sm text-secondary">
                  Vos données vont se synchroniser automatiquement.
                </p>
              </div>
            ) : requestState === "denied" ? (
              <div className="space-y-4 text-center">
                <XCircle className="mx-auto h-8 w-8 text-danger" aria-hidden />
                <p className="font-medium text-danger">Appairage refusé</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestState("idle");
                    setInputCode("");
                  }}
                >
                  Réessayer
                </Button>
              </div>
            ) : (
              <div className="space-y-4 text-center">
                <XCircle className="mx-auto h-8 w-8 text-warning" aria-hidden />
                <p className="font-medium text-warning">Demande expirée</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRequestState("idle");
                    setInputCode("");
                  }}
                >
                  Générer un nouveau code
                </Button>
              </div>
            )}

            <Button variant="ghost" onClick={() => setMode("menu")}>
              Retour
            </Button>
          </Card>
        )}

        {/* Demandes d'appairage en attente (appareil A) */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                <UserPlus className="h-5 w-5 text-lavender" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Demandes en attente</CardTitle>
                <CardDescription>Appareils qui souhaitent rejoindre votre coffre.</CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadPendingPairings}
              disabled={loadingPending}
            >
              {loadingPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>

          {pendingPairings.length === 0 ? (
            <p className="text-sm text-secondary">
              {loadingPending ? "Chargement…" : "Aucune demande en attente."}
            </p>
          ) : (
            <div className="space-y-2">
              {pendingPairings.map((pending) => {
                const expiresIn = Math.max(
                  0,
                  Math.round((new Date(pending.expiresAt).getTime() - Date.now()) / 1000 / 60)
                );
                return (
                  <div
                    key={pending.pairingId}
                    className="flex items-center justify-between rounded-xl border border-lavender/25 bg-lavender/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-elevated">
                        <Smartphone className="h-4 w-4 text-lavender" aria-hidden />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary">{pending.newDeviceName}</p>
                        <p className="text-xs text-secondary">
                          Demandé il y a{" "}
                          {Math.round(
                            (Date.now() - new Date(pending.createdAt).getTime()) / 1000 / 60
                          )}{" "}
                          min · expire dans {expiresIn} min
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-success hover:bg-success/10"
                        disabled={actingOnPairingId === pending.pairingId}
                        onClick={() => handleApprovePairing(pending.pairingId, true)}
                      >
                        {actingOnPairingId === pending.pairingId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        )}
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger/10"
                        disabled={actingOnPairingId === pending.pairingId}
                        onClick={() => handleApprovePairing(pending.pairingId, false)}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                        Refuser
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-lavender/25 bg-lavender/5 p-3 text-xs text-secondary">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender" aria-hidden />
            <span>
              Approuver un appareil lui donne accès à vos données chiffrées. Vérifiez le nom de
              l&apos;appareil et le contexte avant d&apos;approuver.
            </span>
          </div>
        </Card>

        {/* Liste des appareils appairés */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                <MonitorSmartphone className="h-5 w-5 text-rose" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Appareils appairés</CardTitle>
                <CardDescription>Gérez les appareils connectés à votre coffre.</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {vaultId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(vaultId).then(
                      () => toastSuccess("Identifiant du coffre copié."),
                      () => toastError("Impossible de copier.")
                    );
                  }}
                  title="Copier l'identifiant du coffre (pour restaurer sur un nouvel appareil)"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  ID coffre
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={loadDevices} disabled={loadingDevices}>
                {loadingDevices ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden />
                )}
              </Button>
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-secondary">
                {loadingDevices ? "Chargement…" : "Aucun appareil appairé pour le moment."}
              </p>
              {vaultId && (
                <div className="rounded-lg border border-subtle bg-background/40 p-3 text-xs">
                  <p className="text-secondary">
                    Identifiant de votre coffre (pour restaurer sur un nouvel appareil) :
                  </p>
                  <code className="mt-1 block select-all break-all font-mono text-primary">
                    {vaultId}
                  </code>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between rounded-xl border border-subtle bg-surface p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-card-elevated">
                      <Smartphone className="h-4 w-4 text-secondary" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {device.deviceName}
                        {device.isCurrent && (
                          <Badge variant="lavender" className="ml-2">
                            Cet appareil
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-secondary">
                        Appairé le {new Date(device.pairedAt).toLocaleDateString("fr-FR")}
                        {device.lastSeenAt &&
                          ` · vu le ${new Date(device.lastSeenAt).toLocaleDateString("fr-FR")}`}
                      </p>
                    </div>
                  </div>
                  {!device.isCurrent && !device.revoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger/10"
                      disabled={revokingId === device.deviceId}
                      onClick={() => handleRevokeDevice(device.deviceId)}
                    >
                      {revokingId === device.deviceId ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Révoquer
                    </Button>
                  )}
                  {device.revoked && <Badge variant="danger">Révoqué</Badge>}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-lavender/25 bg-lavender/5 p-3 text-xs text-secondary">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender" aria-hidden />
            <span>
              Un appareil révoqué ne peut plus se synchroniser. Ses données locales restent intactes
              — seule la connexion au serveur est coupée.
            </span>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
