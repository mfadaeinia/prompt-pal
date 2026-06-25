// Server-only helper for reading the currently active release cohort id.
// Cached in-process for 60s to avoid hammering the DB on every analytics insert.
// Only safe to import from server function handler bodies (not module scope of
// client-reachable files).

let cached: { id: string | null; at: number } = { id: null, at: 0 };
const TTL_MS = 60_000;

export async function getActiveCohortId(): Promise<string | null> {
  const now = Date.now();
  if (cached.id && now - cached.at < TTL_MS) return cached.id;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("release_cohorts" as any)
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error || !data) return cached.id; // keep previous value on transient failure
    const id = (data as any).id as string;
    cached = { id, at: now };
    return id;
  } catch {
    return cached.id;
  }
}

export function invalidateActiveCohortCache() {
  cached = { id: null, at: 0 };
}
