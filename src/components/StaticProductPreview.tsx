import { Play } from "lucide-react";

/**
 * STATIC product preview for the landing hero.
 * Visual communication only — no live player, no interaction, no internal scrolling.
 * Typography / colors mirror the real product surfaces.
 */
const MOMENT = {
  t: "0:42",
  sentence: "Dat slaat nergens op.",
  translation: "That makes no sense at all.",
  note: "'Slaat nergens op' is everyday spoken Dutch — you'll hear it constantly.",
};

export function StaticProductPreview() {
  return (
    <div
      aria-label="Preview of NativeFlow explaining a Dutch sentence"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:p-4"
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:gap-4">
        {/* Video frame */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-[#1f2937] via-[#3b2d6b] to-[#7B3FF2] shadow-md">
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_75%_70%,rgba(255,45,122,0.22),transparent_60%)]"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10">
              <Play className="h-5 w-5 translate-x-[1px] text-slate-900" fill="currentColor" />
            </div>
          </div>
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> YouTube
          </span>
          {/* Subtitle overlay, as in the real player */}
          <div className="absolute inset-x-3 bottom-3 flex justify-center">
            <span className="inline-block max-w-full rounded bg-black/75 px-2 py-1 text-center text-[11px] font-medium leading-tight text-white sm:text-xs">
              {MOMENT.sentence}
            </span>
          </div>
        </div>

        {/* Explanation card */}
        <div className="rounded-xl border border-primary/20 bg-secondary">
          <div className="border-b border-primary/15 px-4 pb-2 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Explaining · {MOMENT.t}
            </p>
            <p className="mt-0.5 text-[0.95rem] font-medium leading-snug text-slate-900">
              “{MOMENT.sentence}”
            </p>
          </div>
          <div className="space-y-2.5 px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Meaning</p>
              <p className="mt-0.5 text-sm leading-snug text-slate-800">{MOMENT.translation}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Useful expression
              </p>
              <p className="mt-0.5 text-sm leading-snug text-slate-700">{MOMENT.note}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
