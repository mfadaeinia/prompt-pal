# NativeFlow two-month validation

## Problem Statement

Self-directed B1–B2 Dutch learners already watch Dutch YouTube, but when they encounter language they do not understand, they often skip it, interrupt the video to search elsewhere, or abandon the session. Those unresolved gaps limit the learning value of the native media they already consume.

NativeFlow has received positive early reactions, but the evidence is inconclusive. Previous testers encountered video failures and mobile UX problems, were not given a concrete reason to return, and were not asked to pay. Only one of five informed testers returned once. Therefore, the previous experiment did not cleanly test whether the explanation loop creates recurring value.

## Solution

Run a timeboxed validation of NativeFlow's Dutch YouTube wedge before investing in a broader native-media platform.

The core loop is:

> Watch authentic Dutch YouTube → encounter confusion → tap the subtitle → receive contextual meaning, a natural translation, and one useful example → continue watching → save an expression → review it in a later session.

The validation release must make this loop reliable on desktop and mobile, give users a clear reason to return, measure the behavior honestly, and test a €9.99/month payment decision after successful use.

The effort is limited to 6–8 weeks and approximately 40–60 founder-hours. The outcome is an evidence-based decision to continue, pivot, or kill the direction.

## User Stories

1. As a B1–B2 Dutch learner, I want to start with a curated Dutch video, so that I can experience value without searching for content first.
2. As a Dutch learner, I want to search for a Dutch YouTube video, so that NativeFlow fits the content habit I already have.
3. As a Dutch learner, I want to paste a YouTube URL, so that I can study content I personally care about.
4. As a Dutch learner, I want to watch authentic Dutch content with interactive subtitles, so that I can keep the video context while learning.
5. As a Dutch learner, I want to tap a confusing subtitle, so that I can ask for help exactly when I need it.
6. As a Dutch learner, I want a concise contextual meaning, natural translation, and useful example, so that I understand the phrase without leaving the video.
7. As a Dutch learner, I want optional grammar depth, so that I can choose between continuing the video and studying further.
8. As a Dutch learner, I want the player to resume naturally after an explanation, so that help does not create a new interruption loop.
9. As a Dutch learner, I want NativeFlow to handle supported videos reliably, so that a failed video does not undermine trust in the product.
10. As a Dutch learner, I want a clear recovery message when a video cannot be processed, so that I know what to do next instead of seeing a blank or stuck interface.
11. As a mobile learner, I want to complete the watch, tap, explanation, resume, and save flow on a phone, so that I can use NativeFlow in the same situations where I normally consume videos.
12. As a Dutch learner, I want to save an expression, so that I can return to language that was personally relevant to me.
13. As a returning learner, I want to review expressions saved in my previous session, so that saved items give me a concrete reason to come back.
14. As a returning learner, I want to continue with another video after reviewing saved expressions, so that the product supports a repeatable daily habit.
15. As a learner, I want to mark whether an explanation helped, so that NativeFlow can distinguish useful help from merely interesting output.
16. As a learner, I want to report whether NativeFlow was faster or slower than my current workflow, so that the product can be judged against the interruption-and-abandonment alternative.
17. As a learner, I want to report a comprehension score after a session, so that I can reflect on whether I understood more of the content.
18. As the founder, I want product events to be recorded consistently, so that activation, return behavior, saves, and explanations can be measured without relying on anecdotes.
19. As the founder, I want internal, demo, development, and bot traffic excluded from product metrics, so that the pilot results represent real learners.
20. As the founder, I want to see where a learner drops out of the watch-to-explanation-to-resume flow, so that I can fix the highest-impact problem first.
21. As the founder, I want to identify video, device, and pipeline failures, so that critical reliability bugs can be fixed before recruiting more users.
22. As the founder, I want to see whether users return on another day and how often they use the saved-expression review, so that retention is measured as behavior rather than registration.
23. As a learner who has completed two successful sessions, I want a simple €9.99/month offer, so that I can decide whether the recurring value is worth paying for.
24. As a paying learner, I want clear confirmation that my payment succeeded, so that I know whether I can continue using the paid experience.
25. As the founder, I want payment conversion associated with the pilot cohort, so that willingness to pay can be compared with actual recurring use.
26. As a pilot participant, I want a clear seven-day mission, so that I know exactly what NativeFlow is asking me to try.
27. As the founder, I want to observe a learner using their own video, so that I can distinguish a real product problem from a polished-demo reaction.
28. As the founder, I want to interview users who do not return, so that a non-return is classified as a reliability, usability, habit, value, or pricing problem.

## Implementation Decisions

- The validation audience is self-directed B1–B2 Dutch learners who already watch Dutch YouTube at least twice per week. Complete beginners, casual browsers, and institutional buyers are not the first cohort.
- Dutch YouTube is the only validation medium. Podcasts, Netflix, other languages, and platform-general architecture remain outside this effort.
- Curated videos are the onboarding shortcut, not the primary product. NOS Jeugdjournaal is the default onboarding path; Lubach and other examples remain optional. Search and pasted URLs must remain available to test users' existing content habits.
- The highest user-facing seam is the learner validation loop: video selection and watch flow, subtitle explanation, save, saved-expression review, and return prompt. Existing watch, subtitle, explanation, and saving behavior should be extended rather than replaced.
- The return loop is deliberately small: show saved expressions in a lightweight next-session review and invite the learner to bring another video. Full spaced repetition, courses, streaks, and gamification are excluded.
- Contextual help is the default explanation shape: concise meaning, natural translation, and one useful example. Grammar depth is optional. On uncertainty or pipeline failure, NativeFlow must communicate that it cannot confidently explain rather than presenting a low-confidence answer as authoritative.
- A critical bug is any failure that prevents or materially damages the core loop: a valid target video cannot load or process, subtitles cannot be used, an explanation cannot be displayed, playback cannot resume, an expression cannot be saved or reviewed, the mobile flow is blocked, or a measurement event silently disappears. Critical bugs block pilot launch until fixed or explicitly accepted with a documented workaround.
- The measurement seam is the existing analytics boundary through the canonical metrics layer and founder dashboard. Existing canonical events and comprehension feedback should be reused. The end-to-end path must be verified in production, including traffic classification, session/visitor/user units, activation, return behavior, saved-expression review, explanation helpfulness, failures, and payment conversion.
- Analytics must distinguish product users from demo, founder, development, benchmark, automated-test, bot, and preview traffic. Small cohorts must display counts and denominators rather than implying statistical certainty.
- Explanation feedback uses the existing comprehension choices of yes, sort of, and no, plus the current-workflow comparison where available. The founder dashboard must make negative explanations and failure reasons actionable.
- The commercial seam is a minimal hosted checkout or payment-link flow for one €9.99/month offer, presented after one or two successful sessions. A refundable paid commitment is an acceptable fallback. Custom billing tiers, annual plans, institutional pricing, and a full subscription-management system are excluded.
- Payment success must be confirmed authoritatively before the product treats a learner as paid. The pilot must record completed payment, not just an opened checkout or stated willingness to pay.
- Pilot onboarding is a product-and-operations boundary: each participant receives the same seven-day mission, uses at least one personally chosen Dutch video, completes two sessions, saves at least two expressions, reviews them in the second session, and is asked whether the product is worth €9.99/month.
- The minimum decisive pilot is five observed users. A ten-user cohort is a stretch goal and must not delay the decision. Previous testers and registered users can be re-contacted, but registration alone does not count as validation.
- Deployment follows the existing Lovable/GitHub workflow: changes are developed and tested in the repository, approved changes reach the default `main` branch, Lovable syncs the branch, and the live domain is updated through an explicit publish/update step. Production release must be verified with the truth test before pilot users are invited.

## Testing Decisions

- Tests should verify externally visible behavior and user outcomes, not implementation details or component structure.
- The critical path must be covered end to end on desktop and mobile: select a video, start playback, accumulate meaningful watch time, click subtitles, view explanations, resume, save an expression, revisit saved content, and return to another video.
- The internal reliability matrix must cover at least four curated videos, three searched videos, and three pasted URLs on desktop and mobile. Each case must either complete the core loop or produce an intentional recovery state.
- Regression tests should cover subtitle synchronization, transcript loading, explanation rendering, save/revisit behavior, and any newly introduced payment-state transitions. Existing transcript, language-detection, expression-ranking, and synchronization tests are prior art for the test style.
- The explanation-quality check must manually review at least 20 explanations across different video types before pilot launch. Incorrect or misleading answers are treated as trust-critical defects.
- The production analytics truth test must reconcile the user-visible flow with the founder dashboard for video selection, start, meaningful watch, subtitle click, explanation viewed, resume, and expression saved. Any gap blocks pilot measurement until understood.
- Mobile acceptance uses a phone-sized viewport and requires the full loop to be usable without awkward navigation or hidden controls.
- Payment tests must cover successful checkout, cancelled checkout, failed payment, refresh/re-entry after payment, and the founder-side conversion signal. Test credentials and payment secrets must never be committed to the repository.
- Pilot analysis must use cohort-level counts and denominators. Survey answers, compliments, page views, registrations, and demo completions are supporting evidence only; return behavior and completed payments are the decisive signals.

## Out of Scope

- Supporting languages other than Dutch.
- Podcasts, Netflix, browser-wide overlays, or non-YouTube media.
- Building a generalized native-media platform before the Dutch YouTube wedge is validated.
- Full spaced repetition, flashcard courses, streaks, leaderboards, and gamification.
- Large-scale content licensing or a large curated library.
- Institutional, school, tutor, employer, or enterprise sales.
- Paid acquisition campaigns or broad marketing optimization.
- Major AI-pipeline redesign without a specific observed failure that blocks the core loop.
- A full billing portal, multiple pricing tiers, annual plans, refunds automation, or complex entitlement management.
- Rebuilding the existing analytics architecture or creating a second competing metrics layer.

## Further Notes

### Decision gates

- Readiness gate: the reliability matrix passes, mobile has no critical blocker, at least 20 explanations are reviewed, the return loop works, payment is testable, and production analytics pass reconciliation.
- Pilot continuation signal: 4–5 observed users return after a successful first session and explicit return mission, and at least 2 complete the €9.99 payment action.
- Pivot signal: users return but do not pay, or repeatedly identify a different high-value job such as discovery, review, or a different learner segment.
- Kill signal: reliable users complete the core experience, receive a concrete return reason, use their own content, and almost nobody returns or pays.

### Two-month operating sequence

1. Weeks 1–2: internal reliability and mobile regression gate.
2. Week 3: saved-expression review and explicit return mission.
3. Week 4: analytics reconciliation, feedback verification, and minimal payment flow.
4. Week 5: re-contact the five informed testers and observe real-video sessions.
5. Week 6: launch the five-person observed pilot.
6. Week 7: measure returns, helpfulness, failures, comprehension, and payment behavior; interview non-returners.
7. Week 8: make the continue/pivot/kill decision and document the next effort.

### Existing artifacts to preserve and consult

- `docs/analytics-phase1.md`
- `.lovable/plan/founder-dashboard-experiment-measurement-upgrade-2026-08-18.md`
- `.lovable/plan/low-friction-first-value-anonymous-retention-analytics-2026-08-11.md`
- `.lovable/plan/mobile-transcript-hierarchy-correction-2026-09-09.md`
- `.lovable/plan/smarter-useful-expression-selection-2026-08-11.md`
