
# Evolve NativeFlow → Daily Dutch Media Discovery (Phase 1 MVP)

Reframe the product around **"What's happening in Dutch media today?"** while preserving every existing feature (auth, transcript flow, explanations, saved expressions, founder dashboard, marketing landing).

## What we have today (inspection)

- `src/routes/index.tsx` (5146 LOC) drives 3 views via a `view` state: `landing` (marketing), `app` (Learning Hub in `AppOnboarding.tsx`), `demo` (dark Learning Mode with video + transcript + explanations).
- `AppOnboarding.tsx` = post-auth hub with YouTube search + curated recommendation cards (`POPULAR_EXAMPLES`, `DUTCH_EXAMPLES`).
- `src/routes/saved.tsx` = "My Library" for saved expressions/videos.
- Working infra we will reuse verbatim: `transcript.functions.ts`, `explain.functions.ts`, `saved-expressions.functions.ts`, `saved-videos.functions.ts`, `AuthDialog`, Learning Mode UI.
- No content/CMS table exists yet.

## Phase 1 scope (this change only)

### 1. New "Today" feed — the new post-auth home
Replace `AppOnboarding` as the default `app` view with a new `TodayFeed` component. Keep search + recommendation grid accessible via a **"Discover"** tab.

**Sections** (editorial, top → bottom):
1. Today's Top Story (1 hero card)
2. Trending Now (horizontal scroll)
3. Culture & Entertainment
4. Good to Know as an Expat
5. Learn Dutch From Today's Content (expressions extracted from featured items)

**Card fields shown:** thumbnail, title, source, category chip, duration, Dutch level chip (A1–C1), 1-line English "why it matters", "Watch & Learn" CTA. Clicking → existing Learning Mode (`demo` view) with the video's URL/language preloaded — zero changes to the transcript path.

### 2. Content data model (new table, curated)
New migration adds `public.dutch_media_items`:

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| title | text | |
| source_url | text | YouTube URL |
| video_id | text | extracted |
| thumbnail_url | text | |
| source | text | e.g. NOS, Jeugdjournaal |
| category | text enum-like: `top_story` / `trending` / `culture` / `expat` |
| duration_sec | int | |
| difficulty | text: `A1..C1` |
| short_english_summary | text | |
| why_it_matters | text | |
| language | text default `nl` |
| published_at | timestamptz | |
| featured_date | date | which day's feed it belongs to |
| sort_order | int | within its category for that day |
| status | text default `published` |
| created_at / updated_at | timestamptz | |

RLS: `SELECT` to `anon` + `authenticated` where `status = 'published'`; writes `service_role` only. Standard GRANTs.

**Seed:** insert ~10–12 curated items (reuse existing `DUTCH_EXAMPLES` + a few TED/NOS picks) with `featured_date = current_date` so the feed is non-empty on day 1. No scraper, no cron — Phase 3.

### 3. Server function
`src/lib/dutch-media.functions.ts` — public `getTodayFeed()` using the server publishable client (narrow `TO anon` SELECT). Returns items grouped by category for the latest `featured_date <= today`.

### 4. Navigation
Add a lightweight top nav inside the `app` view: **Today · Discover · Library**.
- Today → new `TodayFeed`
- Discover → existing `AppOnboarding` (search + recs) untouched
- Library → link to existing `/saved`

Marketing landing (`view === "landing"`) is untouched aside from optional hero copy tweak (skipped unless requested).

### 5. Preserved (no changes)
- All transcript / explanation / saved flows
- Learning Mode (`demo`) dark theme
- Auth flow, AuthDialog, post-auth intent
- Founder dashboard, sitemap, SEO work
- `/saved` route

## Explicitly OUT of scope (later phases)
- Onboarding questionnaire (level/interests) — Phase 2
- Personalization, extracted-expressions pipeline, daily auto-refresh — Phase 2
- Scraping, trending scoring, AI summaries — Phase 3
- Streaks / gamification — not planned
- Rewriting `index.tsx` — we add, we don't refactor

## Files touched
- **New**: `supabase/migrations/<ts>_dutch_media_items.sql`, `src/lib/dutch-media.functions.ts`, `src/components/TodayFeed.tsx`, `src/components/AppNav.tsx`
- **Edit**: `src/routes/index.tsx` — swap `app` view to render `<AppNav />` + one of `TodayFeed` / `AppOnboarding`; card click reuses existing `handlePickVideo(url, language)`. ~40 lines changed, no deletions of working code.

## Post-implementation summary I'll deliver
- Files changed + what each does
- Migration SQL + seed row count
- Preserved features list
- Remaining work for Phase 2 / 3 (personalization, automated discovery)

Approve and I'll build it.
