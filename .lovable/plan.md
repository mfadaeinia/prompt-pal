# OpenAI Whisper as Transcribr replacement — pre-implementation plan

## 1. Proposed pipeline (replaces current step 4)

```
fetchTranscript(videoId, lang)
  1. cache lookup        (youtube_transcript_cache, unchanged)
  2. YouTube captions    (youtube-transcript lib, unchanged)
  3. AUDIO EXTRACTION    (NEW — external service returns audio URL or bytes)
  4. OPENAI TRANSCRIPTION (POST /v1/audio/transcriptions, whisper-1 or gpt-4o-transcribe)
  5. sentence building   (existing chunk→sentence merger, unchanged)
  6. cache write         (provider = "openai", model + version in cache_key)
  7. benchmark trace     (generic asr_* fields, see §6)
```

Step 3 is the only architectural change. Steps 1, 2, 5, 6, 7 are existing code paths with new field names.

## 2. Audio-extraction service comparison

OpenAI cannot ingest a YouTube URL. Something between YouTube and OpenAI must return audio. Three realistic options:

| Option | Endpoint | Pricing | Works on CF Worker? | Extra key? | Reliability |
|---|---|---|---|---|---|
| **A. RapidAPI "youtube-mp36" / "ytstream"** | `GET https://youtube-mp36.p.rapidapi.com/dl?id=<videoId>` → returns `{ link: <mp3-url>, duration }` | ~$0.001–0.005 / call on free→basic tiers; free tier ~500/mo | Yes — pure HTTPS fetch | Yes (`RAPIDAPI_KEY`) | Medium. These wrap yt-dlp on their own infra; occasional 429 / "still processing" responses; mp3 URLs are temporary (minutes) |
| **B. Cobalt API** (self-hosted or public `co.wuk.sh`) | `POST https://api.cobalt.tools/api/json` body `{ url, isAudioOnly: true }` → `{ url: <stream> }` | Free public; self-host $5/mo VPS | Yes — pure HTTPS | No (public) / No (self) | Public instance rate-limits hard, gets blocked by YT periodically. Self-host = real ops cost |
| **C. Supadata / Vexa / Kome** ("YouTube transcript API" SaaS) | These actually return *transcripts*, not audio | $5–20/mo flat | Yes | Yes | Same category as Transcribr — would replace OpenAI, not feed it. Listed here so we don't accidentally re-buy Transcribr under another name |

Recommendation: **Option A (RapidAPI ytstream/youtube-mp36)** for the first version. One key, one fetch, no infra. Accept that ~5% of calls will need a retry.

Option B is the right long-term answer if we self-host, but that is a separate infra decision, not a 50-LOC swap.

## 3. Request/response flow (Option A)

```
NativeLens worker
  │
  ├─ 1. POST RapidAPI: GET ytstream/dl?id=VIDEO_ID
  │      headers: X-RapidAPI-Key, X-RapidAPI-Host
  │      ← { status: "ok", link: "https://.../audio.mp3", duration: 612 }
  │
  ├─ 2. fetch(link) → ArrayBuffer (≤ 25 MB OpenAI limit; reject if larger)
  │
  ├─ 3. POST https://api.openai.com/v1/audio/transcriptions
  │      multipart/form-data:
  │        file:  audio.mp3
  │        model: "whisper-1"
  │        response_format: "verbose_json"   ← gives segments[{start,end,text}]
  │        language: "nl" | "en" (optional)
  │      ← { text, language, duration, segments: [...] }
  │
  ├─ 4. map segments → TranscriptChunk[] { text, offset_ms, duration_ms }
  │
  └─ 5. write cache row, return chunks
```

25 MB ≈ 25 min of 128 kbps mp3 / ~50 min of 64 kbps. Most learning videos fit. Long videos need either lower-bitrate selection from the audio service or a chunked upload — out of scope for v1; fail loudly with `audio_too_large`.

## 4. Failure handling (maps to existing failure_code enum)

| Stage | Condition | failure_code | Cache? |
|---|---|---|---|
| Audio service | non-200 | `audio_extract_http_<status>` | no |
| Audio service | returns no link / `"processing"` after retry | `audio_extract_empty` | no |
| Audio download | >25 MB | `audio_too_large` | no |
| Audio download | timeout > 30 s | `audio_download_timeout` | no |
| OpenAI | 401 | `openai_unauthorized` | no |
| OpenAI | 402 / quota | `openai_insufficient_credits` | no |
| OpenAI | 429 | `openai_rate_limit` | no |
| OpenAI | 5xx | `openai_provider_error` | no |
| OpenAI | empty `text` / 0 segments | `openai_empty_transcript` | no |
| OpenAI | `language` ≠ expectedLanguage (when set) | `openai_wrong_language` | no (suspicious) |
| Any | total elapsed > 90 s | `asr_timeout` | no |

Insight rule (mirrors existing Transcribr 402 rule): if >50% of ASR failures in last run are `openai_insufficient_credits`, surface "Most transcript failures are caused by OpenAI insufficient credits."

## 5. Cache behavior

- `provider` column: `"openai"` (keep `"fallback"` for legacy Transcribr rows; do not rewrite history).
- `cache_key` format: `${videoId}:${language ?? "auto"}:openai:whisper-1:v1`
  - Bumping `v1` → `v2` invalidates cache when we change segment merging logic.
- Write only on success AND `segments.length > 0` AND (no expectedLanguage OR language matches).
- Never cache: any failure_code row, `openai_wrong_language`, `openai_empty_transcript`.

## 6. Trace + dashboard rename (generic, provider-agnostic)

Rename step 4 in `transcript-trace.functions.ts` and `benchmark_video_results`:

| Old (Transcribr) | New (generic ASR) |
|---|---|
| `transcribr_invoked` | `asr_invoked` |
| `transcribr_http_status` | `asr_http_status` |
| `transcribr_error_body` | `asr_error_body` |
| `transcribr_segment_count` | `asr_segments_count` |
| `transcribr_latency_ms` | `asr_duration_ms` |
| — | `asr_provider` (`"openai"` \| `"transcribr"` \| `null`) |
| — | `asr_model` (`"whisper-1"`, etc.) |
| — | `asr_language` (provider-reported) |

Migration: ADD new columns, backfill `asr_provider='transcribr'` + copy values from `transcribr_*` for existing rows, keep old columns for one release, drop later. No breaking change to the founder dashboard in the same PR.

Trace step4 label becomes "ASR (OpenAI Whisper)" with the same shape as today's `step4_transcribr`, plus `provider` and `model` fields.

## 7. Cost estimate (37-video benchmark run)

Assumptions: avg video 8 min, avg audio 7 min after silence trim.

- OpenAI `whisper-1`: $0.006 / minute → 37 × 7 × $0.006 = **$1.55 / run**
- OpenAI `gpt-4o-transcribe`: $0.006 / minute (same headline) → **$1.55 / run**
- RapidAPI ytstream basic tier: ~$0.002 / call → 37 × $0.002 = **$0.07 / run**
- **Total per benchmark run: ~$1.62**
- Plus egress for downloading ~37 × ~7 MB ≈ 260 MB through the Worker — within free tier on Cloudflare.

For comparison, current Transcribr cost is whatever a credit pack costs; if a Transcribr credit ≈ $0.02–0.05 / video, 37 videos ≈ **$0.75–1.85 / run** — same ballpark.

## 8. Should we do this now, or buy Transcribr credits?

**Buy Transcribr credits short-term, ship OpenAI in the background.**

Reasoning:
- Today's failure mode is `402 insufficient credits`, not a Transcribr defect. The pipeline works; the wallet is empty. ~$10–20 of credits unblocks benchmarking immediately, zero code risk.
- OpenAI swap adds a *new* external dependency (RapidAPI or Cobalt) whose reliability we have not measured. We'd be trading a known 402 for an unknown 5xx.
- The 25 MB / ~25 min ceiling is a real product constraint. Until we decide what to do with longer videos, OpenAI is not a strict upgrade.
- The right sequence: (a) top up Transcribr to unblock, (b) ship OpenAI behind a feature flag `ASR_PROVIDER=openai|transcribr`, (c) run both on the next benchmark, (d) compare accuracy + cost + failure rate, (e) pick a winner.

## 9. Open questions before I implement

1. RapidAPI account — do you already have one, or do you want me to recommend a specific provider (`ytstream`, `youtube-mp36`, `youtube-media-downloader`)?
2. Hard cap on video length for the OpenAI path? (Proposed: skip + `audio_too_large` for >25 min.)
3. Feature flag now (`ASR_PROVIDER` env), or hard-cut Transcribr → OpenAI?
4. Whisper-1 vs gpt-4o-transcribe — same price; gpt-4o is newer but no `verbose_json` segments yet (would force us to re-segment from word timestamps).

## Technical notes

- New secrets needed: `RAPIDAPI_KEY` (build), `OPENAI_API_KEY` (already added).
- New file: `src/lib/asr-openai.server.ts` (audio fetch + OpenAI call, ~80 LOC).
- Edits: `transcript.functions.ts` step 4 (~20 LOC), `transcript-trace.functions.ts` step 4 (~30 LOC), one migration for `asr_*` columns.
- Total: ~150 LOC + 1 migration, not the original 50-LOC estimate — the extra cost is honest failure handling and the rename.
