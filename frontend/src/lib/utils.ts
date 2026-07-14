import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// [already correct — keep this] clsx + tailwind-merge preserves typed class inputs while resolving Tailwind conflicts.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}