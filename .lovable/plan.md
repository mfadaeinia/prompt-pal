# Plan: Replace Fake Testimonials with Founder Note

## Goal
Remove the fabricated user testimonials from the landing page and replace them with an authentic founder message.

## Changes

### 1. Remove `<Testimonials />` usage
In `src/components/MarketingLanding.tsx`, remove the `<Testimonials />` element from the `MarketingLanding` component JSX.

### 2. Add founder note section
Create a new `FounderNote` component inside `src/components/MarketingLanding.tsx` (or as a separate component) that renders:
- A personal, authentic message: "about myself, I'm building this solo in Eindhoven. Be one of the first 10 users and shape it with me."
- Styled consistently with the landing page (slate/blue palette, rounded cards, clean typography).
- Include a "Join the first 10" CTA button that triggers the sign-up flow (`onPrimary`).

### 3. Clean up old code
Delete the `TESTIMONIALS` constant array and the `Testimonials` function from `src/components/MarketingLanding.tsx`.

## Files to modify
- `src/components/MarketingLanding.tsx`
