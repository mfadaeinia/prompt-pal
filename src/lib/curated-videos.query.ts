import { queryOptions } from "@tanstack/react-query";
import { listCuratedVideos } from "@/lib/curated-library.functions";

/**
 * Single source of truth for the curated-library read.
 *
 * Shared by the library pages and the discovery strip so route loaders can
 * prime the exact same cache entry the components subscribe to — that way the
 * server-rendered HTML already contains the videos instead of a skeleton that
 * only resolves once client JS runs.
 */
export const curatedVideosQuery = (limit: number) =>
  queryOptions({
    queryKey: ["curated-videos", limit],
    queryFn: () => listCuratedVideos({ data: { limit } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
