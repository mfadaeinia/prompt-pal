import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY one-off probe to validate the OpenAI ASR path end-to-end.
 * GET /api/public/asr-probe?url=<youtube_url>
 * Returns the OpenAiAsrTrace JSON (incl. RapidAPI fields) + a transcript preview.
 * Remove after benchmark validation.
 */
export const Route = createFileRoute("/api/public/asr-probe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url).searchParams.get("url");
        if (!url) {
          return new Response(JSON.stringify({ error: "missing ?url" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        try {
          const { transcribeWithOpenAi } = await import("@/lib/asr-openai.server");
          const videoId = (url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1]) ?? url;
          const result = await transcribeWithOpenAi({ videoId, expectedLanguage: "nl" });
          const preview = (result.result?.chunks ?? []).slice(0, 8).map((c) => c.text).join(" ");
          return new Response(
            JSON.stringify({
              videoId,
              env: {
                ASR_PROVIDER: process.env.ASR_PROVIDER ?? null,
                has_RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
                has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
              },
              trace: result.trace,
              chunkCount: result.result?.chunks.length ?? 0,
              preview,
            }, null, 2),
            { headers: { "content-type": "application/json" } },
          );

        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : null }, null, 2),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
