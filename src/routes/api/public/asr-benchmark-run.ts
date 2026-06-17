import { createFileRoute } from "@tanstack/react-router";
import { writeFileSync, appendFileSync, mkdirSync } from "fs";

/**
 * TEMPORARY orchestrator to run the full benchmark via HTTP.
 * Fires the loop in the background and returns runId immediately.
 * Progress is appended to /tmp/bench/<runId>.log. Remove after validation.
 */
export const Route = createFileRoute("/api/public/asr-benchmark-run")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = (url.searchParams.get("mode") ?? "full") as "quick" | "full";
        const pipelineMode = (url.searchParams.get("pipeline") ?? "current") as "current" | "openai_only";
        const version = url.searchParams.get("version") ?? `${pipelineMode}-${Date.now()}`;

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

        try { mkdirSync("/tmp/bench", { recursive: true }); } catch {}
        const logPath = `/tmp/bench/${runId}.log`;
        writeFileSync(logPath, `runId=${runId} total=${list.length} mode=${mode} version=${version}\n`);
        const log = (s: string) => { try { appendFileSync(logPath, s + "\n"); } catch {} };

        // Fire-and-forget — detached from request lifecycle
        (async () => {
          try {
            const { processBenchmarkVideo, finalizeBenchmarkRun } = await import(
              "@/lib/benchmark.functions"
            );
            for (let i = 0; i < list.length; i++) {
              const v = list[i];
              const t0 = Date.now();
              try {
                await (processBenchmarkVideo as any)({ data: { runId, videoId: v.id } });
                log(`[${i + 1}/${list.length}] ok ${v.id} ${Date.now() - t0}ms`);
              } catch (e) {
                log(`[${i + 1}/${list.length}] ERR ${v.id} ${Date.now() - t0}ms ${e instanceof Error ? e.message : String(e)}`);
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
            await (finalizeBenchmarkRun as any)({ data: { runId, status: "completed" } });
            log(`DONE runId=${runId}`);
          } catch (e) {
            log(`FATAL ${e instanceof Error ? e.message : String(e)}`);
            try {
              await supabaseAdmin
                .from("benchmark_runs" as any)
                .update({ status: "failed" } as any)
                .eq("id", runId);
            } catch {}
          }
        })();

        return Response.json({ runId, total: list.length, logPath });
      },
    },
  },
});
