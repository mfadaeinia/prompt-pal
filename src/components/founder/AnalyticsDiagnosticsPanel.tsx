/**
 * Founder-only Analytics Diagnostics panel (Phase 1 analytics repair).
 * Validation/debugging only — it reads client state and never writes analytics.
 */
import { useEffect, useState } from "react";
import { getAnonymousId, getSessionId } from "@/lib/identity";
import { currentTrafficContext } from "@/lib/traffic-class";
import { getWatchTimeSnapshot } from "@/lib/watch-time";
import { getDiagnosticEvents, type DiagnosticEvent } from "@/lib/analytics-diagnostics";
import { supabase } from "@/integrations/supabase/client";

type Snapshot = {
  sessionId: string;
  anonymousId: string;
  userId: string | null;
  trafficClass: string;
  environment: string;
  hostname: string;
  isDemo: boolean;
  isFounderAdmin: boolean;
  watch: Record<string, number>;
  events: DiagnosticEvent[];
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate font-mono text-xs text-foreground">{value}</span>
    </div>
  );
}

export function AnalyticsDiagnosticsPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function read() {
      const ctx = currentTrafficContext();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSnap({
        sessionId: getSessionId(),
        anonymousId: getAnonymousId(),
        userId: data.session?.user?.id ?? null,
        trafficClass: ctx.trafficClass,
        environment: ctx.environment,
        hostname: ctx.hostname,
        isDemo: ctx.isDemo,
        isFounderAdmin: ctx.isFounderAdmin,
        watch: getWatchTimeSnapshot(),
        events: getDiagnosticEvents(),
      });
    }
    void read();
    const id = window.setInterval(() => void read(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (!snap) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Identity &amp; traffic</h3>
        <Row label="Session ID (SESSION)" value={snap.sessionId} />
        <Row label="Anonymous ID (VISITOR)" value={snap.anonymousId} />
        <Row label="Authenticated user ID (USER)" value={snap.userId ?? "—"} />
        <Row label="traffic_class" value={snap.trafficClass} />
        <Row label="Environment" value={snap.environment} />
        <Row label="Hostname" value={snap.hostname} />
        <Row label="Demo" value={snap.isDemo ? "yes" : "no"} />
        <Row label="Founder / internal" value={snap.isFounderAdmin ? "yes" : "no"} />
        <p className="mt-2 text-xs text-muted-foreground">
          Product metrics count <span className="font-mono">production_user</span> only. This browser
          is currently classified as <span className="font-mono">{snap.trafficClass}</span>.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Accumulated watch time</h3>
        {Object.keys(snap.watch).length === 0 ? (
          <p className="text-xs text-muted-foreground">No playback recorded in this browser yet.</p>
        ) : (
          Object.entries(snap.watch).map(([videoId, seconds]) => (
            <Row key={videoId} label={videoId} value={`${seconds}s real playback`} />
          ))
        )}
        <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground">
          Last 10 canonical events
        </h3>
        {snap.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No canonical events recorded yet.</p>
        ) : (
          <ol className="space-y-1">
            {snap.events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-foreground">{e.event}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString()} · {e.trafficClass ?? "?"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
