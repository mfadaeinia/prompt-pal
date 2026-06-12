// Stable per-browser id used to scope anonymous saved expressions.
const KEY = "nativeflow_browser_id";

export function getBrowserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id: string =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `b-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return "anon";
  }
}
