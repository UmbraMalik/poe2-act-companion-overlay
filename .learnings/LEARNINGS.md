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
