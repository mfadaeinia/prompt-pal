import { createFileRoute } from "@tanstack/react-router";

import {
  buildSentencesFromChunksExport,
  TRANSCRIPT_PIPELINE_VERSION,
  type RawChunk,
} from "@/lib/transcript.functions";

const OPENAI_AUDIO_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Progressive Whisper SSE stream.
 *
 * GET /api/public/transcript-stream?url=<youtube>&lang=nl&chunk=90&kbps=128
 *
 * Events emitted (one JSON payload per `data:` line):
 *   - job        { jobId, videoId }
 *   - extract    { extract_ms, polls }
 *   - chunk      {
 *                  index, startSec, endSec, ms,
 *                  detectedLanguage, completedChunks, totalChunks?,
 *                  sentences,                // running full list
 *                  newSentencesFrom,         // index in `sentences` where this chunk starts
 *                  time_to_first_clickable_sentence_ms? (only on first chunk)
 *                }
 *   - complete   { totalSentences, time_to_full_transcript_ms }
 *   - error      { message, stage }
 *
 * Timestamp policy:
 *   Prefer a single full-file Whisper call when the extracted audio is under
 *   the provider limit. That preserves absolute media timestamps, including
 *   initial music/silence before the first spoken phrase. Only fall back to
 *   chunked processing for larger files.
 */
export const Route = createFileRoute("/api/public/transcript-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const url = u.searchParams.get("url");
        // Default to auto-detect ("_any_"). Never bias Whisper to a concrete
        // language here — the transcript must reflect the spoken language of
        // the media, not the learner's translation/target language.
        const lang = u.searchParams.get("lang") ?? "_any_";
        const chunkSeconds = Math.max(30, Math.min(180, Number(u.searchParams.get("chunk") ?? 90)));
        const kbps = Math.max(32, Math.min(320, Number(u.searchParams.get("kbps") ?? 128)));
        if (!url) {
          return new Response("missing ?url", { status: 400 });
        }
        const videoId =
          url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1] ?? url;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (event: string, data: unknown) => {
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                /* client gone */
              }
            };
            const t0 = Date.now();
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

            try {
              const rapidKey = process.env.RAPIDAPI_KEY;
              const openaiKey = process.env.OPENAI_API_KEY;
              if (!rapidKey) throw new Error("RAPIDAPI_KEY not set");
              if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

              // --- Upsert job row
              const { data: jobRow, error: jobErr } = await supabaseAdmin
                .from("transcript_jobs")
                .upsert(
                  {
                    video_id: videoId,
                    status: "pending",
                    expected_language: lang,
                    chunk_seconds: chunkSeconds,
                    assumed_kbps: kbps,
                    chunks: [],
                    completed_chunks: 0,
                    started_at: new Date().toISOString(),
                    error: null,
                    completed_at: null,
                    time_to_first_clickable_sentence_ms: null,
                    time_to_full_transcript_ms: null,
                  },
                  { onConflict: "video_id" },
                )
                .select("id")
                .single();
              if (jobErr) throw new Error(`job upsert: ${jobErr.message}`);
              const jobId = jobRow.id as string;
              send("job", { jobId, videoId });

              // --- Extract audio URL (RapidAPI)
              const host = process.env.RAPIDAPI_AUDIO_HOST || "youtube-mp36.p.rapidapi.com";
              const endpoint = `https://${host}/dl?id=${encodeURIComponent(videoId)}`;
              const tExtract = Date.now();
              let audioUrl: string | null = null;
              let polls = 0;
              const extractDeadline = tExtract + 45_000;
              while (Date.now() < extractDeadline) {
                polls += 1;
                const r = await fetch(endpoint, {
                  headers: {
                    "x-rapidapi-host": host,
                    "x-rapidapi-key": rapidKey,
                  },
                });
                const txt = await r.text().catch(() => "");
                let j: any = null;
                try {
                  j = JSON.parse(txt);
                } catch {
                  /* ignore */
                }
                const status = String(j?.status ?? "").toLowerCase();
                if (j?.link && status !== "processing" && status !== "fail") {
                  audioUrl = String(j.link);
                  break;
                }
                if (status === "fail") throw new Error(`extractor fail: ${j?.msg ?? ""}`);
                await new Promise((res) => setTimeout(res, 3000));
              }
              if (!audioUrl) throw new Error("extractor timeout");
              const extractMs = Date.now() - tExtract;
              await supabaseAdmin
                .from("transcript_jobs")
                .update({ audio_url: audioUrl, audio_url_fetched_at: new Date().toISOString() })
                .eq("id", jobId);
              send("extract", { extract_ms: extractMs, polls });

              // --- Inspect total audio size (Content-Length via HEAD-style Range)
              let totalAudioBytes: number | null = null;
              try {
                const head = await fetch(audioUrl, { method: "HEAD" });
                const len = Number(head.headers.get("content-length") || "0");
                if (Number.isFinite(len) && len > 0) totalAudioBytes = len;
              } catch {
                /* ignore */
              }
              try {
                if (totalAudioBytes == null) {
                  const probe = await fetch(audioUrl, { headers: { Range: "bytes=0-0" } });
                  const cr = probe.headers.get("content-range"); // bytes 0-0/12345
                  const m = cr?.match(/\/(\d+)\s*$/);
                  if (m) totalAudioBytes = Number(m[1]);
                }
              } catch {
                /* ignore */
              }

              try {
              if (totalAudioBytes != null && totalAudioBytes <= OPENAI_AUDIO_LIMIT_BYTES) {
                const tFull = Date.now();
                const dl = await fetch(audioUrl);
                if (!dl.ok) throw new Error(`full audio fetch: HTTP ${dl.status}`);
                const buf = new Uint8Array(await dl.arrayBuffer());
                if (buf.byteLength > OPENAI_AUDIO_LIMIT_BYTES) {
                  console.warn("[sync-debug][server] full audio exceeded limit after download; using chunked fallback", {
                    videoId,
                    bytes: buf.byteLength,
                  });
                } else if (buf.byteLength >= 1024) {
                  const form = new FormData();
                  const ab = buf.buffer.slice(
                    buf.byteOffset,
                    buf.byteOffset + buf.byteLength,
                  ) as ArrayBuffer;
                  form.append("file", new Blob([ab], { type: "audio/mpeg" }), "audio.mp3");
                  form.append("model", "whisper-1");
                  form.append("response_format", "verbose_json");
                  form.append("timestamp_granularities[]", "word");
                  form.append("timestamp_granularities[]", "segment");
                  if (lang && lang !== "_any_") form.append("language", lang);

                  const ctrl = new AbortController();
                  const timer = setTimeout(() => ctrl.abort(), 90_000);
                  let res: Response;
                  try {
                    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${openaiKey}` },
                      body: form,
                      signal: ctrl.signal,
                    });
                  } finally {
                    clearTimeout(timer);
                  }
                  if (!res.ok) {
                    const body = await res.text().catch(() => "");
                    throw new Error(`whisper full-file: ${res.status} ${body.slice(0, 200)}`);
                  }
                  const json: any = await res.json();
                  const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
                  const words: any[] = Array.isArray(json?.words) ? json.words : [];
                  const sourceItems = words.length ? words : segments;
                  const detectedLanguage: string | null = json?.language ?? null;
                  const fullDurationSec = Number(json?.duration ?? 0);
                  const allRawChunks: RawChunk[] = sourceItems
                    .map((s) => {
                      const start = Number(s?.start ?? 0);
                      const end = Number(s?.end ?? start);
                      return {
                        text: String(s?.word ?? s?.text ?? "").trim(),
                        offset: start,
                        duration: Math.max(0, end - start),
                      };
                    })
                    .filter((c) => c.text.length > 0);
                  const firstSpeechSec = allRawChunks.length ? allRawChunks[0].offset : null;
                  console.log("[sync-debug][server] full-file timing", {
                    videoId,
                    fullDurationSec: Number(fullDurationSec.toFixed(3)),
                    firstSpeechSec: firstSpeechSec == null ? null : Number(firstSpeechSec.toFixed(3)),
                    segmentsCount: segments.length,
                    wordsCount: words.length,
                    note: "full-file ASR preserves initial music/silence before first speech",
                  });

                  const sentences = buildSentencesFromChunksExport(allRawChunks);
                  const totalMs = Date.now() - t0;
                  const firstSentenceMs = Date.now() - t0;
                  await supabaseAdmin
                    .from("transcript_jobs")
                    .update({
                      status: "complete",
                      detected_language: detectedLanguage,
                      completed_chunks: 1,
                      total_chunks: 1,
                      chunks: allRawChunks,
                      whisper_reported_duration_s: fullDurationSec || null,
                      first_chunk_at: new Date().toISOString(),
                      completed_at: new Date().toISOString(),
                      time_to_first_clickable_sentence_ms: firstSentenceMs,
                      time_to_full_transcript_ms: totalMs,
                    })
                    .eq("id", jobId);

                  send("chunk", {
                    index: 0,
                    startSec: 0,
                    endSec: fullDurationSec || (allRawChunks[allRawChunks.length - 1]?.offset ?? 0),
                    ms: Date.now() - tFull,
                    detectedLanguage,
                    completedChunks: 1,
                    totalChunks: 1,
                    sentences,
                    newSentencesFrom: 0,
                    time_to_first_clickable_sentence_ms: firstSentenceMs,
                  });

                  try {
                    const requestedLanguage = lang && lang !== "_any_" ? lang : "_any_";
                    const provider = "openai";
                    const sourceVersion = TRANSCRIPT_PIPELINE_VERSION;
                    const totalChars = allRawChunks.reduce((n, c) => n + (c.text?.length ?? 0), 0);
                    const cacheKey = `${videoId}::${requestedLanguage}::${provider}::v${sourceVersion}`;
                    await supabaseAdmin
                      .from("youtube_transcript_cache" as any)
                      .upsert(
                        {
                          video_id: videoId,
                          video_url: url,
                          transcript_json: allRawChunks,
                          language: detectedLanguage,
                          source: provider,
                          provider,
                          requested_language: requestedLanguage,
                          provider_response_language: detectedLanguage,
                          source_version: sourceVersion,
                          cache_key: cacheKey,
                          transcript_length_chars: totalChars,
                          updated_at: new Date().toISOString(),
                        },
                        { onConflict: "video_id,requested_language,provider,source_version" },
                      );
                  } catch (cacheErr) {
                    console.warn("[transcript-stream] cache write failed", cacheErr);
                  }
                  send("complete", {
                    totalSentences: sentences.length,
                    time_to_full_transcript_ms: totalMs,
                    detectedLanguage,
                  });
                  controller.close();
                  return;
                }
              }
              } catch (fullFileErr) {
                console.warn("[sync-debug][server] full-file ASR failed; using chunked fallback", {
                  videoId,
                  error: fullFileErr instanceof Error ? fullFileErr.message : String(fullFileErr),
                });
              }

              // --- Chunk loop
              const allRawChunks: RawChunk[] = [];
              let measuredBytesPerSec = (kbps * 1000) / 8; // refined after chunk 0
              let totalChunks: number | null = null;
              let prevSentencesLen = 0;
              let chunkIndex = 0;
              let lastDetectedLanguage: string | null = null;
              // Cumulative true-decoded duration of all PRIOR chunks. This is
              // the absolute file-time at which the next chunk's audio begins.
              // Using the sum of Whisper-reported durations (instead of
              // byte/bitrate math) eliminates drift caused by VBR encoding,
              // ID3/Xing padding, and MPEG frame alignment.
              let cumulativePriorDurationSec = 0;

              while (true) {
                const tChunk = Date.now();
                const targetBytes = Math.floor(chunkSeconds * measuredBytesPerSec);
                const byteStart = chunkIndex === 0
                  ? 0
                  : Math.floor(chunkIndex * chunkSeconds * measuredBytesPerSec);
                const byteEnd = byteStart + targetBytes - 1;

                if (totalAudioBytes != null && byteStart >= totalAudioBytes) break;

                const dl = await fetch(audioUrl, {
                  headers: { Range: `bytes=${byteStart}-${byteEnd}` },
                });
                if (dl.status !== 200 && dl.status !== 206) {
                  throw new Error(`range fetch chunk ${chunkIndex}: HTTP ${dl.status}`);
                }
                const buf = new Uint8Array(await dl.arrayBuffer());
                if (buf.byteLength < 1024) break; // tail, nothing useful

                // Whisper call
                const form = new FormData();
                const ab = buf.buffer.slice(
                  buf.byteOffset,
                  buf.byteOffset + buf.byteLength,
                ) as ArrayBuffer;
                form.append("file", new Blob([ab], { type: "audio/mpeg" }), "audio.mp3");
                form.append("model", "whisper-1");
                form.append("response_format", "verbose_json");
                form.append("timestamp_granularities[]", "word");
                form.append("timestamp_granularities[]", "segment");
                if (lang && lang !== "_any_") form.append("language", lang);

                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 90_000);
                let res: Response;
                try {
                  res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${openaiKey}` },
                    body: form,
                    signal: ctrl.signal,
                  });
                } finally {
                  clearTimeout(timer);
                }
                if (!res.ok) {
                  const body = await res.text().catch(() => "");
                  throw new Error(`whisper chunk ${chunkIndex}: ${res.status} ${body.slice(0, 200)}`);
                }
                const json: any = await res.json();
                const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
                const words: any[] = Array.isArray(json?.words) ? json.words : [];
                const detectedLanguage: string | null = json?.language ?? null;
                if (detectedLanguage) lastDetectedLanguage = detectedLanguage;
                const whisperReportedDuration: number = Number(json?.duration ?? 0);

                // Refine bitrate from chunk 0 so subsequent BYTE offsets are
                // close to the intended chunk size (not used for time mapping).
                if (chunkIndex === 0 && whisperReportedDuration > 0) {
                  const measured = buf.byteLength / whisperReportedDuration;
                  const measuredKbps = (measured * 8) / 1000;
                  if (measuredKbps >= 24 && measuredKbps <= 400) {
                    measuredBytesPerSec = measured;
                  }
                }

                // Absolute start of this chunk in the full video timeline.
                // Chunks are CONTIGUOUS byte ranges, so the true file-time
                // where chunk N begins equals the sum of decoded durations of
                // chunks 0..N-1. This is exact regardless of CBR/VBR.
                const chunkStartSec = cumulativePriorDurationSec;

                const sourceItems = words.length ? words : segments;
                const newRawChunks: RawChunk[] = sourceItems
                  .map((s) => {
                    const start = Number(s?.start ?? 0);
                    const end = Number(s?.end ?? start);
                    return {
                      text: String(s?.word ?? s?.text ?? "").trim(),
                      offset: chunkStartSec + start,
                      duration: Math.max(0, end - start),
                    };
                  })
                  .filter((c) => c.text.length > 0);

                // Diagnostic: compare the OLD (bytes/bps) estimate vs the new
                // cumulative-duration value so drift sources are visible.
                const byteEstimateSec =
                  chunkIndex === 0 ? 0 : byteStart / measuredBytesPerSec;
                console.log("[sync-debug][server] chunk timing", {
                  videoId,
                  chunkIndex,
                  chunkStartSec: Number(chunkStartSec.toFixed(3)),
                  byteEstimateSec: Number(byteEstimateSec.toFixed(3)),
                  driftVsByteEstimateSec: Number(
                    (chunkStartSec - byteEstimateSec).toFixed(3),
                  ),
                  whisperReportedDuration,
                  segmentsCount: segments.length,
                  wordsCount: words.length,
                });

                // Advance the cumulative clock for the NEXT chunk.
                cumulativePriorDurationSec += whisperReportedDuration || chunkSeconds;

                allRawChunks.push(...newRawChunks);
                const sentences = buildSentencesFromChunksExport(allRawChunks);
                const newSentencesFrom = prevSentencesLen;
                prevSentencesLen = sentences.length;

                const chunkMs = Date.now() - tChunk;
                const completedChunks = chunkIndex + 1;

                // Total chunks estimate: total bytes / chunk bytes.
                if (totalAudioBytes != null) {
                  totalChunks = Math.max(
                    completedChunks,
                    Math.ceil(totalAudioBytes / targetBytes),
                  );
                }

                const isFirst = chunkIndex === 0;
                const firstSentenceMs = isFirst ? Date.now() - t0 : undefined;

                // Persist chunk progress.
                const dbChunks = allRawChunks.length;
                void dbChunks;
                await supabaseAdmin
                  .from("transcript_jobs")
                  .update({
                    status: "partial",
                    detected_language: detectedLanguage,
                    completed_chunks: completedChunks,
                    total_chunks: totalChunks,
                    chunks: allRawChunks,
                    whisper_reported_duration_s: whisperReportedDuration || null,
                    first_chunk_at: isFirst ? new Date().toISOString() : undefined,
                    time_to_first_clickable_sentence_ms: isFirst ? firstSentenceMs : undefined,
                  })
                  .eq("id", jobId);

                send("chunk", {
                  index: chunkIndex,
                  startSec: chunkStartSec,
                  endSec: chunkStartSec + (whisperReportedDuration || chunkSeconds),
                  ms: chunkMs,
                  detectedLanguage,
                  completedChunks,
                  totalChunks,
                  sentences,
                  newSentencesFrom,
                  measuredBytesPerSec,
                  ...(isFirst ? { time_to_first_clickable_sentence_ms: firstSentenceMs } : {}),
                });

                // Termination: total bytes consumed, OR Whisper saw less than
                // requested duration (means we hit EOF within this chunk).
                const consumedEnd = byteStart + buf.byteLength;
                if (totalAudioBytes != null && consumedEnd >= totalAudioBytes) break;
                if (whisperReportedDuration > 0 && whisperReportedDuration < chunkSeconds * 0.5) break;
                chunkIndex += 1;
                if (chunkIndex > 60) break; // safety
              }

              const totalMs = Date.now() - t0;
              await supabaseAdmin
                .from("transcript_jobs")
                .update({
                  status: "complete",
                  completed_at: new Date().toISOString(),
                  time_to_full_transcript_ms: totalMs,
                })
                .eq("id", jobId);

              // Write to youtube_transcript_cache so subsequent loads hit
              // the fast path instead of re-running progressive Whisper.
              try {
                const requestedLanguage = lang && lang !== "_any_" ? lang : "_any_";
                const provider = "openai";
                const sourceVersion = TRANSCRIPT_PIPELINE_VERSION;
                const totalChars = allRawChunks.reduce(
                  (n, c) => n + (c.text?.length ?? 0),
                  0,
                );
                const cacheKey = `${videoId}::${requestedLanguage}::${provider}::v${sourceVersion}`;

                // Safety guard: compare summed Whisper-decoded durations vs
                // the media duration we can estimate from totalAudioBytes /
                // measured bitrate. If they diverge by more than ~2%, future
                // playback may drift — log loudly so we catch regressions.
                if (totalAudioBytes != null && measuredBytesPerSec > 0) {
                  const estimatedMediaSec = totalAudioBytes / measuredBytesPerSec;
                  const decodedSec = cumulativePriorDurationSec;
                  const driftSec = decodedSec - estimatedMediaSec;
                  const driftPct = estimatedMediaSec > 0
                    ? Math.abs(driftSec) / estimatedMediaSec
                    : 0;
                  const payload = {
                    videoId,
                    estimatedMediaSec: Number(estimatedMediaSec.toFixed(2)),
                    decodedSec: Number(decodedSec.toFixed(2)),
                    driftSec: Number(driftSec.toFixed(2)),
                    driftPct: Number((driftPct * 100).toFixed(2)),
                  };
                  if (driftPct > 0.02) {
                    console.warn("[sync-debug][server] DRIFT WARNING (>2%)", payload);
                  } else {
                    console.log("[sync-debug][server] drift OK", payload);
                  }
                }
                await supabaseAdmin
                  .from("youtube_transcript_cache" as any)
                  .upsert(
                    {
                      video_id: videoId,
                      video_url: url,
                      transcript_json: allRawChunks,
                      language: lastDetectedLanguage,
                      source: provider,
                      provider,
                      requested_language: requestedLanguage,
                      provider_response_language: lastDetectedLanguage,
                      source_version: sourceVersion,
                      cache_key: cacheKey,
                      transcript_length_chars: totalChars,
                      updated_at: new Date().toISOString(),
                    },
                    { onConflict: "video_id,requested_language,provider,source_version" },
                  );
              } catch (cacheErr) {
                console.warn("[transcript-stream] cache write failed", cacheErr);
              }

              send("complete", {
                totalSentences: prevSentencesLen,
                time_to_full_transcript_ms: totalMs,
                detectedLanguage: lastDetectedLanguage,
              });
              controller.close();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              try {
                await supabaseAdmin
                  .from("transcript_jobs")
                  .update({ status: "failed", error: msg })
                  .eq("video_id", videoId);
              } catch {
                /* ignore */
              }
              send("error", { message: msg, stage: "stream" });
              try {
                controller.close();
              } catch {
                /* ignore */
              }
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            "x-accel-buffering": "no",
            connection: "keep-alive",
          },
        });
      },
    },
  },
});
