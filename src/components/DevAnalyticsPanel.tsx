import { useEffect, useState } from "react";
import { isTestUser, setTestUser } from "@/lib/analytics";

// Developer-only analytics validation panel.
// Visible ONLY when the URL contains ?debug=1 (or ?debug=0 to turn it off again).
// Internal-traffic marking lives in localStorage["nativeflow_internal"] and must
// never make this overlay appear for a founder just watching a video.

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
    // Legacy: this key used to switch the overlay on permanently, including on
    // phones that once opened a ?debug=1 link. Purge it everywhere.
    localStorage.removeItem("nativeflow_debug");

    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      sessionStorage.setItem("nativeflow_devpanel", "1");
      return true;
    }
    if (params.get("debug") === "0") {
      sessionStorage.removeItem("nativeflow_devpanel");
      return false;
    }
    // Session-scoped only: closing the tab always returns to the clean UI.
    return sessionStorage.getItem("nativeflow_devpanel") === "1";
  } catch {
    return false;
  }
}

export function TestUserBadge() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(isTestUser());
    const onStorage = () => setEnabled(isTestUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  if (!enabled) return null;
  return (
    <div className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-yellow-500/60 bg-yellow-500/15 px-3 py-1 text-xs font-medium text-yellow-700 shadow backdrop-blur dark:text-yellow-200">
      🧪 Test User Mode
    </div>
  );
}

export function DevAnalyticsPanel({ getState }: { getState: () => DevPanelState }) {
  const [s, setS] = useState<DevPanelState>(() => getState());
  const [open, setOpen] = useState(true);
  const [testMode, setTestMode] = useState<boolean>(() => isTestUser());

  useEffect(() => {
    const t = window.setInterval(() => setS(getState()), 1000);
    return () => window.clearInterval(t);
  }, [getState]);

  function toggleTestUser() {
    const next = !testMode;
    setTestUser(next);
    setTestMode(next);
  }

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
      <Row k="is_test_user" v={testMode ? "✅ true" : "false"} />

      <button
        onClick={toggleTestUser}
        className={`mt-2 w-full rounded px-2 py-1.5 text-[11px] font-semibold transition ${
          testMode
            ? "bg-yellow-500 text-black hover:bg-yellow-400"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {testMode ? "🧪 Test User: ON (click to disable)" : "Mark this browser as Test User"}
      </button>

      <p className="mt-2 text-[10px] text-white/40">?debug=1 or localStorage nativeflow_debug=1</p>
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
