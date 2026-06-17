import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY probe: invoke the SAME fetchTranscript server function the product UI uses,
 * so we can compare against /api/public/asr-probe (which forces Transcribr/OpenAI directly).
 * GET /api/public/product-probe?url=<youtube_url>
 */
export const Route = createFileRoute("/api/public/product-probe")({
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
          const { fetchTranscript } = await import("@/lib/transcript.functions");
          const t0 = Date.now();
          // Invoke the server fn handler directly (bypass HTTP framing).
          const res = await (fetchTranscript as any).handler({ data: { url } });
          const elapsedMs = Date.now() - t0;
          return new Response(
            JSON.stringify({
              env: {
                ASR_PROVIDER: process.env.ASR_PROVIDER ?? null,
                has_TRANSCRIBR_API_KEY: !!process.env.TRANSCRIBR_API_KEY,
                has_RAPIDAPI_KEY: !!process.env.RAPIDAPI_KEY,
                has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
              },
              elapsedMs,
              videoId: res?.videoId,
              source: res?.source,
              cachedFromProvider: res?.cachedFromProvider,
              language: res?.language,
              cacheHit: res?.cacheHit,
              sentenceCount: res?.sentences?.length ?? 0,
              rawChunkCount: res?.rawChunks?.length ?? 0,
              first3Sentences: (res?.sentences ?? []).slice(0, 3).map((s: any) => ({
                id: s.id, offset: s.offset, text: s.text,
              })),
              first3Chunks: (res?.rawChunks ?? []).slice(0, 3),
              provenance: res?.provenance ?? null,
              providerTrace: res?.providerTrace ?? null,
              quality: res?.quality ?? null,
            }, null, 2),
            { headers: { "content-type": "application/json" } },
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({
              error: e?.message ?? String(e),
              errorType: e?.errorType ?? null,
              providerMessage: e?.providerMessage ?? null,
              stack: e?.stack ?? null,
              env: {
                ASR_PROVIDER: process.env.ASR_PROVIDER ?? null,
              },
            }, null, 2),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
