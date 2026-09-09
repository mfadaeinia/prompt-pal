# Mobile transcript hierarchy correction

## Scope
- Change only the mobile demo/watch presentation in `src/features/home/HomeApp.tsx` below 768px.
- Keep desktop/tablet, video, subtitles, explanation behavior, transcript data, analytics, and global styles unchanged.

## Implementation
- Remove the standalone mobile “Watch a few seconds” guidance card.
- Replace the large transcript instruction banner with one compact hint directly beneath the transcript toolbar.
- Tighten only mobile spacing between video, toolbar, hint, and transcript rows.
- Preserve the viewport-filling internal transcript scroller and give recovered space to sentence rows.
- Adjust mobile auto-follow to keep the active sentence around the upper-middle with a dead zone; preserve manual browsing and show “Jump to current” only when the active row is truly out of view.

## Verification
- Test the real demo at 390 × 844 for default-open transcript, compact hierarchy, multiple visible sentence rows, internal scrolling, and conditional Jump to current.
- Capture desktop at 1280px and compare against the existing structure to confirm no desktop markup or behavior changed.
