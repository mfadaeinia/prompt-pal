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

**Changes.** `src/lib/transcript-cache-select.server.ts` (new) — the pure cache-row selection helper,
no database access: pipeline-version gate, base-language matching (`nl-NL` ≡ `nl`, `dutch` ≡ `nl`),
`_any_` auto-detection path and the poisoned-row check, with per-row rejection reasons. Selection input
carries `source_version`, `language`, `requested_language`, `provider_response_language`, `provider`
(with `source` fallback) and `transcript_json`. `src/lib/transcript.functions.ts` — `readCacheDetailed`
now only reads the rows and delegates to that helper; `readCache` is a thin wrapper over it and live
spoken-language resolution/normalization is unchanged; `inspectTranscriptCache` is the read-only
diagnostics entry point. `src/lib/transcript-trace.functions.ts` — step 2 calls it and reports the
required pipeline version, rows at current version, stale versions and rejections.
`src/routes/founder.tsx` — those four fields appear in the Step 2 trace block.

**Test evidence** — `bunx vitest run`: 6 files, 55 tests passing; `bunx tsgo --noEmit` clean.

Unit tests, `src/lib/transcript-cache-select.test.ts` (9 pure-selection cases): no rows; stale-only
rows rejected; fresh row preferred over stale sibling; `nl-NL` ≡ `nl`; `dutch` ≡ `nl`; unrelated
language rejected; poisoned row (Arabic text stored as `nl`) skipped; `_any_` accepts an
auto-detected row; version gate still applies under `_any_`.

Regression test, `src/lib/transcript-cache-parity.test.ts`: for the same video and the same resolved
language, the diagnostics step and the live lookup agree on hit, picked row id, miss reason, row count
and pipeline version across stale-only / fresh `nl` / fresh `nl-NL` / `_any_` / missing-video cases,
plus explicit assertions that stale-only rows no longer report a hit and that `nl-NL` does.

Live spot-check against production cache rows before the refactor: `OBRABge6XJ4` (`nl`) miss
`all_rows_below_pipeline_version` (previously a false hit), `4EE7m94mJpk` (`nl` and `nl-NL`) hit,
`4GutxLa-p50` (`_any_`) hit with stale versions `[1]` reported, unknown video miss.

**Scope note.** This fixes diagnostic accuracy only. YouTube rate limiting and oversized Whisper audio
are untouched; the next step is measuring the real production failure rate from now-trustworthy traces
before addressing those separately.

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

