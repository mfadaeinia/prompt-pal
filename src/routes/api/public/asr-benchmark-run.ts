import { createFileRoute } from "@tanstack/react-router";

/**
 * TEMPORARY orchestrator to run the full benchmark via HTTP.
 * Mirrors BenchmarkSection's loop (start → process each video → finalize).
 * GET /api/public/asr-benchmark-run?mode=full&version=openai-validation
 * Streams progress lines so callers can monitor. Remove after benchmark validation.
 */
export const Route = createFileRoute("/api/public/asr-benchmark-run")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = (url.searchParams.get("mode") ?? "full") as "quick" | "full";
        const version = url.searchParams.get("version") ?? `openai-${new Date().toISOString().slice(0,16)}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: videos, error: vErr } = await supabaseAdmin
          .from("benchmark_videos" as any)
          .select("id, youtube_url, title")
          .eq("active", true)
          .order("category", { ascending: true });
        if (vErr) return new Response(`videos err: ${vErr.message}`, { status: 500 });
        const list = (videos ?? []) as any[];

        const { data: runRow, error: rErr } = await supabaseAdmin
          .from("benchmark_runs" as any)
          .insert({
            mode,
            status: "running",
            release_version: version,
            total_videos: list.length,
            started_at: new Date().toISOString(),
          } as any)
          .select("id")
          .single();
        if (rErr) return new Response(`run err: ${rErr.message}`, { status: 500 });
        const runId = (runRow as any).id as string;

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const emit = (s: string) => controller.enqueue(enc.encode(s + "\n"));
            emit(`runId=${runId} total=${list.length} mode=${mode} version=${version}`);

            try {
              const { processBenchmarkVideo, finalizeBenchmarkRun } = await import(
                "@/lib/benchmark.functions"
              );

              for (let i = 0; i < list.length; i++) {
                const v = list[i];
                const t0 = Date.now();
                try {
                  // server fn handler is callable as plain async function on the server
                  await (processBenchmarkVideo as any)({ data: { runId, videoId: v.id } });
                  emit(`[${i + 1}/${list.length}] ok ${v.id} ${Date.now() - t0}ms ${v.title ?? ""}`);
                } catch (e) {
                  emit(`[${i + 1}/${list.length}] ERR ${v.id} ${e instanceof Error ? e.message : String(e)}`);
                }
                await new Promise((r) => setTimeout(r, 1000));
              }
              await (finalizeBenchmarkRun as any)({ data: { runId, status: "completed" } });
              emit(`DONE runId=${runId}`);
            } catch (e) {
              emit(`FATAL ${e instanceof Error ? e.message : String(e)}`);
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "x-run-id": runId,
          },
        });
      },
    },
  },
});
