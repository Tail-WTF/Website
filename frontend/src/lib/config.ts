const API_BASE = import.meta.env.VITE_API_URL || "/api";

export function apiFor(path: string): string {
  return `${API_BASE}${path}`;
}
