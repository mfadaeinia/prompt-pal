## Goal

Split marketing from app so authenticated users stay in a persistent Learning Hub with preserved search/watch context, instead of being sent back to the landing page.

## Target routing

Current: everything lives in `src/routes/index.tsx` and switches via a local `view` state (`landing` | `demo` | `app`). "Back to Home" always resets to `landing`.

New file-based routes:

```
/            Marketing landing (MarketingLanding)
/demo        Interactive demo (current view === "demo" flow)
/app         Learning Hub (search + continue watching + saved + recent)
/watch/$videoId   Video player + transcript + explanations (auth required)
```

`/login` stays implicit via the existing `AuthDialog` (opened from CTAs). No dedicated `/login` page unless we later want a permalink.

## Refactor steps

1. **Extract the monolith.** Pull the existing `IndexPage` in `src/routes/index.tsx` apart into three shared modules under `src/features/player/`:
   - `usePlayerState.ts` — video/transcript/explanation/save state and mutations (everything currently keyed off `videoId`, `sentences`, `explanationCache`, etc.).
   - `PlayerView.tsx` — the JSX for the current `view === "demo"` and `view === "app"` player experience (header stays owned by the route).
   - `MarketingHeader.tsx` / `AppHeader.tsx` — two headers. Marketing gets today's nav; app gets logo + "← Back to Learning Hub" + saved/user menu.

2. **New routes.**
   - `src/routes/index.tsx` → renders `MarketingLanding` only. CTA `Try for Free` → if authed, `navigate({ to: "/app" })`; else open `AuthDialog`, on success navigate to `/app`. `Demo` CTA → `/demo`.
   - `src/routes/demo.tsx` → runs the demo flow (auto-load DEMO_VIDEO_ID, keeps the current unauth-friendly experience). Header shows "← Back to Home".
   - `src/routes/app.tsx` → new **Learning Hub** page. Auth-gated via `beforeLoad` redirect to `/` with auth dialog trigger (or inline sign-in). Sections:
     - Prominent search bar (reuses `YouTubeDiscovery` / `AppOnboarding` search box, wired to persist query).
     - Continue Watching (last video from `saved_videos` + local `last_watch` marker).
     - Recently Watched (derived from `video_sessions` for the user).
     - Recent Searches (localStorage, last 8).
     - Saved Expressions preview (first 6 from `saved_expressions`) → link to `/saved`.
     - Saved Videos preview → link to `/saved`.
   - `src/routes/watch.$videoId.tsx` → renders `PlayerView` with `videoId` from the URL param. Header uses "← Back to Learning Hub" → `/app`. Opening a video from the hub navigates here instead of mutating local state.

3. **Preserve search + scroll state.** Add `src/lib/hub-state.ts` with a tiny module-scoped store (plus `sessionStorage` mirror) holding `{ query, results, scrollY, lastVideoId }`. Learning Hub reads it on mount and restores query/results/scroll. Search updates write to it. `watch.$videoId` reads `lastVideoId` for Continue Watching.

4. **Session persistence.** On mount of `/app`, if `sessionStorage.nativeflow_last_video` exists, show it in Continue Watching. On mount of `/watch/$videoId`, write it. `useAuth`-gated: if unauthenticated user hits `/app` or `/watch/*`, redirect to `/` and open `AuthDialog`; after sign-in, resume the intended route (reuse the current `nativeflow_post_auth_intent` mechanism, extend it to store a target path).

5. **Header/back-button rewrite.**
   - Marketing routes (`/`, `/demo`): header = current marketing header, "Back to Home" only on `/demo`.
   - App routes (`/app`, `/watch/*`, `/saved`): shared `AppHeader` with `← Back to Learning Hub` (hidden on `/app` itself), logo → `/app` (not `/`), and a user menu containing `Saved`, `Visit Website` (→ `/`), `Log out`.

6. **Cleanup.** Remove the old `view` state, `goHome`, `setView("landing"/"demo"/"app")` calls; delete the CTA path that mutated view in place. Update `AppOnboarding` to call `navigate({ to: "/watch/$videoId", params: { videoId } })` instead of loading in place.

## Technical notes

- TanStack Router file routes: new files auto-register via `routeTree.gen.ts` on next build; no manual edits.
- Dynamic segment `/watch/$videoId` uses `<Link to="/watch/$videoId" params={{ videoId }}>` — never string-interpolated hrefs.
- Auth gate: use a `beforeLoad` in `/app` and `/watch/$videoId` that reads `supabase.auth.getSession()` (client) and `redirect({ to: "/", search: { authRequired: 1, next: location.href } })`. Root `IndexPage` reads `authRequired` search param to auto-open the auth dialog. This avoids introducing an `_authenticated` layout right now while still gating.
- Analytics: keep existing `track("google_login_completed" …)` and `page_view`; add `hub_view` and `watch_view` events.
- No DB schema changes needed. Continue Watching + Recently Watched read from existing `saved_videos` and `video_sessions` tables.
- SEO: `/demo`, `/app`, `/watch/$videoId` each get their own `head()` with unique title/description; `/watch/$videoId` sets `og:image` to the YouTube thumbnail from loader data. `/app` and `/watch/*` should be `noindex` (private surface).

## Out of scope for this pass

- Learning Statistics widget (leave a placeholder container).
- Recommended Videos (mount an empty section for future work).
- A dedicated `/login` route (auth stays modal-based).
- Refactoring `saved.tsx` internals beyond swapping its header to the new `AppHeader`.
