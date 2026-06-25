## Goal

Make the Founder Dashboard answer "did the latest release improve user behavior?" by scoping every metric to a **release cohort** + time/source filter, instead of lifetime aggregates.

---

## 1. Data model (new migration)

**`release_cohorts`**
- `id uuid pk`, `name text`, `description text`, `started_at timestamptz`, `ended_at timestamptz null`, `is_active bool`, `created_at`
- Only one active cohort at a time (partial unique index on `is_active`).
- Seed one row: `v0.8 – Baseline` with `started_at = min(video_sessions.created_at)` so historical data is attributed.

**Augment existing tables** (add nullable columns, no backfill rewrites except cohort_id):
- `video_sessions`: `cohort_id uuid`, `acquisition_source text`, `utm_source text`, `utm_medium text`, `utm_campaign text`
- `page_views`: `cohort_id uuid`, `acquisition_source text`, `utm_source/medium/campaign`
- `library_events` / `tester_events`: `cohort_id uuid` (assigned at insert time)
- `saved_expressions`, `saved_videos`: already user-scoped, add `cohort_id` at insert
- Backfill `cohort_id` on all existing rows → baseline cohort id.

GRANTs + RLS: `release_cohorts` readable by authenticated (founder gate already on dashboard), writable only via founder server fn (service role).

## 2. Cohort assignment at write time

- New server helper `getActiveCohortId()` (cached in-process for ~60s).
- Update every insert path used by the app:
  - `video-sessions.functions.ts` (session create)
  - `page-views.functions.ts`
  - `library-events.functions.ts`
  - `tester-events.functions.ts`
  - `saved-expressions.functions.ts`, `saved-videos.functions.ts`
- All new rows automatically get the current active cohort id. No historical mutation.

## 3. Acquisition source capture

- Client: on first page load, parse `utm_*` params + `document.referrer`; classify into `Instagram | Facebook | LinkedIn | Reddit | Teacher Referral | Direct | Unknown` (referrer host map + utm override). Persist to `localStorage` (`nf_acq`) so it sticks across navigations.
- Send with every `page_view` + `video_session` insert.
- Util: `src/lib/acquisition.ts` (`detectAcquisition()`, `getStoredAcquisition()`).

## 4. Founder server fns (new file `src/lib/founder-cohorts.functions.ts`)

All `.middleware([requireSupabaseAuth])` + founder role check (reuse `founder-auth` pattern):
- `listCohorts()` → all cohorts ordered desc.
- `startNewCohort({ name, description })` → end current (`ended_at=now, is_active=false`), insert new active.
- `getActivationFunnel({ cohortId?, range?, source? })` → returns stages with raw + pct.
- `getOverviewMetrics(filter)` → totals + previous-cohort comparison.
- `getNotActivatedBreakdown(filter)` → counts of "never opened video / never watched 30s / never clicked sentence" within 7d of signup.

**New activation definition** (server-side SQL):
- For each user signed up in window: look at all their sessions in the 7 days after signup; activated = `∃ session with watched_30s` AND `∃ session (any) with sentence_click`. Stored as a CTE, not a column.

## 5. Filter UI (dashboard-wide)

`src/components/founder/DashboardFilters.tsx`:
- Dropdowns: **Cohort** (Current Release ⭐ / Since Last Release / All Time / specific cohort), **Range** (7d / 30d / Custom), **Source** (All / Instagram / Reddit / …).
- State lifted to `src/routes/founder.tsx` via TanStack Router `validateSearch` (URL-driven, shareable).
- Default = Current Release + All Sources.
- Every tab (Overview, Funnel, Users, Health, Feedback, Engineering) reads the same filter and passes it to its server fn query key.

## 6. Funnel + trend rendering

`FunnelStage` component shows `count` big, `pct of previous stage` small, arrow between.
`TrendBadge` component renders previous cohort value + delta with up/down arrow + color.
Applied to: Activation %, Sentence Click Rate, Avg Session Length, Return Rate, Save Rate, Signups, Videos Opened.

## 7. "Start New Release Cohort" button

Top-right of dashboard. Opens dialog: name (required, e.g. `v0.12 – Sticky sentence`), description (optional). On submit → `startNewCohort` → invalidate cohort queries → toast.

## 8. Not-activated breakdown panel

Below funnel: three rows with counts of users (in filter window) blocked at each stage. Clicking a row could later drill into the user list (out of scope for v1).

---

## Technical notes

- All queries scoped server-side; client never filters in JS.
- Previous-cohort comparison: server fn returns `{ current, previous, deltaPct }`.
- Indexes: `create index on video_sessions(cohort_id, created_at)`, same on page_views.
- Founder role check reuses existing `founder-auth.functions.ts` pattern (password-gated session). No new auth surface.
- No edits to `src/integrations/supabase/*` auto-gen.
- Existing dashboard logic in `src/routes/founder.tsx` + `DevAnalyticsPanel.tsx` is rewritten to consume the new filtered server fns.

## Out of scope (call out explicitly)

- Per-user drill-down lists
- Cohort comparison charts (multi-cohort overlay) — only "current vs previous"
- Editing/deleting cohorts after creation
- Backfilling acquisition source for old sessions (we don't have referrer data)

## Files touched

**New:**
- `supabase/migrations/<ts>_release_cohorts.sql`
- `src/lib/founder-cohorts.functions.ts`
- `src/lib/acquisition.ts`
- `src/components/founder/DashboardFilters.tsx`
- `src/components/founder/FunnelStage.tsx`
- `src/components/founder/TrendBadge.tsx`
- `src/components/founder/StartCohortDialog.tsx`

**Edited:**
- `src/routes/founder.tsx` (filters, new button, rewired queries)
- `src/components/DevAnalyticsPanel.tsx` (consume filter)
- `src/lib/video-sessions.functions.ts`, `page-views.functions.ts`, `library-events.functions.ts`, `tester-events.functions.ts`, `saved-expressions.functions.ts`, `saved-videos.functions.ts` (stamp cohort + acquisition)
- `src/routes/__root.tsx` or `index.tsx` (early acquisition capture on first load)
