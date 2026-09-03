# NativeFlow Analytics — Phase 1 (measurement foundation)

## 1. Canonical traffic classification

`src/lib/traffic-class.ts`. Every analytics row gets a `traffic_class` in
`library_events.metadata`.

| Class | Rule |
| --- | --- |
| `bot` | bot/crawler/headless User-Agent (server-authoritative) |
| `automated_test` | `navigator.webdriver`, Playwright/Puppeteer globals, `?e2e=1`, test flag |
| `development` | hostname is localhost / `id-preview--*` / `*-dev.lovable.app` / lovableproject.com |
| `benchmark` | `/benchmark*` path or benchmark flag |
| `founder_admin` | `/founder*`, `nativeflow_internal`, `nativeflow_debug`, founder auth, `?debug=1` |
| `demo` | landing-page demo / `?embed=1` / demo video playback |
| `production_user` | everything else |

Precedence is first match top-down. The **request host** is re-derived
server-side in `logLibraryEvent`, so a tampered client flag cannot promote
preview/local traffic into `production_user`; bots are also forced server-side.

Founder Dashboard product metrics default to `traffic = production_only`.

**Historical rows** (written before `TRAFFIC_CLASS_TRACKING_START_ISO`) carry no
`traffic_class`. Nothing is deleted or rewritten. Under `production_only` they
are admitted only if the legacy internal heuristic says they are not internal,
and they are reported separately as `trafficBreakdown.unclassified`.

## 2. Canonical identity units

- **VISITOR** = distinct `anonymous_id` (persistent per browser/device)
- **SESSION** = distinct `session_id` (30-min inactivity rollover)
- **USER** = authenticated `user_id`

Session counts are never labelled Visitors. Units are never mixed without a
documented conversion (`CoreMetrics.denominators`).

## 3. Canonical events

| Canonical | Meaning | Legacy equivalent |
| --- | --- | --- |
| `video_selected` | learner chose a video (any entry path) | — |
| `video_started` | playback began | — |
| `meaningful_watch_30s` | 30s of *accumulated real playback* | `video_watched_30s` |
| `sentence_clicked` | subtitle overlay OR transcript row clicked | — |
| `explanation_viewed` | explanation actually rendered | `subtitle_explanation_requested` |
| `video_resumed_after_explanation` | resumed after an explanation pause | — |
| `expression_saved` | expression saved to library | — |

Core Metrics resolves each canonical step as `canonical ∪ legacy` so history
remains comparable.

## 4. Meaningful 30s watching

`src/lib/watch-time.ts`. The player is sampled ~25fps; a delta only counts when
the player reports PLAYING, and deltas > 1.5s (seeks, tab wake-ups, buffering)
are discarded. Pausing stops accumulation. `meaningful_watch_30s` fires once per
(session, video).

## 5. Funnel mathematics

All conversions use true set intersection — `Math.min()` clamping is removed
from both Core Metrics and the legacy funnel. Documented denominators live in
`CoreMetrics.denominators`; every step's denominator is "sessions with
`video_started`" (SESSION) unless stated otherwise.

## 6. One canonical layer

`src/lib/core-metrics.functions.ts` is canonical.
`src/lib/founder-metrics.functions.ts` is marked **deprecated** and kept for
historical comparison only; no new product metrics go there.

## 7. Diagnostics

Founder Dashboard → **Diagnostics** tab
(`src/components/founder/AnalyticsDiagnosticsPanel.tsx`) shows session /
anonymous / user ID, `traffic_class`, environment, hostname, demo + internal
status, accumulated watch time per video and the last 10 canonical events.

## 8. Truth test (acceptance test)

Fresh production browser (`https://nativeflow.life`, no internal/debug flags):

1. Visit NativeFlow
2. Select one video
3. Start playback
4. Accumulate 35s of real playback (no seeking)
5. Click exactly 2 subtitles
6. View exactly 2 explanations
7. Resume exactly twice
8. Save exactly 1 expression

Expected canonical deltas (`traffic_class = production_user`):

| Counter | Unit | Expected |
| --- | --- | --- |
| Visitors | VISITOR | +1 |
| Sessions | SESSION | +1 |
| `video_selected` | SESSION | +1 |
| `video_started` | SESSION | +1 |
| `meaningful_watch_30s` | SESSION | +1 |
| `sentence_clicked` | EVENT | +2 |
| `explanation_viewed` | EVENT | +2 |
| `video_resumed_after_explanation` | EVENT | +2 |
| `expression_saved` | EVENT | +1 |

Reconcile via the Diagnostics tab (client ring buffer) against the Core Metrics
tab for the same day.
