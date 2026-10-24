"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Loader2, Save, Settings, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSettings, saveSettings, wipeAllData } from "@/lib/vault/goal-repository";
import { seedDemoData, hasExistingData, type DemoSeedResult } from "@/lib/vault/demo-data-service";
import { toastSuccess, toastError } from "@/store/toast-store";
import { useVaultStore } from "@/store/vault-store";
import { useUiStore } from "@/store/ui-store";
import { forceLock } from "@/lib/vault/vault-service";

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: "Désactivé" },
  { value: 5 * 60 * 1000, label: "5 minutes" },
  { value: 15 * 60 * 1000, label: "15 minutes" },
  { value: 30 * 60 * 1000, label: "30 minutes" },
  { value: 60 * 60 * 1000, label: "1 heure" },
];

export default function ParametresPage() {
  const { setAutoLockMs } = useVaultStore();
  const { setFirstName } = useUiStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formFirstName, setFormFirstName] = useState("");
  const [formAutoLock, setFormAutoLock] = useState(15 * 60 * 1000);

  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [wipeText, setWipeText] = useState("");
  const [wiping, setWiping] = useState(false);

  // Mode demonstration
  const [demoMode, setDemoMode] = useState(false);
  const [demoSeeding, setDemoSeeding] = useState(false);
  const [demoConfirm, setDemoConfirm] = useState(false);
  const [hasData, setHasData] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getSettings();
      setFormFirstName(settings.firstName);
      setFormAutoLock(settings.autoLockMs);
      setFirstName(settings.firstName);
      setAutoLockMs(settings.autoLockMs);
      setDemoMode(settings.demoMode);
      const dataExists = await hasExistingData();
      setHasData(dataExists);
    } catch (err) {
      console.error("[parametres] Erreur chargement:", err);
      setError("Impossible de charger les paramètres.");
    } finally {
      setLoading(false);
    }
  }, [setFirstName, setAutoLockMs]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveSettings({
        firstName: formFirstName.trim(),
        autoLockMs: formAutoLock,
      });
      setFirstName(formFirstName.trim());
      setAutoLockMs(formAutoLock);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("[parametres] Erreur sauvegarde:", err);
      setError("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleWipe() {
    if (wipeText !== "SUPPRIMER") return;
    setWiping(true);
    try {
      await wipeAllData();
      forceLock();
    } catch (err) {
      console.error("[parametres] Erreur suppression:", err);
      setError("Erreur lors de la suppression du coffre.");
      setWiping(false);
    }
  }

  async function handleDemoToggle(enable: boolean) {
    if (enable) {
      // Verifier si des donnees existent deja
      const dataExists = await hasExistingData();
      if (dataExists && !demoConfirm) {
        setDemoConfirm(true);
        return;
      }
      setDemoSeeding(true);
      try {
        const result: DemoSeedResult = await seedDemoData();
        await saveSettings({ demoMode: true });
        setDemoMode(true);
        setDemoConfirm(false);
        toastSuccess(
          `Mode démonstration activé : ${result.applications} candidatures, ${result.documents} documents, ${result.events} événements créés.`
        );
      } catch (err) {
        console.error("[parametres] Erreur activation demo:", err);
        toastError("Erreur lors de l'activation du mode démonstration.");
      } finally {
        setDemoSeeding(false);
      }
    } else {
      // Desactivation : on desactive le flag, les donnees restent (l'utilisateur peut les supprimer)
      try {
        await saveSettings({ demoMode: false });
        setDemoMode(false);
        toastSuccess("Mode démonstration désactivé.");
      } catch (err) {
        console.error("[parametres] Erreur désactivation demo:", err);
        toastError("Erreur lors de la désactivation.");
      }
    }
  }

  const inputClass =
    "w-full rounded-xl border border-subtle bg-surface px-4 py-2.5 text-sm text-primary placeholder:text-secondary/60 focus-visible:ring-2 focus-visible:ring-lavender";

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Paramètres</h1>
          <p className="mt-2 text-secondary">
            Personnalisez votre expérience. Ces préférences sont chiffrées avec vos données.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-lavender" aria-hidden />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
                  <Settings className="h-5 w-5 text-rose" aria-hidden />
                </div>
                <div>
                  <CardTitle className="text-lg">Préférences</CardTitle>
                  <CardDescription>Personnalisation de l&apos;interface.</CardDescription>
                </div>
              </div>

              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Prénom affiché</span>
                <input
                  type="text"
                  maxLength={50}
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  placeholder="Votre prénom (facultatif)"
                  className={inputClass}
                />
                <span className="mt-1 block text-xs text-secondary">
                  Affiché dans le message de bienvenue du tableau de bord. Stocké chiffré.
                </span>
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block text-secondary">Verrouillage automatique</span>
                <select
                  value={formAutoLock}
                  onChange={(e) => setFormAutoLock(Number(e.target.value))}
                  className={inputClass}
                >
                  {AUTO_LOCK_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-secondary">
                  Le coffre se verrouille automatiquement après cette durée d&apos;inactivité.
                </span>
              </label>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4" aria-hidden />
                  )}
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </Button>
                {saved && <Badge variant="success">Enregistré</Badge>}
              </div>
            </Card>
          </form>
        )}

        {/* Mode demonstration */}
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card-elevated">
              <FlaskConical className="h-5 w-5 text-warning" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg">Mode démonstration</CardTitle>
              <CardDescription>
                Explorez l&apos;application avec des données fictives chiffrées.
              </CardDescription>
            </div>
          </div>

          <div className="rounded-xl border border-subtle bg-surface p-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={demoMode}
                disabled={demoSeeding}
                onChange={(e) => handleDemoToggle(e.target.checked)}
                className="mt-0.5 rounded border-subtle accent-lavender"
              />
              <span>
                <span className="block font-medium text-primary">
                  Activer le mode démonstration
                </span>
                <span className="mt-1 block text-xs text-secondary">
                  Génère des données fictives réalistes (candidatures, documents, événements,
                  objectifs, journal) chiffrées exactement comme vos vraies données. Une bannière
                  jaune indiquera que vous êtes en mode démo. Les données sont réelles dans le
                  coffre : vous pouvez les modifier, les supprimer, les exporter.
                </span>
              </span>
            </label>

            {demoMode && (
              <div className="mt-3 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-warning">
                Mode démonstration actif — une bannière jaune est affichée en haut de chaque page.
              </div>
            )}

            {demoSeeding && (
              <div className="mt-3 flex items-center gap-2 text-xs text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Génération des données de démonstration…
              </div>
            )}

            {demoConfirm && hasData && (
              <div className="mt-3 space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs text-warning">
                  Vous avez déjà des données dans votre coffre. Le mode démo va ajouter des données
                  fictives <strong>à côté</strong> des vôtres. Continuer ?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleDemoToggle(true)}>
                    Confirmer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDemoConfirm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-4 border-danger/30 bg-danger/5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15">
              <Trash2 className="h-5 w-5 text-danger" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-lg text-danger">Zone de danger</CardTitle>
              <CardDescription>Actions irréversibles sur votre coffre-fort.</CardDescription>
            </div>
          </div>

          <div className="rounded-xl border border-danger/25 bg-background/40 p-4">
            <p className="text-sm font-medium text-primary">Supprimer toutes les données</p>
            <p className="mt-1 text-xs text-secondary">
              Efface définitivement le coffre, toutes les candidatures, documents, événements et
              objectifs de cet appareil. <strong>Irréversible.</strong> Pensez à exporter une
              sauvegarde <code className="text-rose">.velora</code> avant.
            </p>

            {wipeConfirm ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-danger">
                  Pour confirmer, tapez <code className="font-mono font-bold">SUPPRIMER</code> puis
                  cliquez sur le bouton.
                </p>
                <input
                  type="text"
                  value={wipeText}
                  onChange={(e) => setWipeText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className={inputClass}
                  aria-label="Tapez SUPPRIMER pour confirmer"
                />
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="border border-danger/30 text-danger hover:bg-danger/10"
                    disabled={wipeText !== "SUPPRIMER" || wiping}
                    onClick={handleWipe}
                  >
                    {wiping ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden />
                    )}
                    Supprimer définitivement
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setWipeConfirm(false);
                      setWipeText("");
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="mt-4 border-danger/30 text-danger hover:bg-danger/10"
                onClick={() => setWipeConfirm(true)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Supprimer toutes mes données
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
