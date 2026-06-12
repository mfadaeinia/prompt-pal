import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Trash2, Play, ArrowLeft, Bookmark } from "lucide-react";
import {
  listSavedExpressions,
  deleteSavedExpression,
} from "@/lib/saved-expressions.functions";
import { getBrowserId } from "@/lib/browser-id";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "My Expressions — NativeFlow" },
      {
        name: "description",
        content:
          "Your personal collection of useful sentences and expressions saved from videos.",
      },
    ],
  }),
  component: SavedPage,
});

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function SavedPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(listSavedExpressions);
  const deleteFn = useServerFn(deleteSavedExpression);
  const qc = useQueryClient();
  const [browserId, setBrowserId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    setBrowserId(getBrowserId());
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["saved-expressions", browserId],
    queryFn: () => listFn({ data: { sessionId: browserId } }),
    enabled: !!browserId,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      deleteFn({ data: { sessionId: browserId, id } }),
    onSuccess: (_res, id) => {
      track("expression_removed", { expression_id: id });
      qc.invalidateQueries({ queryKey: ["saved-expressions", browserId] });
    },
  });

  const items = data?.items ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it: any) =>
      [it.sentence_text, it.translation, it.meaning, it.expression_notes, it.video_title]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q))
    );
  }, [items, query]);

  function watchAgain(item: any) {
    track("watch_again_clicked", {
      expression_id: item.id,
      video_id: item.video_id,
      timestamp_seconds: item.timestamp_seconds,
    });
    track("saved_expression_revisited", {
      expression_id: item.id,
      video_id: item.video_id,
    });
    const params = new URLSearchParams();
    if (item.video_url) params.set("v", item.video_url);
    if (item.target_language) params.set("lang", item.target_language);
    if (item.timestamp_seconds) params.set("t", String(item.timestamp_seconds));
    navigate({ to: "/", search: () => Object.fromEntries(params) as any });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Bookmark className="h-4 w-4 text-primary" /> My Expressions
          </h1>
          <span className="w-12" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expressions, translations or videos…"
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your expressions…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasAny={items.length > 0} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((item: any) => (
              <li
                key={item.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-primary/5"
              >
                <p className="text-base font-semibold leading-snug text-foreground">
                  {item.sentence_text}
                </p>
                {item.translation && (
                  <p className="mt-2 text-sm text-foreground/90">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Translation
                    </span>
                    <br />
                    {item.translation}
                  </p>
                )}
                {item.meaning && (
                  <p className="mt-2 text-sm text-foreground/80">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Meaning
                    </span>
                    <br />
                    {item.meaning}
                  </p>
                )}
                {item.expression_notes && item.expression_notes !== "—" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground/70">Notes:</span>{" "}
                    {item.expression_notes}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                  {item.video_title && (
                    <span className="truncate font-medium text-foreground/70">
                      {item.video_title}
                    </span>
                  )}
                  <span>·</span>
                  <span>{fmtTime(item.timestamp_seconds ?? 0)}</span>
                  <span>·</span>
                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    size="sm"
                    onClick={() => watchAgain(item)}
                    disabled={!item.video_url}
                    className="gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" /> Watch again
                  </Button>
                  <button
                    onClick={() => removeMutation.mutate(item.id)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Bookmark className="h-6 w-6" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">
        {hasAny ? "No matches" : "No saved expressions yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasAny
          ? "Try a different search term."
          : "Tap ★ Save on any explanation while learning to bookmark it here."}
      </p>
      {!hasAny && (
        <Link
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Start learning
        </Link>
      )}
    </div>
  );
}
