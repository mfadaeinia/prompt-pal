/** Transcript readiness: any non-empty transcript is usable. Only an empty
 *  transcript (after all retries) is a failure — never a sentence-count gate. */
export type TranscriptReadiness = "failed" | "partial" | "ready";

export function transcriptReadiness(
  sentenceCount: number,
  streaming: boolean,
): TranscriptReadiness {
  if (!sentenceCount || sentenceCount <= 0) return "failed";
  return streaming ? "partial" : "ready";
}
