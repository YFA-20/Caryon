import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind de manière déterministe (dernier gain).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
