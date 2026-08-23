import { Play } from "lucide-react";

/**
 * STATIC product preview for the landing hero.
 * Real curated NOS video + real Dutch sentence + real NativeFlow explanation.
 * Visual communication only — no live player, no interaction, no internal scrolling.
 */
const MOMENT = {
  t: "0:24",
  videoId: "VTo7yLBMND4",
  channel: "LUBACH",
  title: "Greg Davies & Alex Horne over de Nederlandse versie van Taskmaster",
  sentence: "Dat is een geweldig concept.",
  translation: "That's a great concept.",
  expression: "een geweldig concept — a great concept",
};

export function StaticProductPreview({ onClick }: { onClick?: () => void }) {
  const inner = (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:gap-4">
      {/* Real curated video frame */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-md">
        <img
          src={`https://i.ytimg.com/vi/${MOMENT.videoId}/hqdefault.jpg`}
          alt={`${MOMENT.channel} — ${MOMENT.title}`}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-black/15" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg ring-1 ring-black/10">
            <Play className="h-5 w-5 translate-x-[1px] text-slate-900" fill="currentColor" />
          </div>
        </div>
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> {MOMENT.channel}
        </span>
        {/* Subtitle overlay, as in the real player */}
        <div className="absolute inset-x-3 bottom-3 flex justify-center">
          <span className="inline-block max-w-full rounded bg-black/75 px-2 py-1 text-center text-[11px] font-medium leading-tight text-white sm:text-xs">
            {MOMENT.sentence}
          </span>
        </div>
      </div>

      {/* Explanation card */}
      <div className="rounded-xl border border-primary/20 bg-secondary text-left">
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
            <p className="mt-0.5 text-sm leading-snug text-slate-700">{MOMENT.expression}</p>
          </div>
        </div>
      </div>
    </div>
  );

  const shell =
    "block w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:p-4";

  if (!onClick) {
    return (
      <div aria-label="Preview of NativeFlow explaining a Dutch sentence" className={shell}>
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Try the demo with this Dutch video"
      className={`${shell} cursor-pointer text-left transition-shadow hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50`}
    >
      {inner}
    </button>
  );
}
