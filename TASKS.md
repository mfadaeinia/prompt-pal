# NativeFlow validation tasks

Source of truth: [two-month validation spec](docs/specs/nativeflow-two-month-validation.md)

Timebox: 6–8 weeks, 40–60 founder-hours. Validate the Dutch YouTube wedge before expanding scope.

## Week 1–2 — Reliability and mobile gate

- [ ] Run the internal reliability matrix: 4 curated videos, 3 searched videos, and 3 pasted URLs.
- [ ] Test desktop and phone-sized flows end to end.
- [ ] Verify video loading, subtitles, explanations, resume, saving, and recovery states.
- [ ] Fix all critical bugs before recruiting the pilot.
- [ ] Manually review at least 20 explanations for misleading or low-confidence output.

## Week 3 — Give users a reason to return

- [ ] Add lightweight next-session review of saved expressions.
- [ ] Add a clear return prompt: “Watch another Dutch video tomorrow and review today’s expressions.”
- [ ] Confirm saved expressions persist and appear in the next session.
- [ ] Keep full spaced repetition, streaks, and gamification out of scope.

## Week 4 — Measurement and payment

- [ ] Reconcile production events with the founder dashboard: selection, start, meaningful watch, subtitle tap, explanation, resume, save, review, and return.
- [ ] Verify demo, founder, development, preview, bot, and test traffic are excluded.
- [ ] Record explanation helpfulness, failure reasons, and short post-session comprehension.
- [ ] Add one €9.99/month checkout or payment link.
- [ ] Verify successful, cancelled, failed, and re-entered payment states.
- [ ] Treat completed payment—not interest or checkout opens—as payment evidence.

## Week 5 — Re-contact and observe previous testers

- [ ] Personally invite the five informed testers, explaining that reliability and mobile issues were fixed.
- [ ] Ask each person to bring one real Dutch YouTube video.
- [ ] Observe at least one complete session where possible.
- [ ] Send no more than one or two follow-ups to non-responders.

## Week 6 — Five-person observed pilot

- [ ] Recruit 5 serious B1–B2 Dutch learners who watch Dutch YouTube at least twice weekly.
- [ ] Give every participant the same onboarding and seven-day mission.
- [ ] Require one personally chosen video, two successful sessions, two saved expressions, and a second-session review.
- [ ] Ask for €9.99/month after one or two successful sessions.
- [ ] Track activation, second session within 7 days, weekly returns, unresolved phrases, comprehension, helpfulness, failures, and payment.

## Week 7 — Analyze behavior

- [ ] Interview non-returners and classify the cause: reliability, usability, habit, value, or pricing.
- [ ] Investigate every negative explanation report.
- [ ] Compare curated-video onboarding with search and pasted-URL usage.
- [ ] Check whether the explanation loop—not Dutch content alone—is driving return behavior.

## Week 8 — Decide

- [ ] Continue if 4–5 observed users return and at least 2 complete payment; deepen the Dutch YouTube wedge.
- [ ] Pivot if users return but do not pay, or a different high-value job emerges.
- [ ] Kill if reliable users with an explicit return mission and their own content almost never return or pay.
- [ ] Document the evidence, decision, and next scope.

## Transcription diagnostics mismatch — status: fixed (not deployed)

**Root cause.** The Founder transcript trace re-implemented the cache lookup instead of calling the
production one, so diagnostics disagreed with what learners receive: no pipeline-version gate (rows
below the current version are re-fetched in production but reported as cache hits), strict `===`
language comparison (so `nl-NL` vs `nl` read as a miss) and no poisoned-row check.

**Changes.** `src/lib/transcript.functions.ts` — one shared read-only lookup (`readCacheDetailed`,
exposed as `inspectTranscriptCache`); `readCache` is now a thin wrapper over it, live selection logic
unchanged. `src/lib/transcript-trace.functions.ts` — step 2 calls the shared lookup and reports the
required pipeline version, rows at current version, stale versions and per-row rejection reasons.
`src/routes/founder.tsx` — those four fields are shown in the Step 2 trace block.

**Test evidence** (`inspectTranscriptCache` against production cache rows, `bunx tsgo --noEmit` clean):

| Case | Video | Requested | Result |
|---|---|---|---|
| Stale rows only (v4) | `OBRABge6XJ4` | `nl` | miss `all_rows_below_pipeline_version` (previously reported as a hit) |
| Fresh v5 row | `4EE7m94mJpk` | `nl` | hit |
| Base-language match | `4EE7m94mJpk` | `nl-NL` | hit (previously reported as a miss) |
| `_any_` row + stale sibling | `4GutxLa-p50` | `_any_` | hit, stale versions `[1]` reported |
| Unknown video | `zzzzzzzzzzz` | `nl` | miss `no_rows_for_video_id` |

**Not changed.** Provider architecture, CAPTCHA handling, transcript fetching/segmentation,
explanation logic, analytics definitions, unrelated UI. Nothing deployed.

## Critical bug definition

A critical bug blocks or materially damages the core loop: supported video processing, subtitle interaction, explanation display, playback resume, saving/review, mobile usability, or trustworthy measurement. Critical bugs block pilot launch until fixed or explicitly accepted with a documented workaround.

## Out of scope for this validation

Other languages, podcasts, Netflix, browser overlays, institutional sales, full spaced repetition, gamification, large-scale marketing, major AI redesigns without observed blocking failures, and complex billing infrastructure.

## Evidence log

| Date | Cohort/user | Event or observation | Evidence/link | Decision impact |
|---|---|---|---|---|
|  |  |  |  |  |

