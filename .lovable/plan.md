# Founder Dashboard v2 — Phased Plan

Per your guidance: ship time-based analytics + source filter first. Defer notes, charts, and table enhancements to follow-up phases. Keep current tabs and layout. Default to All Sources. Conservative source bucketing.

## Phase 1 — Time-based analytics + source filter (this iteration)

### Scope
1. **Global time filter** at top of `src/routes/founder.tsx`, affecting every tab.
   - Presets: Today, Yesterday, Last 24h, Last 3d, Last 7d, Last 14d, Last 30d, This Month, All Time, Custom.
   - **Default: Last 7 Days.**
   - Persisted in URL search params (`from`, `to`, `preset`) so refresh/share preserves state.

2. **Global source filter** beside the date filter.
   - **Default: "All Sources" (no filtering applied).**
   - Buckets derived conservatively from existing `page_views.referrer` / `utm_source` columns only:
     - Instagram (`l.instagram.com`, `instagram.com`, utm_source=instagram)
     - Facebook (`l.facebook.com`, `m.facebook.com`, `facebook.com`)
     - Reddit (`reddit.com`)
     - Google (`google.com`, `bing.com` → Search)
     - Direct (no referrer)
     - **Unknown** (anything we can't confidently classify — never silently dropped)
   - Skip LinkedIn / Teacher Referral buckets until data exists for them.

3. **Previous-period comparison** for all top-line KPIs.
   - For preset "Last 7 Days", compare to the 7 days immediately prior.
   - For "All Time", omit the delta (no equivalent prior period).
   - Show absolute value + signed % delta + arrow.

4. **Recompute existing metrics for selected window**:
   - Overview KPIs, Activation Funnel, Session Quality, Users list, Product Health, Feedback, Engineering — all filtered by `[from, to]`.
   - Funnel shows raw count, conversion %, drop-off % per step, computed only within window.

5. **Real Activation — explicit labels** (no ambiguous "Activated"):
   - **"Activated (session)"** — ≥30s watched AND sentence clicked in same session, within window.
   - **"Activated (user)"** — both events within 7 days of signup, across sessions, where signup falls in window.
   - Both displayed side-by-side with tooltip explaining the definition.

6. **Data integrity guard**: a small "Reconciliation" line on Overview showing `page_views` row count for the window so it matches raw analytics — surfaces any silent filtering.

### Technical changes

- `src/lib/founder-metrics.functions.ts`: add `{ from, to, source }` input; push date + source predicates into every Supabase query; add a sibling call for the previous-period window; return `{ current, previous }` shape.
- `src/lib/page-views.functions.ts` + `src/lib/video-sessions.functions.ts`: accept the same filter args.
- `src/lib/source-bucket.ts` (new, tiny): pure function mapping referrer/utm → bucket label. Shared client + server.
- `src/routes/founder.tsx`:
  - Add `validateSearch` (zod) for `from`, `to`, `preset`, `source`.
  - Top toolbar: preset Select + shadcn date range Popover + source Select.
  - New `<KpiCard>` rendering value + delta from `{ current, previous }`.
  - Thread filter into all existing tab sections; no layout/tab restructure.

### Out of scope this phase (deferred)
- Campaign notes timeline + chart markers (Phase 2).
- Daily trend charts (Phase 2).
- Users-tab filter chips + multi-sort (Phase 3).
- New source buckets (LinkedIn, Teacher Referral) — only when data exists.

## Phase 2 (follow-up)
- Founder Notes table + UI + chart markers.
- Per-day trend charts (visitors, opens, click rate, save rate, signups, avg session, returning).

## Phase 3 (follow-up)
- Users-tab advanced filters + sortable columns.

## Acceptance for Phase 1
- Changing date preset updates every tab's numbers.
- "All Sources" default shows the same visitor count as raw analytics for the same window.
- Each KPI shows a previous-period delta (except All Time).
- Activation cards explicitly say "Activated (session)" vs "Activated (user)".
- URL reflects current filter; refresh preserves it.
