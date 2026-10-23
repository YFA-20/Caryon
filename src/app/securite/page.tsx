"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateSecurityAudit,
  type SecurityAuditItem,
  type SecurityAuditReport,
} from "@/lib/security/security-audit";
import { getSettings } from "@/lib/vault/goal-repository";
import { cn } from "@/lib/utils/cn";

const STATUS_META: Record<
  SecurityAuditItem["status"],
  { icon: typeof CheckCircle2; variant: "success" | "warning" | "lavender"; label: string }
> = {
  ok: { icon: CheckCircle2, variant: "success", label: " Conforme" },
  warning: { icon: AlertTriangle, variant: "warning", label: " Attention" },
  info: { icon: Info, variant: "lavender", label: " Information" },
};

function scoreColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-danger";
}

export default function SecuritePage() {
  const [report, setReport] = useState<SecurityAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await getSettings();
      const audit = await generateSecurityAudit(settings.autoLockMs);
      setReport(audit);
    } catch (err) {
      console.error("[securite] Erreur audit:", err);
      setError("Impossible de générer le rapport d'audit.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8">
        <div>
          <h1 className="text-gradient font-serif text-4xl font-bold">
            Sécurité et confidentialité
          </h1>
          <p className="mt-2 text-secondary">
            Audit local de la configuration de votre coffre-fort. Aucune donnée n&apos;est
            transmise.
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
            <span className="sr-only">Génération du rapport…</span>
          </div>
        ) : report ? (
          <>
            <CardElevatedScore score={report.score} />

            <div className="space-y-3">
              {report.items.map((item) => {
                const meta = STATUS_META[item.status];
                const Icon = meta.icon;
                return (
                  <Card key={item.id} className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        item.status === "ok" && "bg-success/15",
                        item.status === "warning" && "bg-warning/15",
                        item.status === "info" && "bg-lavender/15"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          item.status === "ok" && "text-success",
                          item.status === "warning" && "text-warning",
                          item.status === "info" && "text-lavender"
                        )}
                        aria-hidden
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">{item.label}</CardTitle>
                        <Badge variant={meta.variant}>{meta.label.trim()}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-secondary">{item.detail}</p>
                    </div>
                  </Card>
                );
              })}
            </div>

            <Card className="border-lavender/25 bg-lavender/5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-lavender" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium text-primary">Architecture de confiance</p>
                  <p className="mt-1 text-secondary">
                    Vos données sont chiffrées avec <strong>AES-256-GCM</strong> avant stockage dans
                    IndexedDB. La clé maîtresse est dérivée de votre phrase secrète via{" "}
                    <strong>Argon2id</strong> et n&apos;est jamais stockée en clair ni transmise. Ce
                    rapport n&apos;évalue que la configuration technique — la sécurité dépend aussi
                    d&apos;une phrase secrète forte et d&apos;un appareil non compromis.
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-rose" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium text-primary">Limites connues</p>
                  <ul className="mt-1 list-inside list-disc space-y-1 text-secondary">
                    <li>
                      XSS via extensions de navigateur malveillantes (hors périmètre de l&apos;app)
                    </li>
                    <li>Appareil compromis (mémoire, keyloggers matériels)</li>
                    <li>Perte de la phrase secrète = perte définitive des données</li>
                    <li>
                      Le JavaScript ne garantit pas l&apos;effacement mémoire (GC non déterministe)
                    </li>
                  </ul>
                </div>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button variant="outline" onClick={load}>
                <Loader2 className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden />
                Actualiser l&apos;audit
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}

function CardElevatedScore({ score }: { score: number }) {
  return (
    <Card className="border-success/25 bg-gradient-to-br from-[#432938] to-[#634050]">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-success/15">
          <Lock className="h-7 w-7 text-success" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-primary">Score de sécurité</CardTitle>
          <CardDescription className="text-primary/70">
            Configuration de votre coffre-fort évaluée localement.
          </CardDescription>
        </div>
        <div className={cn("font-serif text-4xl font-bold", scoreColor(score))}>{score}%</div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-background/30">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 90 && "bg-success",
            score >= 70 && score < 90 && "bg-warning",
            score < 70 && "bg-danger"
          )}
          style={{ width: `${score}%` }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Score de sécurité : ${score}%`}
        />
      </div>
    </Card>
  );
}
