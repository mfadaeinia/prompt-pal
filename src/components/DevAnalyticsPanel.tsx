import { useEffect, useState } from "react";

// Developer-only analytics validation panel.
// Visible when URL contains ?debug=1 OR localStorage["clario_debug"] === "1".
// Used to verify analytics correctness during testing — NOT shown to real users.

export type DevPanelState = {
  sessionId: string;
  timeOnPageSeconds: number;
  transcriptClicks: number;
  demoStarted: boolean;
  feedbackSubmitted: boolean;
  waitlistJoined: boolean;
  videoId: string | null;
};

export function isDevPanelEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") return true;
    return localStorage.getItem("clario_debug") === "1";
  } catch {
    return false;
  }
}

export function DevAnalyticsPanel({ getState }: { getState: () => DevPanelState }) {
  const [s, setS] = useState<DevPanelState>(() => getState());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = window.setInterval(() => setS(getState()), 1000);
    return () => window.clearInterval(t);
  }, [getState]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 rounded-full bg-black/80 px-3 py-1.5 text-xs font-mono text-white shadow"
      >
        📊 dev
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[260px] rounded-lg border border-yellow-500/50 bg-black/90 p-3 font-mono text-[11px] text-white shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold text-yellow-400">📊 Analytics Debug</span>
        <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">
          ×
        </button>
      </div>
      <Row k="session_id" v={s.sessionId.slice(0, 8) + "…"} />
      <Row k="video_id" v={s.videoId ?? "—"} />
      <Row k="time_on_page" v={`${s.timeOnPageSeconds}s`} />
      <Row k="transcript_clicks" v={String(s.transcriptClicks)} />
      <Row k="demo_started" v={s.demoStarted ? "✅" : "—"} />
      <Row k="feedback_submitted" v={s.feedbackSubmitted ? "✅" : "—"} />
      <Row k="waitlist_joined" v={s.waitlistJoined ? "✅" : "—"} />
      <p className="mt-2 text-[10px] text-white/40">?debug=1 or localStorage clario_debug=1</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-white/10 py-0.5">
      <span className="text-white/60">{k}</span>
      <span className="text-yellow-200">{v}</span>
    </div>
  );
}
