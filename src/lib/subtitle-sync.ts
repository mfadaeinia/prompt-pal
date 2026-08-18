/** Subtitle ↔ audio synchronization.
 *
 *  Single source of truth for how the active subtitle is chosen from the
 *  player's playback time. Do NOT scatter timing offsets across components.
 *
 *  Why an offset exists at all:
 *   - the YouTube iframe API's `getCurrentTime()` is sampled (we poll at ~25fps)
 *     and React needs a frame to paint, so a purely reactive highlight is always
 *     a few tens of milliseconds late;
 *   - caption cue start times are approximate at the word level.
 *  A learner perceives "slightly early" as synchronized and "slightly late" as
 *  broken, so we bias marginally early. Keep this small (≤0.3s): a bigger value
 *  makes the subtitle visibly precede the speaker.
 */

/** Wall-clock look-ahead applied to playback time before picking a sentence. */
export const SUBTITLE_SYNC_OFFSET_SECONDS = 0.2;

export type TimedSentence = { id: number; offset: number };

/**
 * Active sentence for a given playback time.
 *
 * Picks the LAST sentence whose start time has been reached, which avoids
 * "no active sentence" gaps when a sentence's endTime stops short of the next
 * sentence's start. The look-ahead is converted to video time using the current
 * playback rate so the perceived earliness is identical at 0.5× and 2×.
 */
export function activeSentenceId(
  sentences: readonly TimedSentence[],
  playbackTime: number,
  playbackRate = 1,
): number | null {
  if (!sentences.length) return null;
  const rate = playbackRate > 0 ? playbackRate : 1;
  const t = playbackTime + SUBTITLE_SYNC_OFFSET_SECONDS * rate;
  let candidate: number | null = null;
  for (const s of sentences) {
    if (s.offset > t) break;
    candidate = s.id;
  }
  return candidate;
}
