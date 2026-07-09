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
