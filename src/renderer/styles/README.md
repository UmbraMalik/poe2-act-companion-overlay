# Renderer CSS modules

`src/renderer/styles.css` is the only stylesheet entry imported by the app.

The app uses the numbered CSS partials in this folder as the single source of truth:

1. `01-overlay-core.css` — base overlay, shared HUD, timer-only early rules.
2. `02-settings-shell.css` — settings and app shell layout.
3. `03-route-reminders-bonuses.css` — route density, reminders dashboard, bonus tabs.
4. `04-overlay-data-timer-base.css` — zone bonus cards, league rewards, timer-only base.
5. `05-overlay-layout-modes.css` — companion header, adaptive overlay, compact and timer-only modes.
6. `06-report-community-support.css` — report window and companion community/support tabs.
7. `07-ui-polish-settings-support.css` — late UI polish, companion actions, settings/support overrides.
8. `08-route-polish-final.css` — final route overlap and density fixes.
9. `09-overlay-chrome-controls.css` — overlay chrome, controls, icons, header pass.
10. `10-typography-refresh.css` — typography refresh and text weight tuning.
11. `11-overlay-header-actions.css` — header layout, close UX, intent hover/focus colors, compact header fixes.
12. `12-localization-toggle.css` — very narrow overlay and RU/EN language toggle.

Keep imports in `src/renderer/styles.css` in numeric order unless you intentionally change cascade priority.

Do not add parallel folder copies like `styles/base/*`, `styles/overlay/*`, `styles/pages/*`, `styles/polish/*` or `styles/settings/*`.
Those used to exist as duplicate sources and made it too easy to edit a CSS file that the app never imported.
