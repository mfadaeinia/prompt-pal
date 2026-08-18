# Founder Dashboard — Experiment Measurement Upgrade

## What I found (report A–K)

**A. Period filtering today.** One global filter bar at the top of `/founder` with presets (Today → All time). Presets convert to `{from, to}` ISO timestamps in the browser using local time (`setHours(0,0,0,0)`), and those are passed into the `getFounderMetrics` server function, which date-filters in the database with `gte/lte` on `created_at`. Only three sections actually receive the range: Overview, Funnel, Feedback. **User Test Cohort, Product Health, Retention and Engineering queries take no arguments at all — they are always All Time.** That is the biggest correctness gap.

**B. "Custom…" today.** Partially there: selecting it reveals two native `<input type="date">` fields. No calendar, no Apply/Cancel, no validation, and a half-entered range (start only) sends `to: null` = open-ended.

**C. Timestamps / timezone.** All tables store `timestamptz` in UTC. The dashboard builds day boundaries in the *browser's* timezone (Berlin, UTC+2), so "Aug 16" already means Berlin-midnight → correct for you but undocumented. I'll pin it explicitly to **Europe/Berlin** and label it in the header.

**D. Arbitrary start/end.** Yes — the existing metrics function already accepts any ISO from/to and filters server-side. No client-side full-history loading needed.

**E. `anonymous_user_id`.** Exists in the DB as `anonymous_id`, but only **since Aug 11, 2026** and thinly (26 of 1895 page_views; video_sessions/library_events only got it Aug 18). Session-based counting stays primary; anonymous-visitor counts get a "limited coverage before Aug 11" note.

**F. New product events — the critical finding.** `subtitle_explanation_requested`, `video_started`, `video_watched_30s/60s`, `video_resumed_after_explanation`, `another_video_started`, `explanation_meaning_shown` are sent to PostHog **only**. They are never written to the database, and the founder dashboard reads only the database. So the requested primary funnel is currently **unmeasurable** in the dashboard. Events that do exist in the DB (with first-seen dates): `sentence_clicked` (Jun 22), `explanation_viewed` (Jun 22), `transcript_seen`/`transcript_visible` (Jun 23), `sentence_hovered`, `first_sentence_click`, `hint_*` (Jun 23), `expression_saved` (Jun 18).

**G. Returning users.** Computed only for *registered* users, from distinct calendar days of activity per `user_id`, over all history, ignoring the date filter.

**H. `is_internal`.** Computed client-side and attached to PostHog events only — **not persisted anywhere in the DB**. Not currently usable for filtering.

**I. `experience_type`.** Same: PostHog-only, not in the DB.

**J. Schema needed.** Two small additive things: an `experiment_markers` table (date, title, note), and persisting `device_type` / `experience_type` / `is_internal` into the existing `library_events.metadata` jsonb (no column changes) plus new allowed event names in the logger's validator. No destructive migration, no renames, nothing deleted.

**K. Order.** Persist the new funnel events first (otherwise the new funnel shows zeros forever), then the range/filter work, then compare, then annotations/chart.

## Plan

### Phase 1 — essential
1. **Persist the funnel events.** Extend the allowed event list in `library-events.functions.ts` with `video_started`, `video_watched_30s`, `subtitle_explanation_requested`, `video_resumed_after_explanation`, `another_video_started`, and mirror those six from `HomeApp.tsx` (`trackWatch` keeps firing to PostHog; a DB write is added alongside) with `device_type`, `experience_type`, `is_internal` in `metadata`. Record today (2026-08-18) as their tracking-start date in a small `TRACKING_START` map so earlier periods render "Tracking began Aug 18, 2026" instead of a misleading 0%.
2. **Real range picker.** Replace the two date inputs with a shadcn `Calendar` in `mode="range"` inside a popover (two months side-by-side on desktop, single month on mobile) with Apply / Cancel. Presets all preserved, Custom added. Active range shown in the header as `Aug 12, 2026 → Aug 17, 2026 (Europe/Berlin)`.
3. **One range everywhere.** Thread `{from, to, filters}` into the cohort, product-health and retention server functions so every tab honours the selection; any card that is intentionally all-time gets an explicit "all time" label.
4. **Internal traffic filter**, defaulting to **Excluded**, with an obvious active-state chip; plus device and experience filters (they apply to the new metadata-carrying events; older rows count as "unknown" rather than being silently dropped).
5. **New primary funnel:** Visitors → Video Opened → Watched 30s+ → Subtitle Explanation Requested → Continued After Explanation → Another Video Started, each row showing `n / denominator` and the rate. Legacy rows (Clicked Sentence, Transcript Seen, Hovered, Saved Something, Saved Expressions) move into a **Legacy / Diagnostic Metrics** block — kept, just no longer primary.
6. **Unit labels** (SESSION / VISITOR / USER) on every metric, and small-sample notes when a denominator is under ~20.

### Phase 2 — comparison
7. Compare control: `Off / Previous period / Custom`, off by default. Each KPI shows Current, Previous, Change — counts as %, conversion rates as **percentage points**. Neutral language (Change / Before / After), no causal claims.
8. Acquisition / Activation / Retention grouping, with anonymous-visitor and returned-another-day / D1 / D7 numbers always shown as `count / denominator`.

### Phase 3 — nice to have
9. `experiment_markers` table + a tiny add/list form on the dashboard; markers inside the active range render as a compact timeline strip near the filter bar.
10. One daily trend chart (metric selector: visitors, video starts, watched 30s+, subtitle explanations, another video started) reusing the Chart.js setup already present, with marker overlays.

### Also
- Filters mirrored into the URL (`period`, `start`, `end`, `source`, `device`, `experience`, `internal`) so a view can be refreshed or shared.
- All filtering stays server-side/SQL; no historical data touched, renamed or deleted.

## Honest limitation
Before today, `subtitle_explanation_requested` and the continue/next-video events were never stored, so a true before/after comparison of the subtitle-interaction experiment can only start accumulating from now. The dashboard will state that rather than imply zero behaviour.
