# NativeFlow Public Cleanup — Inventory + Plan

No code changed yet. Below is the inventory, then the proposed cleanup. Nothing destructive, no database changes, no analytics removal.

## A. Current public routes

| Route | What it is |
|---|---|
| `/` | One 5,656-line file driving three views: marketing landing → app "Learning Hub" → video player |
| `/library` | Explore Dutch: search + filter grid of curated videos, with an optional "By level" tile section below |
| `/library/$level` | Per-CEFR-level video list |
| `/english-learners` | Second marketing landing variant, SEO-only, zero internal links |
| `/contact`, `/privacy`, `/terms` | Static pages, linked from the footer |
| `/sitemap.xml`, `/robots.txt` | SEO infrastructure |

## B. Internal / admin routes

- `/saved` — "My Learning": saved videos + saved expressions, auth required
- `/founder` — password-gated analytics dashboard (shared secret, `localStorage` cached)
- `/api/public/curate-refresh` — cron, secret-header protected
- `/api/public/transcript-stream` — transcript streaming
- `/mcp`, `/.mcp/*`, `/.well-known/*`, `/.lovable/*`, `/lovable/email/*` — platform plumbing, not user-facing

## C. Current navigation

- **Player/app header** (`/`): back button ("Back to Learning Hub" / "Back to Home"), logo, Explore Dutch, Founder (dev only), "Signed In" pulsing badge, Sign out, My Learning (with count badge), Save video.
- **Library sidebar**: Home, Browse, My Learning (links to `/` — dead link), Saved videos, plus three disabled "soon" stubs: History, Vocabulary, Notebook. Also an "Unlock Premium / Upgrade" card whose button does nothing.
- **Footer**: Explore Dutch, Contact, Privacy, Terms, "Language Learning Beta".

## D. Major CTAs

Start for free, Explore Dutch, Save video / Saved, My Learning, Sign out, transcript toggle, Useful expression "More", explain-language selector, learner-level selector (A1–C2), Replay, Back to Watch Mode, Try Another Video, Upgrade, feedback FAB, dev diagnostics panels.

## E. Findings worth flagging

- There is **no** Watch|Learning toggle switch in the current code. Mode is internal state (`studyMode`), plus a one-way "Back to Watch Mode" escape button in the transcript-failure panel. So item 2 of your brief is largely already done — only leftover "Learning Mode" wording and that button remain.
- `UsefulDutchPanel` and `ContextStrip` are fully built but **imported nowhere** — already effectively hidden.
- Library cards already navigate to `/?v=…`, so there is no separate experimental video route leaking into discovery.
- Analytics has **no** `experience_type` property anywhere yet.

## F. Recommended: KEEP

Landing, `/library`, the player + video, transcript (it works and is already behind an on-demand toggle), `/contact`, `/privacy`, `/terms`, `/founder`, `/saved` as a route, all analytics, all server functions and data.

## G. Recommended: HIDE from public UI (code preserved)

1. **Save video** button in the player header — leads into `/saved`, which we're de-emphasising.
2. **My Learning** header link + count badge, and the saved-tooltip nudge. `/saved` keeps working by direct URL.
3. **"Signed In"** pulsing badge — replaced by nothing; Sign out stays as a small icon-only control.
4. Library sidebar: remove History / Vocabulary / Notebook stubs, the "My Learning → /" dead link, and the non-functional **Upgrade Premium** card.
5. **Learner-level (A1–C2) selector** in the Hub — a setting a new user shouldn't have to configure before watching; the B1 default and stored value keep driving ranking.
6. Leftover **"Learning Mode"** wording in error/progress copy → plain language ("transcript", "sentence explanations").

## H. Recommended: /experiments

Create two internal-only routes, `noindex`, absent from all navigation, sitemap, and search:

- `/experiments` — a plain list of links, nothing else.
- `/experiments/passive-learning` — renders the current player with the experimental layer forced on (synchronized subtitle overlay + Useful expression bar + expression ranking), so we can keep iterating.

Public `/` keeps the video + subtitle overlay it has today; the **Useful expression bar** moves to experiment-only. This is the one behavioural change to the public player, and it is a prop flip, not a deletion.

## I. Remove from navigation only

- `/english-learners` — leave live (it may be in ads/search) but drop it from `sitemap.xml` so we stop promoting a second landing page. Not deleted.
- "Language Learning Beta" footer text — noise.

## J. Safe to DELETE

- `src/components/UsefulDutchPanel.tsx` and `src/components/ContextStrip.tsx` — zero imports.

Given your "hide before delete" rule, my default is to **leave both files in place** and only delete if you say so.

## K. Redirects

- `/library/$level` stays working (shared links) but stops being a primary path.
- No route is removed, so no new 404s.

## L. Analytics

Nothing removed, no event renamed. One additive change: `trackWatch` and `track` gain an `experience_type` property — `"public"` by default, `"passive_learning_experiment"` under `/experiments/*`. Founder/test sessions already flagged by the dev-panel mechanism get `is_internal: true` so they can be excluded later. Historical rows simply lack the property, so funnels stay comparable.

## M. Proposed public information architecture

```text
/                    Landing — what NativeFlow is, one CTA
/library             Explore Dutch — interest first, CEFR as filter/badge
/?v=<video>          Watch — video, subtitle, optional transcript
/contact /privacy /terms

hidden but working:  /saved   /founder   /experiments/*
```

Header, public: `← Explore Dutch` · logo · `Explore Dutch` · account (sign in / sign out icon). Mobile: back arrow, logo, account. Nothing else.

## N. Risk notes

- No database migration, no data deletion, no auth change.
- `/saved` and its data are untouched; only its entry points are hidden.
- The only public functional reduction is the Useful-expression bar moving behind the experiment route.

## Approval needed

Say go and I'll implement F–L as described. Tell me separately if you also want J (deleting the two unused components) — otherwise I leave them on disk.
