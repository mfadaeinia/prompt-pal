Remove the "Try now" button from every `RecommendedCard` instance in the app.

The button currently lives inside the `RecommendedCard` component in `src/components/AppOnboarding.tsx` (lines 192–199). It is rendered on every recommended video card across the "Recommended first videos" section and the "Recently watched" section.

Change:
- Delete the `<Button>` block inside `RecommendedCard` (the desktop-only "Try now" button).
- Keep the top thumbnail button that navigates to the video — that remains the primary interaction.