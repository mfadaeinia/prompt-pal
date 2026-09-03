/**
 * Client-side ring buffer of the last canonical analytics events, for the
 * founder-only Analytics Diagnostics panel. Debug/validation only — it never
 * affects what is persisted.
 */
export type DiagnosticEvent = {
  event: string;
  at: string;
  videoId?: string | null;
  trafficClass?: string;
  sessionId?: string;
};

const KEY = "nativeflow_analytics_debug_events_v1";
const MAX = 10;

export function recordDiagnosticEvent(e: DiagnosticEvent) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    const list: DiagnosticEvent[] = raw ? JSON.parse(raw) : [];
    const next = [...(Array.isArray(list) ? list : []), e].slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function getDiagnosticEvents(): DiagnosticEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list.slice().reverse() as DiagnosticEvent[]) : [];
  } catch {
    return [];
  }
}
