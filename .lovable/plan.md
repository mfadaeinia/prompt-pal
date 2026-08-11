# Low-friction first value + anonymous retention analytics

## Inspection report (A–K)

**A. Authentication today** — Google OAuth only, via `lovable.auth.signInWithOAuth("google")` in `src/components/AuthDialog.tsx`, session stored by the backend client; `src/hooks/use-auth.tsx` exposes `user` / `isAuthenticated`. No email/password, no signup wall anywhere in the player.

**B. Google sign-in** — already exists and works; button label is already "Continue with Google" (no "Gmail" wording anywhere in the codebase).

**C. "Start for free"** — three places: the public header (`HomeApp.tsx` ~2852), a landing CTA (~3669), a mid-page CTA (~3916), plus one in `YouTubeDiscovery.tsx`. All simply open the auth dialog. Nothing is gated behind it — pasting a URL, the demo, Explore Dutch and watching all already work anonymously.

**D. Persistent anonymous ID** — one already exists: `nativeflow_browser_id` (UUID in localStorage, `src/lib/browser-id.ts`). It survives restarts and is already used to scope anonymous saves. It will be reused as `anonymous_user_id`; no new identifier.

**E. session_id** — generated per page load in a `useRef` in `HomeApp` (lost on any full navigation, so today "session" ≈ page load). Sent to `page_views`, `video_sessions`, `library_events`.

**F. user_id** — auth user id, attached to the same server functions when signed in, plus `getUserRetentionCohort` joins by `user_id`.

**G. Where events live** — PostHog (client, `src/lib/analytics.ts`, already enriched with `is_test_user`, `experience_type`, `is_internal`, `landing_variant`, `device_type`) **and** three Cloud tables: `page_views`, `video_sessions`, `library_events`.

**H. Returning users today** — only for registered users (`user-retention.functions.ts`, D1/D7/D30 by `user_id`). Anonymous returning visitors cannot be computed: no table carries a persistent browser id.

**I. Landing events already present** — `page_view`, `session_started`/`session_ended`, `marketing_hero_url_submitted`, `demo_*`, `video_opened`, `video_started`, `video_watched_30s`/`60s`, percent milestones, `sentence_clicked`, `auth_dialog_opened`, `google_login_started`.

**J. Schema change needed** — additive only: nullable `anonymous_id text` on `page_views`, `video_sessions`, `library_events` + indexes. No drops, no backfill, no data rewrite.

**K. Privacy** — the id is a random UUID in first-party localStorage; no fingerprinting, no name/email/IP inference tied to it. Note `video_sessions` already stores IP/user-agent (unchanged). Linking anon→account happens only after explicit sign-in.

## Minimum implementation

**Landing / header copy**
- Header becomes: logo · Explore Dutch · subtle text "Sign in" (signed in: "Sign out" only). Remove "Start for free" from header and the two landing CTAs (secondary CTAs become Explore Dutch / demo).
- Hero: "Watch Dutch videos. Actually understand what's being said." / "Follow authentic Dutch with transcripts and contextual explanations when you need them." / field placeholder "Paste a Dutch YouTube link…" / helper "No account needed."
- Demo copy de-emphasises "tap a sentence"; demo itself untouched. No new sections.

**Auth**
- Unchanged infrastructure. Dialog copy shifts to persistence framing: "Save your progress — sign in to keep your NativeFlow activity across devices." Only save/library actions open it.

**Identity + analytics**
- `session_id` moves to `sessionStorage` so it means one browsing session, not one page load.
- `anonymous_user_id` = existing `nativeflow_browser_id`; registered as a PostHog super property so every event carries it; also sent to the three tables' new `anonymous_id` column.
- On sign-in, alias anon → user in PostHog and emit `account_linked` with both ids (existing anonymous-save claim flow stays).

**Founder dashboard**
- New "Visitors" block: unique / new / returning anonymous visitors, D1 and D7 anonymous return, registered users — computed from `page_views.anonymous_id` + `video_sessions.anonymous_id`, excluding internal traffic and honouring the existing date/source filter.
- Existing activation funnel kept and relabelled "Session-based funnel"; retention section labelled "Visitor / user retention".

**Not built:** anything in section 26.
