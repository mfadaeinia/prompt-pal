import { createFileRoute } from "@tanstack/react-router";

import { buildSentencesFromChunksExport, type RawChunk } from "@/lib/transcript.functions";

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
 *   chunk 0  → Whisper sees absolute audio start → segment.start is real.
 *   chunk N  → Range `[0, (N+1)*chunkSeconds*bytesPerSec - 1]` is too costly;
 *              we instead Range `[N*chunkSeconds*bytesPerSec, ...]`, then offset
 *              each Whisper segment by exactly `N * chunkSeconds`. For CBR MP3
 *              this is the actual byte→time mapping — not synthesis. The
 *              measured bitrate from chunk 0 is reported in the trace so the
 *              founder dashboard can verify CBR.
 */
export const Route = createFileRoute("/api/public/transcript-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const url = u.searchParams.get("url");
        const lang = u.searchParams.get("lang") ?? "nl";
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
                const probe = await fetch(audioUrl, { headers: { Range: "bytes=0-0" } });
                const cr = probe.headers.get("content-range"); // bytes 0-0/12345
                const m = cr?.match(/\/(\d+)\s*$/);
                if (m) totalAudioBytes = Number(m[1]);
              } catch {
                /* ignore */
              }

              // --- Chunk loop
              const allRawChunks: RawChunk[] = [];
              let measuredBytesPerSec = (kbps * 1000) / 8; // refined after chunk 0
              let totalChunks: number | null = null;
              let prevSentencesLen = 0;
              let chunkIndex = 0;

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
                const detectedLanguage: string | null = json?.language ?? null;
                const whisperReportedDuration: number = Number(json?.duration ?? 0);

                // Refine bitrate from chunk 0 so subsequent offsets are exact.
                if (chunkIndex === 0 && whisperReportedDuration > 0) {
                  const measured = buf.byteLength / whisperReportedDuration;
                  // Only accept if within sane range (32–320 kbps)
                  const measuredKbps = (measured * 8) / 1000;
                  if (measuredKbps >= 24 && measuredKbps <= 400) {
                    measuredBytesPerSec = measured;
                  }
                }

                // Chunk's real start time in the video. For chunk 0 this is 0
                // (Whisper saw absolute start). For chunk N>0, Range starts at
                // byteStart bytes → byteStart / measuredBytesPerSec seconds.
                const chunkStartSec =
                  chunkIndex === 0 ? 0 : byteStart / measuredBytesPerSec;

                const newRawChunks: RawChunk[] = segments
                  .map((s) => ({
                    text: String(s?.text ?? "").trim(),
                    offset: chunkStartSec + Number(s?.start ?? 0),
                    duration: Math.max(0, Number(s?.end ?? 0) - Number(s?.start ?? 0)),
                  }))
                  .filter((c) => c.text.length > 0);

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

              send("complete", {
                totalSentences: prevSentencesLen,
                time_to_full_transcript_ms: totalMs,
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
