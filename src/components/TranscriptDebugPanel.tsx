import { useMemo, useState } from "react";
import type { TranscriptSentence, TranscriptSource } from "@/lib/transcript.functions";

export type AiInspectorDebug = {
  bytes: number;
  sentenceLength: number;
  contextLength: number;
  promptLength: number;
  systemLength: number;
  chunkingApplied: boolean;
  chunksSent: number;
  chunkSizes: number[];
  promptFirst500: string;
  promptLast500: string;
  deliveryMode: string;
  truncated: boolean;
};

type Props = {
  status: "idle" | "loading" | "success" | "error";
  url: string;
  videoId: string | null;
  videoTitle: string | null;
  source: TranscriptSource | null;
  sentences: TranscriptSentence[];
  errorMessage: string | null;
  errorType: string | null;
  lastAiPayloadBytes: number | null;
  lastAiSentenceLength: number | null;
  lastAiTruncated: boolean | null;
  lastAiInspector: AiInspectorDebug | null;
};

export function TranscriptDebugPanel(props: Props) {
  const [open, setOpen] = useState(true);
  const stats = useMemo(() => {
    const fullText = props.sentences.map((s) => s.text).join(" ");
    const chars = fullText.length;
    const words = fullText.trim() ? fullText.trim().split(/\s+/).length : 0;
    const sentenceCount = props.sentences.length;
    const first500 = fullText.slice(0, 500);
    const last500 = fullText.slice(-500);
    const segWords = props.sentences.map((s) =>
      s.text.trim() ? s.text.trim().split(/\s+/).length : 0
    );
    const avgWordsPerSegment = segWords.length
      ? words / segWords.length
      : 0;
    const longestSegment = segWords.reduce((m, n) => Math.max(m, n), 0);
    const shortestSegment = segWords.length
      ? segWords.reduce((m, n) => Math.min(m, n), Infinity)
      : 0;
    return {
      chars,
      words,
      sentenceCount,
      first500,
      last500,
      fullText,
      avgWordsPerSegment,
      longestSegment,
      shortestSegment: shortestSegment === Infinity ? 0 : shortestSegment,
    };
  }, [props.sentences]);

  const first10 = props.sentences.slice(0, 10);
  const last10 = props.sentences.slice(-10);
  const success = props.status === "success" && props.sentences.length > 0;

  return (
    <div className="my-4 rounded-lg border-2 border-yellow-500/70 bg-yellow-50 p-3 font-mono text-[11px] text-black shadow dark:bg-yellow-950/40 dark:text-yellow-50">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-yellow-700 dark:text-yellow-300">
          🐞 Transcript Debug Panel (temporary)
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded bg-yellow-500/30 px-2 py-0.5 text-[10px] uppercase"
        >
          {open ? "hide" : "show"}
        </button>
      </div>

      {open && (
        <div className="space-y-2">
          <Row k="Fetched successfully" v={success ? "✅ Yes" : "❌ No"} />
          <Row k="Status" v={props.status} />
          <Row k="URL" v={props.url || "—"} />
          <Row k="Video ID" v={props.videoId ?? "—"} />
          <Row k="Video title" v={props.videoTitle ?? "—"} />
          <Row k="Source / provider" v={props.source ?? "—"} />
          <Row k="Segment count" v={String(props.sentences.length)} />
          <Row k="Total characters" v={String(stats.chars)} />
          <Row k="Total words" v={String(stats.words)} />
          <Row
            k="Last AI payload"
            v={
              props.lastAiPayloadBytes != null
                ? `${props.lastAiPayloadBytes} B${
                    props.lastAiTruncated ? " (truncated)" : ""
                  }`
                : "—"
            }
          />
          <Row
            k="Last AI sentence length"
            v={
              props.lastAiSentenceLength != null
                ? String(props.lastAiSentenceLength)
                : "—"
            }
          />

          <div className="rounded border-2 border-fuchsia-500/50 bg-fuchsia-50 p-2 dark:bg-fuchsia-950/40">
            <div className="mb-1 font-bold text-fuchsia-700 dark:text-fuchsia-300">
              🔍 AI Input Inspector (per call)
            </div>
            {props.lastAiInspector ? (
              <div className="space-y-1">
                <Row
                  k="What AI receives"
                  v={
                    props.lastAiInspector.deliveryMode === "single_sentence"
                      ? "single sentence only"
                      : props.lastAiInspector.deliveryMode ===
                          "single_sentence_with_context"
                        ? "single sentence + 3-sentence context window"
                        : props.lastAiInspector.deliveryMode
                  }
                />
                <Row k="Receives full transcript?" v="❌ No" />
                <Row
                  k="Chunking applied"
                  v={props.lastAiInspector.chunkingApplied ? "Yes" : "No"}
                />
                <Row
                  k="Chunks sent to AI"
                  v={String(props.lastAiInspector.chunksSent)}
                />
                <Row
                  k="Chunk sizes (chars)"
                  v={props.lastAiInspector.chunkSizes.join(", ")}
                />
                <Row
                  k="Prompt payload length"
                  v={`${props.lastAiInspector.promptLength} chars`}
                />
                <Row
                  k="System prompt length"
                  v={`${props.lastAiInspector.systemLength} chars`}
                />
                <Row
                  k="Total payload bytes"
                  v={`${props.lastAiInspector.bytes} B`}
                />
                <Row
                  k="Sentence length sent"
                  v={`${props.lastAiInspector.sentenceLength} chars`}
                />
                <Row
                  k="Context length sent"
                  v={`${props.lastAiInspector.contextLength} chars`}
                />
                <Row
                  k="Truncated"
                  v={props.lastAiInspector.truncated ? "⚠️ Yes" : "No"}
                />
                <details className="mt-1">
                  <summary className="cursor-pointer font-semibold">
                    Prompt first 500 chars
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/5 p-1 dark:bg-white/5">
                    {props.lastAiInspector.promptFirst500 || "—"}
                  </pre>
                </details>
                <details>
                  <summary className="cursor-pointer font-semibold">
                    Prompt last 500 chars
                  </summary>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/5 p-1 dark:bg-white/5">
                    {props.lastAiInspector.promptLast500 || "—"}
                  </pre>
                </details>
              </div>
            ) : (
              <div className="italic opacity-70">
                No AI call yet — click a sentence to populate.
              </div>
            )}
          </div>

          <div className="rounded border border-yellow-500/40 p-2">
            <div className="mb-1 font-semibold">📜 Full transcript stats</div>
            <Row k="Sentence count" v={String(stats.sentenceCount)} />
            <Row k="Character count" v={String(stats.chars)} />
            <Row k="Word count" v={String(stats.words)} />
            <Row
              k="Avg words / segment"
              v={stats.avgWordsPerSegment.toFixed(1)}
            />
            <Row k="Longest segment (words)" v={String(stats.longestSegment)} />
            <Row
              k="Shortest segment (words)"
              v={String(stats.shortestSegment)}
            />
            <details>
              <summary className="cursor-pointer font-semibold">
                Transcript first 500 chars
              </summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/5 p-1 dark:bg-white/5">
                {stats.first500 || "—"}
              </pre>
            </details>
            <details>
              <summary className="cursor-pointer font-semibold">
                Transcript last 500 chars
              </summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-black/5 p-1 dark:bg-white/5">
                {stats.last500 || "—"}
              </pre>
            </details>
          </div>

          {props.errorMessage && (
            <div className="rounded border border-red-500/50 bg-red-100 p-2 text-red-900 dark:bg-red-950/40 dark:text-red-200">
              <div className="font-bold">Provider error</div>
              <div>type: {props.errorType ?? "unknown"}</div>
              <div className="whitespace-pre-wrap break-words">
                {props.errorMessage}
              </div>
            </div>
          )}

          <details open className="rounded border border-yellow-500/40 p-2">
            <summary className="cursor-pointer font-semibold">
              First 10 segments
            </summary>
            <ol className="mt-1 space-y-0.5">
              {first10.map((s, i) => (
                <li key={s.id} className="border-b border-yellow-500/20 py-0.5">
                  <span className="text-yellow-700 dark:text-yellow-300">
                    #{i + 1} @{s.offset.toFixed(1)}s
                  </span>{" "}
                  {s.text}
                </li>
              ))}
              {first10.length === 0 && <li className="italic">none</li>}
            </ol>
          </details>

          <details className="rounded border border-yellow-500/40 p-2">
            <summary className="cursor-pointer font-semibold">
              Last 10 segments
            </summary>
            <ol className="mt-1 space-y-0.5">
              {last10.map((s, i) => (
                <li key={s.id} className="border-b border-yellow-500/20 py-0.5">
                  <span className="text-yellow-700 dark:text-yellow-300">
                    @{s.offset.toFixed(1)}s
                  </span>{" "}
                  {s.text}
                </li>
              ))}
              {last10.length === 0 && <li className="italic">none</li>}
            </ol>
          </details>

          <p className="text-[10px] opacity-60">
            Diagnostics only — remove before launch. Server logs prefixed
            "[transcript-debug]" and "[explain-debug]".
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-yellow-500/20 py-0.5">
      <span className="opacity-70">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
