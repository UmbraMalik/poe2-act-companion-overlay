## [LRN-20260709-001] correction

**Logged**: 2026-07-09T21:56:27+03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
Bonus tab readability fixes must preserve the anchored summary row and scroll only the act grid.

### Details
Changing `.bonuses-tab-layout` into the only scroll surface made the top summary card scroll out of view, which clipped the upper part of the Bonuses tab. The safer pattern for this project is keeping `.bonuses-tab-layout` as a two-row grid (`summary` + scrollable act grid), while removing clipping from bonus cards/rows themselves.

### Suggested Action
When adjusting Companion tab overflow, verify which element owns scrolling before broad `overflow` overrides. Prefer targeted `overflow: visible` on card/list content and keep existing fixed header/summary rows anchored.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles/36-companion-cohesion.css, tests/static-regression.test.ts
- Tags: css, companion, bonuses, overflow

---

## [LRN-20260709-002] correction

**Logged**: 2026-07-09T22:15:39+03:00
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
Companion themes should differ by palette/effects, not by font metrics or status pill alignment.

### Details
Classic and dark fantasy theme overrides can accidentally diverge when one theme changes `font-family`, `letter-spacing` or `line-height` for shared Companion rows. That makes the same tab look misaligned between themes, especially compact status pills such as the Act Times `Завершён` label.

### Suggested Action
Keep late Companion theme guards for shared typography and alignment in `36-companion-cohesion.css`. Theme-specific CSS should avoid changing type metrics unless both app themes receive the same rule.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/styles/36-companion-cohesion.css, tests/static-regression.test.ts
- Tags: css, companion, themes, typography, alignment

---

## [LRN-20260713-003] correction

**Logged**: 2026-07-13T01:34:42+03:00
**Priority**: high
**Status**: pending
**Area**: frontend

### Summary
The Current-zone details control must reuse the Settings select chevron primitive instead of maintaining a visually similar custom implementation.

### Details
The custom `zone-detail-toggle-*` markup and late CSS overrides still rendered the same down chevron in the real Companion window for both native `<details>` states. A synthetic CSS fixture confirmed transforms but did not reproduce the actual application result. The requested and safer implementation is to reuse `settings-select-chevron` and the same explicit `settings-select.is-open` state contract used by `SettingsSelect`.

### Suggested Action
When a user asks to match an existing control exactly, reuse its production class names, state class, and markup first. Validate the real state contract rather than creating a parallel CSS approximation.

### Metadata
- Source: user_feedback
- Related Files: src/renderer/CurrentRunHub.tsx, src/renderer/settings/SettingsSelect.tsx, src/renderer/styles/35-dark-fantasy-theme.css
- Tags: css, companion, settings, chevron, reuse

---
