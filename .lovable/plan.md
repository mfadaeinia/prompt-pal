## Phase 2 Plan — Clario Validation Improvements

The request is broad (8 sections touching UX, server-side transcript pipeline, analytics, and a new secret). Below is what I'll ship, grouped so we can validate as we go.

### 1. Demo-first landing UX (`src/routes/index.tsx`)
- Primary CTA: **"Try the Dutch Demo"** with subtitle "See how Clario works in under 30 seconds."
- Move the custom YouTube input below the demo, in its own card:
  - Heading: "Try your own YouTube video"
  - Subtitle: "Beta feature — works best on videos with captions."
  - URL input + language selector + "Load Video" button (unchanged behavior).
- Add a compact onboarding strip near the transcript: **Watch → Click a sentence → Understand instantly** (3 steps, always visible during demo).

### 2. Transcript reliability — Layer 3 fallback provider
- New secret: `TRANSCRIBR_API_KEY` (will request via add_secret).
- Update `src/lib/transcript.functions.ts` fetch flow:
  1. **Cache hit** → `source: "cache"` (already implemented).
  2. **YouTube captions** via `youtube-transcript` → `source: "youtube"` (already implemented).
  3. **NEW: Fallback provider (Transcribr)** → `source: "fallback"`. Normalizes to the same `RawChunk[]` shape and writes to cache so future loads are instant.
- All three paths upsert into `youtube_transcript_cache`.
- Emit a single `transcript_fetch` log per attempt with the layer that succeeded.

### 3. User-friendly errors
- If all 3 layers fail, return a single friendly message: "We couldn't automatically load subtitles for this video right now."
- UI shows 3 actions: **Try another video** / **Try the Dutch Demo** / **Paste transcript manually**.
- Never surface provider names, status codes, CAPTCHA / rate-limit text, or stack traces.

### 4. Explanation panel — auto-follow + visual upgrade
- Panel automatically tracks the current playing sentence (we already have `currentTime` from the YT IFrame API; pick the sentence whose `[offset, endTime]` window contains it).
- Clicking still seeks + manually selects (overrides auto-follow until video plays again).
- Larger panel with clear section labels: **Translation**, **Meaning**, **Expression Notes**, improved hierarchy/spacing/typography.

### 5. Analytics validation
Verify and (where missing) wire these events:
- `page_view`, `demo_started`, `custom_video_attempted`, `custom_video_loaded`, `custom_video_failed`
- `transcript_sentence_clicked`
- `transcript_loaded_from_cache`, `transcript_loaded_from_youtube`, `transcript_loaded_from_fallback_provider`
- `cache_hit`, `cache_miss`
- `feedback_submitted`, `waitlist_joined`

### Out of scope (per your validation philosophy)
Monetization, gamification, flashcards, streaks, premium plans.

---

### Two things I need to confirm before I start

**A. Fallback provider:** You mentioned `TRANSCRIBR_API_KEY` — is the provider [Transcribr.ai](https://www.transcribr.ai/) (or another service)? The API endpoint/shape determines the integration. If you confirm Transcribr, I'll wire the standard `POST /transcripts` flow with `videoUrl` and poll/await the result. If it's a different service, paste the docs URL.

**B. Order of execution:** This is ~4–6 hours of focused work. I propose shipping in this order so you can validate each layer:
  1. UX restructure + onboarding strip + auto-following explanation panel (no backend changes)
  2. Friendly error UI
  3. Fallback transcript provider + caching (requires `TRANSCRIBR_API_KEY` secret)
  4. Analytics audit pass

Want me to start with (1) + (2) now while you confirm the provider for (3)?