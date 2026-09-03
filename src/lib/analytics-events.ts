/**
 * CANONICAL ANALYTICS EVENTS (Phase 1).
 *
 * One name per business meaning. Legacy names are kept for historical
 * compatibility only — never as the primary definition of a funnel step.
 *
 *  video_selected                → learner chose a video (search / paste / library)
 *  video_started                 → playback actually began
 *  meaningful_watch_30s          → ≥30s of ACCUMULATED real playback (seek-proof)
 *  sentence_clicked              → learner tapped a sentence/subtitle
 *  explanation_viewed            → learner SAW an explanation (overlay OR transcript)
 *  video_resumed_after_explanation → learner continued watching after reading
 *  expression_saved              → learner saved an expression
 *
 * LEGACY → CANONICAL
 *  video_watched_30s               → meaningful_watch_30s   (playhead-based, seek-inflatable)
 *  subtitle_explanation_requested  → explanation_viewed     (overlay path only, intent not view)
 */
export const CANONICAL_EVENTS = [
  "video_selected",
  "video_started",
  "meaningful_watch_30s",
  "sentence_clicked",
  "explanation_viewed",
  "video_resumed_after_explanation",
  "expression_saved",
] as const;

export type CanonicalEvent = (typeof CANONICAL_EVENTS)[number];

/** Deprecated events retained for historical continuity. */
export const LEGACY_EVENTS = ["video_watched_30s", "subtitle_explanation_requested"] as const;

/** Canonical step → the event names that satisfy it (canonical first). */
export const CANONICAL_EQUIVALENTS: Record<string, string[]> = {
  meaningful_watch_30s: ["meaningful_watch_30s", "video_watched_30s"],
  explanation_viewed: ["explanation_viewed", "subtitle_explanation_requested"],
};
