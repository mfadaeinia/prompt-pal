# Goal

Make NativeFlow feel responsive: video + first sentences ready in seconds, even when the full transcript takes 10–20s. Learning Mode unlocks on first usable batch, not on completion.

## Current behavior (problem)

`fetchTranscript` is one server function that runs sequentially: `cache → captions → Transcribr → OpenAI Whisper → segmentation → return`. The UI awaits the whole thing before rendering anything. Cached and captioned videos pay the same "feels slow" tax as ASR videos because there is no visible staging and no progressive render.

## What we'll change

### 1. Split server-side into two functions

**`fetchTranscriptFast`** (new, `src/lib/transcript.functions.ts`):
- Tries only the cheap layers: cache → YouTube captions.
- Returns `{ status: "ready" | "miss", sentences, source, provenance, rawChunks, timings }` in well under a second when hit; ~1–3s on captions.
- Never invokes Transcribr or OpenAI.

**`fetchTranscriptSlow`** (renamed / refactored from current `fetchTranscript`):
- Runs only the ASR fallbacks (Transcribr → OpenAI Whisper) + cache write.
- Returns the same `FetchTranscriptResult` shape on success.
- Called by the client only after `fetchTranscriptFast` returns `status: "miss"`.

This keeps the public contract simple, avoids streaming complexity (TanStack server fns return JSON), and matches the user's "fast path / fallback" mental model.

### 2. Client-side status state machine (`src/routes/index.tsx`)

Replace the binary "loading / done" with:

```text
transcript_status:
  idle
  → loading_video         (oEmbed validate)
  → checking_cache
  → looking_for_captions
  → generating_transcript (ASR fallback running)
  → building_sentences    (partial sentences rendered)
  → ready | partial | failed
available_sentence_count: number
```

Header label, the existing "TRANSCRIPT · X sentences" strip, and a new inline status pill all read from this single state.

### 3. Partial readiness gate

Today: Learning Mode unlocks at `sentences.length >= 5`.
New: unlock as soon as **either** condition is true:
- `sentences.length >= 10`, OR
- transcript covers the first `>= 60` seconds (`sentences.at(-1).endTime >= 60`).

While `status === "partial"`, transcript panel + sentence clicks are enabled for available sentences; a footer line shows "processing rest…".

Note: with the two-function split, the "partial" state today fires once on the single response. Genuine streaming partials would need either SSE or chunked polling. For MVP this plan delivers staged status + fast-path render; true mid-ASR partials are deferred (called out at the bottom).

### 4. Don't block video playback

The YouTube iframe already mounts as soon as `videoId` is set. We'll add an info banner when `status` is not `ready` and not `failed`:

> "Transcript is being prepared. You can watch now — Learning Mode will unlock shortly."

Learning Mode button stays disabled until `available_sentence_count > 0`.

### 5. 15-second + final timeout messaging

Two client-side timers from the moment the slow-path call starts:
- 15s: swap banner text to "Still generating transcript. This can take longer for videos without captions."
- 45s (configurable): if still no sentences, surface the existing failure card with the recorded `failureReason`.

### 6. Performance instrumentation

Track on the client and push into the existing founder DevAnalyticsPanel / Inspect JSON:

- `time_to_video_ready` (oEmbed validated / iframe mounted)
- `time_to_first_sentence`
- `time_to_full_transcript`
- `provider_used` (cache | youtube | transcribr | openai_whisper)
- `cache_hit` (bool)

Also emit them via existing `track(...)` analytics events: `transcript_first_sentence` and `transcript_complete`.

### 7. Founder diagnostics

Surface the new timings + `transcript_status` in the existing dev strip and Inspect JSON. No new founder route needed.

## Files touched

- `src/lib/transcript.functions.ts` — add `fetchTranscriptFast`; keep existing `fetchTranscript` as the slow path (no rename, to avoid churn elsewhere).
- `src/routes/index.tsx` — new state machine, two-step load (`loadFast` mutation then conditional `loadSlow` mutation), banner, partial gate, timers, instrumentation.
- `src/components/DevAnalyticsPanel.tsx` — show new timing fields (additive).

No DB / migration changes. No new dependencies.

## Out of scope (explicit)

- True mid-ASR streaming (requires SSE or chunked-transfer server route, not a server function). The plan delivers the perceived-speed wins of progressive UX; we can add real streaming later behind the same client state machine.
- Background translation pre-generation — explanations remain on-demand per sentence click.

## Acceptance

- Cache hit: first sentence visible < 1s after submit.
- YouTube captions hit: first sentence visible < 3s.
- ASR path: video playable immediately, banner shown, Learning Mode unlocks once sentences arrive (typically 8–20s).
- Founder diagnostics show all four timing fields + provider + cache_hit.
- No regression to the existing failure card / `hasUsableTranscript` gate.
