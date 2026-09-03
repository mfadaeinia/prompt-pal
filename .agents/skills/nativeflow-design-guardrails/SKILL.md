---
name: nativeflow-design-guardrails
description: Guardrails for making UI changes in NativeFlow without unintended redesigns. Use whenever editing components, styles, layout, landing page, watch/subtitle UI, or any visual code in this project.
---

# NativeFlow Design Guardrails

The existing, approved UI is the baseline. A feature request is **not** permission to redesign a page.

## Core rules

1. **Surgical changes only.** Modify the explicitly requested component and the minimum supporting code — nothing else.
2. **Preserve everything unrelated:** layout, spacing, typography, colors, component sizes, navigation, page width, responsive behavior, visual hierarchy.
3. **Reuse before creating.** Use existing components/tokens (`src/components/ui/*`, `BrandLogo`, semantic CSS variables in `src/styles.css`) before writing new ones.
4. **No unrequested "improvements."** Do not modernize, clean up, polish, or refactor unrelated UI.
5. **Unrelated visual change = regression.** If an implementation shifts anything outside its scope, revert that part before finishing.
6. **Compare before finishing.** Diff the result against the previous implementation and confirm only the requested surface changed.

## NativeFlow-specific rules

- The **interactive video + subtitle experience is primary**. Do not demote it, wrap it in new chrome, or change its default behavior.
- The **transcript is secondary/optional**. It stays collapsible/toggleable; never make it the primary surface.
- **Useful multi-word expressions stay atomic semantic units** — never split a phrase across lines or highlight fragments (keep `box-decoration-clone` style handling).
- Preserve the **navy + purple/pink + lavender** visual language (brand gradient `#FF5A3D → #FF2D7A → #7B3FF2`, primary `#7B3FF2`, light canvas). No blue accents, no forced dark mode.
- Preserve **rounded cards, subtle borders/shadows, and generous whitespace**. Shadows stay `shadow-sm`/`shadow-md`.
- **Never globally change fonts or typography** (Playfair Display headings + Plus Jakarta Sans body stay as configured).
- **Do not touch the landing page** unless the task explicitly concerns the landing page. See `landing-page-baseline.md` — that structure is protected.

## Checklist before reporting done

- [ ] Only the requested component(s) changed
- [ ] No token, font, or global CSS edits unless requested
- [ ] Landing page untouched (unless in scope)
- [ ] Video/subtitle primacy intact, transcript still secondary
- [ ] No new component where an existing one fit
