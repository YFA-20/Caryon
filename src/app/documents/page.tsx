"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  FileText,
  FileImage,
  FileType2,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listDocuments,
  createDocument,
  deleteDocument,
  getDocumentContent,
  getTotalDocumentsSize,
} from "@/lib/vault/document-repository";
import {
  DOCUMENT_TYPE_LABELS,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  type Document,
  type DocumentType,
} from "@/lib/schema/document";
import { cn } from "@/lib/utils/cn";
import { toastUndo, toastError, toastSuccess } from "@/store/toast-store";
import { SkeletonGrid } from "@/components/common/skeleton";
import { CvOfferComparison } from "@/components/ai/cv-offer-comparison";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

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

function iconForMime(mime: string) {
  if (mime.startsWith("image/")) return FileImage;
  if (mime === "application/pdf") return FileText;
  return FileType2;
}

function typeFromName(name: string): DocumentType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    if (lower.includes("cv") || lower.includes("resume")) return "cv";
    if (lower.includes("lettre") || lower.includes("motivation") || lower.includes("cover"))
      return "lettre";
    if (lower.includes("diplome") || lower.includes("diploma") || lower.includes("attestation"))
      return "diplome";
    if (lower.includes("certif")) return "certification";
    if (lower.includes("portfolio")) return "portfolio";
    return "autre";
  }
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "lettre";
  if (lower.endsWith(".txt")) return "autre";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
    return "portfolio";
  return "autre";
}

const ACCEPT_ATTR = ALLOWED_MIME_TYPES.join(",") + ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showCvComparison, setShowCvComparison] = useState(false);
  const [cvForComparison, setCvForComparison] = useState<{ text: string; name: string } | null>(
    null
  );
  const [extractingCv, setExtractingCv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, size] = await Promise.all([listDocuments(), getTotalDocumentsSize()]);
      setDocuments(docs);
      setTotalSize(size);
    } catch (err) {
      console.error("[documents] Erreur chargement:", err);
      setError("Impossible de charger les documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_DOCUMENT_SIZE) {
          throw new Error(`« ${file.name} » dépasse la limite de 10 Mo.`);
        }
        const buffer = await file.arrayBuffer();
        await createDocument({
          name: file.name,
          type: typeFromName(file.name),
          mimeType: file.type || "application/octet-stream",
          content: new Uint8Array(buffer),
        });
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExtractForComparison(doc: Document) {
    setExtractingCv(true);
    try {
      const content = await getDocumentContent(doc.id);
      if (!content) {
        toastError("Impossible de lire le contenu du document.");
        return;
      }
      const text = new TextDecoder("utf-8", { fatal: false }).decode(content);
      setCvForComparison({ text, name: doc.name });
      setShowCvComparison(true);
      toastSuccess("Texte extrait — prêt pour la comparaison IA.");
    } catch (err) {
      console.error("[documents] Erreur extraction CV:", err);
      toastError("Erreur lors de l'extraction du texte.");
    } finally {
      setExtractingCv(false);
    }
  }

  async function handleDownload(doc: Document) {
    try {
      const content = await getDocumentContent(doc.id);
      if (!content) {
        setError("Contenu du document introuvable.");
        return;
      }
      const blob = new Blob([content as BlobPart], { type: doc.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[documents] Erreur téléchargement:", err);
      setError("Erreur lors du téléchargement.");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(null);
    // Snapshot métadonnées + contenu pour undo
    const snapshot = documents.find((d) => d.id === id);
    let snapshotContent: Uint8Array | null = null;
    if (snapshot) {
      try {
        snapshotContent = await getDocumentContent(id);
      } catch {
        snapshotContent = null;
      }
    }
    try {
      await deleteDocument(id);
      await refresh();
      if (snapshot && snapshotContent) {
        toastUndo(`Document « ${snapshot.name} » supprimé.`, async () => {
          try {
            await createDocument({
              name: snapshot.name,
              type: snapshot.type,
              mimeType: snapshot.mimeType,
              content: snapshotContent,
              tags: snapshot.tags,
              applicationId: snapshot.applicationId,
            });
            await refresh();
          } catch (err) {
            console.error("[documents] Erreur annulation:", err);
            toastError("Impossible d'annuler la suppression.");
          }
        });
      }
    } catch (err) {
      console.error("[documents] Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-gradient font-serif text-4xl font-bold">Mes documents</h1>
            <p className="mt-2 text-secondary">
              Coffre documentaire chiffré — vos fichiers ne quittent jamais votre appareil en clair.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="hidden"
              onChange={handleFileSelect}
              aria-label="Sélectionner des fichiers à importer"
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="h-4 w-4" aria-hidden />
              )}
              {uploading ? "Chiffrement en cours…" : "Importer un document"}
            </Button>
          </div>
        </div>

        <p className="text-xs text-secondary">
          Formats acceptés : PDF, DOC, DOCX, TXT, PNG, JPG — 10 Mo max par fichier. Stockage chiffré
          AES-256-GCM dans IndexedDB ({formatSize(totalSize)} utilisés).
        </p>

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
          <SkeletonGrid count={6} type="document" />
        ) : documents.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-card-elevated">
              <FileText className="h-8 w-8 text-rose" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Aucun document</CardTitle>
            <CardDescription className="mx-auto mt-2 max-w-md">
              Importez votre CV, vos lettres de motivation ou diplômes. Ils seront chiffrés
              automatiquement avant d&apos;être stockés sur votre appareil.
            </CardDescription>
            <Button
              className="mt-6"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" aria-hidden />
              Importer mon premier document
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => {
              const Icon = iconForMime(doc.mimeType);
              return (
                <Card key={doc.id} className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card-elevated">
                      <Icon className="h-5 w-5 text-rose" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-primary" title={doc.name}>
                        {doc.name}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="lavender">{DOCUMENT_TYPE_LABELS[doc.type]}</Badge>
                        <span className="text-xs text-secondary">{formatSize(doc.sizeBytes)}</span>
                        {doc.versionCount > 1 && (
                          <span className="text-xs text-secondary">v{doc.versionCount}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="default">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-secondary">
                    Ajouté le {formatDateTime(doc.createdAt)}
                  </p>

                  <div className="mt-auto flex items-center gap-2">
                    {doc.type === "cv" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={extractingCv}
                        onClick={() => handleExtractForComparison(doc)}
                        title="Comparer ce CV avec une offre (IA)"
                      >
                        <Sparkles className="h-4 w-4 text-lavender" aria-hidden />
                        Comparer IA
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-4 w-4" aria-hidden />
                      Télécharger
                    </Button>
                    {deletingId === doc.id ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border border-danger/30 text-danger hover:bg-danger/10"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                        Confirmer
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Supprimer ${doc.name}`}
                        className={cn("text-secondary hover:text-danger")}
                        onClick={() => setDeletingId(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {/* Comparaison CV ↔ Offre IA */}
        {showCvComparison && cvForComparison && (
          <div className="mt-6">
            <CvOfferComparison cvText={cvForComparison.text} cvName={cvForComparison.name} />
            <div className="mt-2 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCvComparison(false);
                  setCvForComparison(null);
                }}
              >
                Fermer la comparaison
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
