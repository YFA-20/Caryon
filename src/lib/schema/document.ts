import { z } from "zod";

/**
 * Velora — schémas de données : Document, DocumentVersion.
 * Le contenu binaire est chiffré (AES-256-GCM) avant stockage.
 * Seules les métadonnées non sensibles sont indexables.
 */

export const documentTypeSchema = z.enum([
  "cv",
  "lettre",
  "diplome",
  "certification",
  "portfolio",
  "autre",
]);

export const documentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: documentTypeSchema.default("autre"),
  mimeType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
  tags: z.array(z.string().min(1).max(50)).max(50).default([]),
  /** ID de candidature associée (optionnel). */
  applicationId: z.string().uuid().optional().or(z.literal("")),
  /** Nombre de versions. */
  versionCount: z.number().int().nonnegative().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentVersionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  /** Numéro de version (1 = original). */
  version: z.number().int().positive(),
  /** Taille du contenu chiffré en octets. */
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});

export type Document = z.infer<typeof documentSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentVersion = z.infer<typeof documentVersionSchema>;

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  cv: "CV",
  lettre: "Lettre de motivation",
  diplome: "Diplôme",
  certification: "Certification",
  portfolio: "Portfolio",
  autre: "Autre",
};

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
] as const;

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 Mo
