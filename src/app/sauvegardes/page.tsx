"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, FileUp, Loader2, Save, ShieldCheck, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  exportBackup,
  serializeBackup,
  parseBackup,
  importBackup,
} from "@/lib/vault/backup-service";
import type { BackupManifest } from "@/lib/schema/backup";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SauvegardesPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<"replace" | "merge">("merge");
  const [lastExport, setLastExport] = useState<BackupManifest | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const archive = await exportBackup();
      const json = serializeBackup(archive);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `velora-sauvegarde-${stamp}.velora`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastExport(archive.manifest);
      setSuccess(
        `Sauvegarde exportée : ${archive.manifest.recordCount} enregistrement(s) chiffré(s).`
      );
    } catch (err) {
      console.error("[sauvegardes] Erreur export:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'export.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setSuccess(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const archive = parseBackup(text);
      const result = await importBackup(archive, importMode);
      setImportResult(result);
      setSuccess(
        `Restauration terminée : ${result.imported} enregistrement(s) importé(s)` +
          (result.skipped > 0 ? `, ${result.skipped} ignoré(s).` : ".")
      );
    } catch (err) {
      console.error("[sauvegardes] Erreur import:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de l'import.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">Sauvegardes</h1>
          <p className="mt-2 text-secondary">
            Exportez une archive chiffrée portable de toutes vos données, ou restaurez-en une sur
            cet appareil.
          </p>
        </div>

        <Card className="space-y-4 border-success/25 bg-success/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
            <div>
              <CardTitle className="text-lg">Confidentialité garantie</CardTitle>
              <CardDescription className="mt-1">
                L&apos;archive <code className="text-rose">.velora</code> est chiffrée avec votre
                clé maîtresse (AES-256-GCM) avant de quitter votre appareil. Sans votre phrase
                secrète, elle est illisible — y compris pour nous. Un checksum SHA-256 détecte toute
                corruption ou modification.
              </CardDescription>
            </div>
          </div>
        </Card>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm text-success"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{success}</span>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-elevated">
                <Download className="h-5 w-5 text-rose" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Exporter</CardTitle>
                <CardDescription>
                  Candidatures, documents et événements, chiffrés dans un fichier{" "}
                  <code className="text-rose">.velora</code>.
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {exporting ? "Chiffrement en cours…" : "Créer une sauvegarde"}
            </Button>
            {lastExport && (
              <dl className="space-y-1 border-t border-subtle pt-3 text-xs text-secondary">
                <div className="flex justify-between">
                  <dt>Dernière exportation</dt>
                  <dd className="text-primary">{formatDateTime(lastExport.exportedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Enregistrements</dt>
                  <dd className="text-primary">{lastExport.recordCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Format</dt>
                  <dd className="text-primary">
                    {lastExport.format} v{lastExport.version}
                  </dd>
                </div>
              </dl>
            )}
          </Card>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card-elevated">
                <Upload className="h-5 w-5 text-lavender" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-lg">Restaurer</CardTitle>
                <CardDescription>
                  Importez un fichier <code className="text-rose">.velora</code> créé sur un autre
                  appareil.
                </CardDescription>
              </div>
            </div>

            <fieldset className="flex gap-4 text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-secondary">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "merge"}
                  onChange={() => setImportMode("merge")}
                  className="accent-lavender"
                />
                Fusionner (conserve l&apos;existant)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-secondary">
                <input
                  type="radio"
                  name="import-mode"
                  checked={importMode === "replace"}
                  onChange={() => setImportMode("replace")}
                  className="accent-lavender"
                />
                Remplacer tout
              </label>
            </fieldset>

            <input
              ref={fileInputRef}
              type="file"
              accept=".velora,.json,application/json"
              className="hidden"
              onChange={handleImport}
              aria-label="Sélectionner un fichier de sauvegarde"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden />
              )}
              {importing ? "Déchiffrement en cours…" : "Choisir un fichier à restaurer"}
            </Button>

            {importResult && (
              <p className="text-xs text-secondary">
                Dernier import : {importResult.imported} importé(s), {importResult.skipped}{" "}
                ignoré(s).
              </p>
            )}
          </Card>
        </div>

        <Card className="border-warning/25 bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <div className="text-sm">
              <p className="font-medium text-primary">Attention — perte de la phrase secrète</p>
              <p className="mt-1 text-secondary">
                Sans votre phrase secrète, vos données chiffrées sont irrécupérables. Il
                n&apos;existe aucune récupération côté serveur. Conservez votre phrase secrète en
                lieu sûr et gardez vos sauvegardes <code className="text-rose">.velora</code> à
                jour.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
