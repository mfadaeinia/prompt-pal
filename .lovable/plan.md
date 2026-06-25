## Problem

In `src/components/YouTubeDiscovery.tsx`, `showExamples` is hardcoded to `true` (line 239). The search results section is gated on `!showExamples` and is therefore never rendered. The search server function still runs and `results` state updates, but the UI only ever shows the "Popular examples" block.

## Fix

Drive `showExamples` from the query state so the popular examples show on an empty search, and results show as soon as the user types.

In `src/components/YouTubeDiscovery.tsx`:

- Replace `const showExamples = true;` with `const showExamples = q.trim().length === 0;`

No other changes required. The existing results / error / loading rendering already handles all states correctly once the gate is fixed.

## Verification

- Empty input → popular examples visible (current behavior preserved).
- Type a query → loader spinner shows, then result cards appear; "No results" / error message shows on failure.
- Clear input → returns to popular examples.