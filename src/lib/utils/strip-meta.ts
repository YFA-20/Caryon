/**
 * Velora — utilitaire : retire les champs système d'un objet métier.
 *
 * Utilisé pour l'undo (annulation de suppression) : on recrée l'entité
 * sans ses métadonnées système (id, createdAt, updatedAt, completed,
 * notified) qui seront régénérées par le repository.
 */

const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt", "completed", "notified"]);

/**
 * Retourne une copie de l'objet sans les champs système.
 * Les champs restants sont conservés tels quels.
 */
export function stripMetaFields<T extends Record<string, unknown>>(
  obj: T
): Omit<T, "id" | "createdAt" | "updatedAt" | "completed" | "notified"> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SYSTEM_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result as Omit<T, "id" | "createdAt" | "updatedAt" | "completed" | "notified">;
}
