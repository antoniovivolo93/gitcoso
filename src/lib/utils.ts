import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function repoPathLabel(path: string | null) {
  if (!path) {
    return "Choose a local Git repository";
  }

  const parts = path.split(/[\\/]/);
  return parts.slice(-2).join(" / ");
}
