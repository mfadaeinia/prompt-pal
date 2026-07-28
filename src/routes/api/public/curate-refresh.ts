/**
 * Weekly curation cron endpoint.
 *
 * Public prefix (no site auth) — protected by a shared secret header so only
 * the scheduler can trigger a refresh.
 *   curl -X POST https://<host>/api/public/curate-refresh -H "x-curate-secret: ..."
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/curate-refresh")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CURATION_REFRESH_SECRET;
        if (!secret) {
          return new Response(
            JSON.stringify({ error: "CURATION_REFRESH_SECRET not configured" }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }
        if (request.headers.get("x-curate-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { runWeeklyRefresh } = await import("@/lib/curation/refresh.server");
          const result = await runWeeklyRefresh();
          return new Response(JSON.stringify(result, null, 2), {
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
