import { createFileRoute } from "@tanstack/react-router";

/**
 * Progressive Whisper PoC.
 *
 * GET /api/public/asr-probe-progressive?url=<youtube_url>&seconds=90&kbps=128
 *
 * Pipeline:
 *   1. RapidAPI audio extract (same as full path).
 *   2. HTTP Range GET on the audio URL for ~seconds*kbps/8 bytes only.
 *      MP3 frames are self-synchronizing, so a byte-truncated mp3 still
 *      decodes; Whisper returns real timestamps for the portion it sees.
 *   3. POST to OpenAI Whisper with response_format=verbose_json.
 *   4. Return timing trace + first-sentence latency + transcript preview.
 *
 * REAL timestamps only — no synthesis, no proportional offsets.
 * Compare numbers against /api/public/asr-probe (full audio) to decide
 * whether to build the full progressive architecture.
 */
export const Route = createFileRoute("/api/public/asr-probe-progressive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const url = u.searchParams.get("url");
        const seconds = Math.max(15, Math.min(300, Number(u.searchParams.get("seconds") ?? 90)));
        const kbps = Math.max(32, Math.min(320, Number(u.searchParams.get("kbps") ?? 128)));
        const lang = u.searchParams.get("lang") ?? "nl";
        if (!url) {
          return new Response(JSON.stringify({ error: "missing ?url" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        const videoId = (url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1]) ?? url;
        const tStart = Date.now();
        const trace: Record<string, unknown> = {
          videoId, requested_seconds: seconds, assumed_kbps: kbps,
          env: {
            has_RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
            has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
          },
        };
        try {
          // --- Step 1: reuse extractor from the full-path module
          const { transcribeWithOpenAi: _unused } = await import("@/lib/asr-openai.server");
          void _unused; // we don't call it — we only need the extractor.
          // Inline a minimal extractor call by re-using the public probe machinery:
          // simplest is to duplicate the RapidAPI poll here to keep this PoC isolated.
          const rapidKey = process.env.RAPIDAPI_KEY;
          const openaiKey = process.env.OPENAI_API_KEY;
          if (!rapidKey) throw new Error("RAPIDAPI_KEY not set");
          if (!openaiKey) throw new Error("OPENAI_API_KEY not set");

          const host = process.env.RAPIDAPI_AUDIO_HOST || "youtube-mp36.p.rapidapi.com";
          const endpoint = `https://${host}/dl?id=${encodeURIComponent(videoId)}`;
          const tExtract = Date.now();
          let audioUrl: string | null = null;
          let polls = 0;
          const deadline = tExtract + 45_000;
          while (Date.now() < deadline) {
            polls += 1;
            const r = await fetch(endpoint, {
              headers: {
                "Content-Type": "application/json",
                "x-rapidapi-host": host,
                "x-rapidapi-key": rapidKey,
              },
            });
            const txt = await r.text().catch(() => "");
            let j: any = null; try { j = JSON.parse(txt); } catch {}
            const status = String(j?.status ?? "").toLowerCase();
            if (j?.link && status !== "processing" && status !== "fail") {
              audioUrl = String(j.link); break;
            }
            if (status === "fail") throw new Error(`extractor fail: ${j?.msg ?? ""}`);
            await new Promise((res) => setTimeout(res, 3000));
          }
          trace.extract_polls = polls;
          trace.extract_ms = Date.now() - tExtract;
          if (!audioUrl) throw new Error("extractor timeout");

          // --- Step 2: Range-limited download
          // bytes = seconds * (kbps * 1000 / 8)
          const targetBytes = Math.floor(seconds * (kbps * 1000 / 8));
          trace.target_bytes = targetBytes;
          trace.target_mb = +(targetBytes / 1024 / 1024).toFixed(2);
          const tDl = Date.now();
          const dl = await fetch(audioUrl, {
            headers: { Range: `bytes=0-${targetBytes - 1}` },
          });
          trace.download_status = dl.status;
          trace.download_content_length = dl.headers.get("content-length");
          trace.download_content_range = dl.headers.get("content-range");
          trace.download_accept_ranges_supported = dl.status === 206;
          const buf = new Uint8Array(await dl.arrayBuffer());
          trace.downloaded_bytes = buf.byteLength;
          trace.downloaded_mb = +(buf.byteLength / 1024 / 1024).toFixed(2);
          trace.download_ms = Date.now() - tDl;

          // --- Step 3: Whisper transcription on partial audio
          const tOa = Date.now();
          const form = new FormData();
          const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
          form.append("file", new Blob([ab], { type: "audio/mpeg" }), "audio.mp3");
          form.append("model", "whisper-1");
          form.append("response_format", "verbose_json");
          if (lang && lang !== "_any_") form.append("language", lang);
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 60_000);
          let res: Response;
          try {
            res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
              method: "POST",
              headers: { Authorization: `Bearer ${openaiKey}` },
              body: form,
              signal: ctrl.signal,
            });
          } finally { clearTimeout(timer); }
          trace.openai_ms = Date.now() - tOa;
          trace.openai_status = res.status;
          const body = await res.text();
          if (!res.ok) {
            trace.openai_error = body.slice(0, 500);
            trace.total_ms = Date.now() - tStart;
            return new Response(JSON.stringify({ ok: false, trace }, null, 2), {
              status: 200, headers: { "content-type": "application/json" },
            });
          }
          const json = JSON.parse(body);
          const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
          trace.segments_count = segments.length;
          trace.detected_language = json?.language ?? null;
          trace.whisper_reported_duration_s = json?.duration ?? null;

          const chunks = segments
            .map((s) => ({
              text: String(s?.text ?? "").trim(),
              start: Number(s?.start ?? 0),
              end: Number(s?.end ?? 0),
            }))
            .filter((c) => c.text.length > 0);

          trace.first_segment_start_s = chunks[0]?.start ?? null;
          trace.first_segment_end_s = chunks[0]?.end ?? null;
          trace.last_segment_end_s = chunks[chunks.length - 1]?.end ?? null;
          trace.time_to_first_clickable_sentence_ms = Date.now() - tStart;
          trace.total_ms = Date.now() - tStart;

          return new Response(JSON.stringify({
            ok: true,
            trace,
            first_8_segments: chunks.slice(0, 8),
            preview_text: chunks.slice(0, 8).map((c) => c.text).join(" "),
          }, null, 2), { headers: { "content-type": "application/json" } });
        } catch (e) {
          trace.error = e instanceof Error ? e.message : String(e);
          trace.total_ms = Date.now() - tStart;
          return new Response(JSON.stringify({ ok: false, trace }, null, 2), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
