# Smarter Useful-Expression Selection

Replace "LLM tag + word count → always show top item" with a 6-stage pipeline: generate candidates, evaluate signals, score, gate on quality, control density, then display. Weights and thresholds live in one config file so they can be tuned without touching the rest of the system.

## Architecture

```text
transcript sentence(s)
  │
  ├─ Stage 1  candidate generation      LLM (existing explain call, extended)
  │            → phrase, literal gloss, meaning, type, cefr estimate,
  │              reuse/idiomaticity/context self-reports
  │
  ├─ Stage 2  feature evaluation        deterministic code (no LLM)
  │            → 6 signals, each 0–10
  │
  ├─ Stage 3  ranking                   weighted sum → score 0–10 + reason trace
  │
  ├─ Stage 4  quality gate              score >= MIN_SCORE (7.0), else nothing
  │
  ├─ Stage 5  density + dedup           per-video budget, per-sentence max 1,
  │                                      lemma-level dedup across the video
  │
  └─ Stage 6  UI                        subtitle highlight + expression bar
```

Key architectural point: the LLM never decides *what is highlighted*. It only produces **candidate descriptors** (facts about a phrase). All ranking maths, thresholds and learner adaptation happen in plain TypeScript, inspectable and unit-testable.

## New files

- `src/lib/expression-ranking.ts` — pure, no imports from server code: types, weights config, all six signal functions, `scoreCandidate()`, `rankCandidates()`, `applyDensityAndDedup()`. Fully unit-testable.
- `src/lib/expression-ranking.test.ts` — the worked examples below become tests, so tuning weights can't silently regress.
- `src/lib/learner-level.ts` — resolve + persist the learner's CEFR level (see CEFR section).

## Changed files

- `src/lib/explain.functions.ts` — extend the prompt with a machine-readable `Candidates:` block; return parsed candidates alongside the existing human-facing explanation text. Bump the cache key.
- `src/lib/useful-expression.ts` — becomes a thin adapter: parse legacy fields for backwards compatibility, delegate ranking to `expression-ranking.ts`. `pickUsefulExpression` gains a `{ level, videoContext, history }` argument and may return `null` (already supported by the UI).
- `src/routes/index.tsx` — pass learner level + per-video highlight budget + already-highlighted set into the ranking call; keep the current prefetch window untouched.
- `src/components/UsefulExpressionBar.tsx` — no behaviour change; add an optional dev-only score/reason tooltip behind the existing tester flag.

## Stage 1 — candidate generation (LLM)

The existing single `generateText` call is kept (no extra latency, no extra cost). The prompt gains one extra output block, and the model is explicitly told it is producing *candidates for evaluation*, not final answers:

```text
Candidates: <0–4 items, one per line, pipe-separated fields>
phrase | literal | meaning | type | cefr | reuse | opaque | context
```

- `type` ∈ `idiom | collocation | phrasal | separable | chunk | fixed | vocab | grammar`
- `cefr` ∈ `A1 A2 B1 B2 C1 C2` — the level at which a learner would typically *meet* the phrase
- `reuse`, `opaque`, `context` ∈ `0–3` integers, defined in the prompt as observable judgements ("in how many unrelated situations could this be reused", "can meaning be derived from the words alone", "does the sentence collapse without it")

No `[Very Common]`-style tags are used for scoring any more. The model is asked to over-generate slightly (recall-oriented); precision is our job in Stage 2–4.

Robustness: if the block is missing or malformed (older cache entries, model drift), the adapter falls back to parsing `Key Expressions` / `Vocabulary` as today and marks the candidate `inferred: true`, which caps `S_B`, `S_C`, `S_D` at 6 — so weak legacy candidates cannot pass the 7.0 gate. Fail-quiet, not fail-loud.

## Stage 2 — signals (deterministic)

All six signals return 0–10. `L` = learner level index (A1=1 … C2=6), `C` = candidate `cefr` index.

**A. Communicative usefulness (25%)** — `type` base (chunk/fixed/collocation 8, phrasal/separable 8, idiom 7, vocab 4, grammar 5), plus `+1` when the phrase is topic-independent (no proper nouns, no numbers, no domain nouns from a small stoplist), `−3` when it contains a proper noun / date / number, `−2` for greetings-and-pleasantries lexicon (`goedemorgen`, `dank je`, `alsjeblieft`, …) unless part of a longer non-obvious chunk.

**B. Natural / native-like value (20%)** — `type` multiword bonus (2–5 tokens = 8, 1 token = 3, 6+ = 4), `+2` when the phrase contains a function-word skeleton typical of Dutch chunks (`er`, `wel`, `even`, `toch`, `maar`, `eens`, `hoor`, fixed prepositions), `+1` for separable-verb split patterns detected in the source sentence.

**C. Idiomatic / non-obvious value (15%)** — driven by `opaque` (0→2, 1→5, 2→8, 3→10) and adjusted by literal-vs-meaning divergence: token-overlap between `literal` and `meaning` (reuse of the existing `normalize`/`overlapScore` helpers in `explain.functions.ts`, moved into the ranking module). High overlap = transparent = −2. Single-word transparent vocab lands ~2–4 and dies at the gate.

**D. Reusability (15%)** — `reuse` (0→2 … 3→10), `−3` if the phrase carries topic-specific content words, `+1` if it is a pattern with a slot (detected via `iets`, `iemand`, `ergens`, or a verb+preposition frame).

**E. CEFR fit (15%)** — deterministic curve on `Δ = C − L`:

| Δ | −3 or less | −2 | −1 | 0 | +1 | +2 | +3 or more |
|---|---|---|---|---|---|---|---|
| score | 0 | 2 | 5 | 8 | 10 | 7 | 4 |

Slightly-above-level wins; far-below-level is effectively vetoed (this is what kills `goedemorgen` for B1/B2). Override: if `opaque >= 2` or `type` ∈ `idiom/phrasal/separable/fixed`, the floor is raised to 5 — so a simple-looking but non-obvious expression is not rejected on level alone.

**F. Contextual importance (10%)** — `context` (0→2 … 3→10), `+1` when the phrase spans the sentence's main verb.

Frequency is nowhere a direct positive term. It enters only indirectly, through A's topic-independence and D's reusability.

## Stage 3 — scoring formula

```ts
score = 0.25*A + 0.20*B + 0.15*C + 0.15*D + 0.15*E + 0.10*F   // 0–10
```

Every candidate carries a `trace: { A,B,C,D,E,F, weighted, reasons: string[] }`, where `reasons` records each applied adjustment ("proper noun −3", "slightly above level +10"). This is what makes "why 8.1?" answerable, and it is what the dev tooltip renders.

Config, all in one exported object in `expression-ranking.ts`:

```ts
export const RANKING_CONFIG = {
  weights: { A: 0.25, B: 0.20, C: 0.15, D: 0.15, E: 0.15, F: 0.10 },
  minScore: 7.0,              // Stage 4 quality gate
  maxPerSentence: 1,
  densityPerMinute: 1.5,      // guardrail, never a quota
  minGapSeconds: 20,          // no two highlights back-to-back
  dedupWindow: Infinity,      // per video
};
```

## Stage 4 — quality gate

Filter `score >= minScore`. If nothing passes, the sentence yields `null` and the UI stays quiet — `UsefulExpressionBar` and `VideoSubtitle` already handle the empty state, so no new UI work is needed. No "best of bad options" fallback anywhere.

## Stage 5 — dynamic density + dedup

- Budget = `ceil(videoDurationMinutes * densityPerMinute)`, computed from the player duration once known, recomputed if duration arrives late. Pure ceiling, never a target: a 2-minute video allows 3 highlights but may show 1.
- Spacing: skip a passing candidate if the previous accepted highlight is within `minGapSeconds`, *unless* the new one scores ≥1.0 higher (then it replaces the pending slot for its own sentence only).
- Dedup key: normalized phrase with a light Dutch lemma pass (strip `-en`/`-t`/`-de`/`-je` inflection, drop leading `de/het/een`, collapse separable-verb splits back to the infinitive) held in a per-video `Set`. Near-duplicates are also caught by a token-Jaccard ≥ 0.8 check against already-shown phrases, so *zin hebben in* / *had zin in* teach once.
- Because prefetch is progressive, the budget is spent greedily in playback order; if a later, better candidate appears after the budget is exhausted, it is simply not shown (acceptable for v1, revisit if testing shows starvation early in long videos).

## CEFR level input

Three sources, first match wins, in `learner-level.ts`:

1. Explicit user choice, persisted in `localStorage` (`nf.learnerLevel`) — surfaced next to the existing "Explain in" language selector, same visual pattern.
2. The curated video's `cefr_level` when the session started from Explore Dutch (already available in the library payload) — used as an inference, not written to storage.
3. Default `B1`.

The level flows into `pickUsefulExpression` as a plain argument. Nothing about the level is sent to the LLM: signal E is deterministic, so changing level re-ranks instantly with no new request and no cache miss.

## Cache key change

`explain.functions.ts` cache key becomes:

```
MODEL_VERSION = "google/gemini-3-flash-preview@v2-candidates"
key = `${MODEL_VERSION}::${PROMPT_VERSION}::${targetLanguage}::${sentence}`
```

Deliberately **level-free** — the cached artefact is the candidate set, and ranking is applied after the cache, per learner. One LLM call serves every level. Bumping `MODEL_VERSION` invalidates old entries lacking the `Candidates:` block; the legacy-parse fallback keeps anything still warm from crashing.

## Worked examples

Learner levels: **A2**, **B1**, **B2**. Weighted score = `0.25A+0.20B+0.15C+0.15D+0.15E+0.10F`.

**1. `goedemorgen` (A1 greeting) — B1 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 2 (vocab 4, greeting −2) | 3 (single token) | 2 (transparent) | 4 | 0 (Δ=−2 → 2, no override… A1 vs B1 Δ=−2) | 2 | **2.3** |

FAIL. Exactly the case the current system wrongly highlights.

**2. `er geen gat in zien` (idiom, C.≈B2) — B1 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 8 (idiom 7, topic-independent +1) | 10 (multiword + `er` skeleton) | 10 (opaque 3) | 8 | 10 (Δ=+1) | 8 | **9.0** |

PASS.

**3. `zonsverduistering` (topic noun, C1) — B2 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 4 (vocab, domain noun) | 3 (single token) | 3 | 2 (topic-locked −3) | 10 (Δ=+1) | 8 (key to the sentence) | **4.9** |

FAIL on usefulness/reusability despite being contextually important — correct: it belongs in the on-demand explanation, not as a taught highlight.

**4. `zin hebben in` (semi-fixed chunk, B1) — A2 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 9 (chunk 8, topic-independent +1) | 10 (multiword + fixed prep) | 8 (opaque 2) | 10 (slot pattern) | 10 (Δ=+1) | 6 | **8.9** |

PASS. Same phrase for a **B2** learner: E drops to 5 (Δ=−1) → **8.15**, still passes — appropriate, it stays worth consolidating.

**5. `houdt er rekening mee dat` (collocation, B2) — B2 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 9 | 10 (`er … mee` skeleton) | 8 | 9 | 8 (Δ=0) | 7 | **8.65** |

PASS.

**6. `heel goed` (transparent intensifier, A2) — B2 learner**

| A | B | C | D | E | F | score |
|---|---|---|---|---|---|---|
| 5 | 6 (two tokens) | 2 | 7 | 2 (Δ=−2) | 3 | **4.3** |

FAIL — reusable but nothing to teach.

Result on a typical NOS clip: roughly 1 in 4–6 sentences yields a highlight, which matches the 1–2/minute guardrail without any quota forcing.

## Personalization hooks (structure only, not built)

`scoreCandidate(candidate, { level, history })` takes an optional `history` object with `seen`, `clicked`, `saved`, `known` sets. v1 passes `undefined`. Two reserved zero-weight signals (`G_novelty`, `H_mastery`) sit in the config at weight `0`, so later work is a weight change plus one function body — no pipeline surgery. Saved expressions already exist in `saved-expressions.functions.ts` and will be the first real history source.

## Out of scope for this change

- Video-level curation pass with a second model (the earlier Phase 1 proposal) — the per-sentence path plus a real gate is enough to test the hypothesis.
- New DB tables, ML training, cross-video learner model.
