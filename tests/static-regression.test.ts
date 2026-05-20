// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMainProcessSource, readText } from './test-utils';

const readRendererStyles = () => {
  const index = readText('src/renderer/styles.css');
  const imported = Array.from(index.matchAll(/@import\s+['"]\.\/(styles\/[^'"]+)['"];/g))
    .map((match) => readText(`src/renderer/${match[1]}`));

  return [index, ...imported].join('\n');
};


test('main-process timer heartbeat exists and renderer exposes visual tick API', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const types = readText('src/shared/types.ts');

  assert.match(main, /TIMER_VISUAL_HEARTBEAT_MS\s*=\s*1000/);
  assert.match(main, /timer:visual-tick/);
  assert.match(main, /startTimerVisualHeartbeat/);
  assert.match(preload, /onTimerVisualTick/);
  assert.match(preload, /timer:visual-tick/);
  assert.match(types, /TimerVisualTickPayload/);
});

test('timer diagnostics stay env-gated and keep anomaly thresholds explicit', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const hooks = [
    readText('src/renderer/hooks.ts'),
    readText('src/renderer/hooks/live-run-timer.ts')
  ].join('\n');
  const helper = readText('src/main/timer-diagnostics-log.ts');
  const overlay = [
    readText('src/renderer/pages/OverlayPage.tsx'),
    readText('src/renderer/overlay/OverlayTimerText.tsx')
  ].join('\n');
  const visualHook = hooks.slice(hooks.indexOf('export function useLiveRunTimerText'));

  assert.match(preload, /POE2_TIMER_DIAGNOSTICS/);
  assert.match(main, /app:timer-diagnostics/);
  assert.match(main, /timer-diagnostics-enabled/);
  assert.match(main, /TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS\s*=\s*500/);
  assert.match(hooks, /TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS\s*=\s*500/);
  assert.match(hooks, /TIMER_DIAGNOSTICS_DISPLAY_JUMP_THRESHOLD_MS\s*=\s*1500/);
  assert.match(hooks, /TIMER_DIAGNOSTICS_VISUAL_UPDATE_DELAY_THRESHOLD_MS\s*=\s*1200/);
  assert.match(hooks, /TIMER_DIAGNOSTICS_VISUAL_STALE_THRESHOLD_MS\s*=\s*1500/);
  assert.match(hooks, /timer-diagnostics-enabled/);
  assert.match(hooks, /timer-visual-diagnostics-ready/);
  assert.match(hooks, /timer-visual-update-delay/);
  assert.match(hooks, /timer-visual-display-jump/);
  assert.match(hooks, /timer-visual-elapsed-backwards/);
  assert.match(visualHook, /timer-renderer-mount/);
  assert.match(visualHook, /timer-renderer-unmount/);
  assert.match(visualHook, /const statusChanged/);
  assert.match(visualHook, /Start\/resume\/reset\/finish transitions intentionally reset/);
  assert.match(visualHook, /if \(!shouldTick\) \{/);
  assert.doesNotMatch(visualHook, /if \(!shouldTick \|\| usesExternalVisualTick\)/);
  assert.match(overlay, /timer-only-run-time-text/);
  assert.match(overlay, /timer-only-act-time-text/);
  assert.match(overlay, /overlay-run-time-text/);
  assert.match(overlay, /overlay-act-time-text/);
  assert.match(helper, /timer-diagnostics\.log/);
  assert.match(helper, /process\.env\[TIMER_DIAGNOSTICS_ENV_FLAG\]\s*===\s*'1'/);
});

test('overlay Windows compositor compatibility mode is finalized without obsolete env experiments', () => {
  const main = readMainProcessSource();
  const startup = readText('src/main/electron-startup.ts');
  const preload = readText('src/main/preload.ts');
  const hooks = readText('src/renderer/hooks.ts');
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const types = readText('src/shared/types.ts');

  assert.match(startup, /DIRECT_COMPOSITION_COMPAT_ENABLED\s*=\s*process\.platform\s*===\s*'win32'/);
  assert.match(startup, /disable-direct-composition/);
  assert.match(startup, /disable-direct-composition-video-overlays/);
  assert.match(main, /overlay-direct-composition-compat-enabled/);
  assert.match(types, /overlay-direct-composition-compat-enabled/);

  assert.match(main, /transparent:\s*true/);
  assert.match(main, /backgroundColor:\s*'#00000000'/);
  assert.match(main, /setOpacity\(this\.config\.overlayOpacity\)/);

  const combined = [main, startup, preload, hooks, overlay, types].join('\n');
  assert.doesNotMatch(combined, /POE2_DISABLE_DIRECT_COMPOSITION_TEST/);
  assert.doesNotMatch(combined, /POE2_OVERLAY_OPAQUE_TEST/);
  assert.doesNotMatch(combined, /POE2_OVERLAY_RENDER_KEEPALIVE/);
  assert.doesNotMatch(combined, /overlay-opaque-test-enabled/);
  assert.doesNotMatch(combined, /overlay-render-keepalive/);
  assert.doesNotMatch(combined, /isOverlayRenderKeepAliveEnabled/);
  assert.doesNotMatch(combined, /useOverlayRenderKeepAlive/);
});

test('timer diagnostics IPC is registered before the overlay renderer can emit startup events', () => {
  const main = readMainProcessSource();
  const registerIpcIndex = main.indexOf('this.registerIpc();');
  const createOverlayWindowIndex = main.indexOf('this.createOverlayWindow();');

  assert.notEqual(registerIpcIndex, -1);
  assert.notEqual(createOverlayWindowIndex, -1);
  assert.ok(registerIpcIndex < createOverlayWindowIndex);
});

test('no forbidden performance hacks are reintroduced', () => {
  const source = [
    readMainProcessSource(),
    readText('src/main/preload.ts'),
    readText('src/renderer/pages/OverlayPage.tsx')
  ].join('\n');

  assert.doesNotMatch(source, /powerSaveBlocker/);
  assert.doesNotMatch(source, /setPriority\s*\(/);
  assert.doesNotMatch(source, /\[Perf\].*(priority|power save)/i);
});

test('overlay supports full left-click drag with an icon-only lock toggle', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const drag = readText('src/shared/overlay-drag.ts');
  const preload = readText('src/main/preload.ts');
  const styles = readRendererStyles();
  const types = readText('src/shared/types.ts');
  const lock = readText('src/renderer/overlay-lock.ts');

  assert.match(overlay, /getOverlayBounds/);
  assert.match(overlay, /setOverlayPosition/);
  assert.match(overlay, /startMouseScreenX/);
  assert.match(overlay, /startWindowX/);
  assert.match(overlay, /latestMouseScreenX - state\.startMouseScreenX/);
  assert.match(overlay, /latestMouseScreenY - state\.startMouseScreenY/);
  assert.match(overlay, /shouldStartOverlayDrag/);
  assert.match(overlay, /overlayMovementLockedRef\.current/);
  assert.match(preload, /getOverlayBounds/);
  assert.match(preload, /setOverlayPosition/);
  assert.match(types, /getOverlayBounds/);
  assert.match(types, /setOverlayPosition/);
  assert.doesNotMatch(overlay, /clientX/);
  assert.doesNotMatch(overlay, /clientY/);
  assert.doesNotMatch(overlay, /outerWidth/);
  assert.doesNotMatch(overlay, /outerHeight/);
  assert.match(drag, /button !== 0/);
  assert.match(drag, /button/);
  assert.match(drag, /resize-grip/);
  assert.doesNotMatch(drag, /window-drag-strip/);
  assert.match(overlay, /window-drag-strip/);
  assert.doesNotMatch(overlay, /Зажми ЛКМ в любой свободной части оверлея/);
  assert.doesNotMatch(overlay, /Оверлей закреплён/);
  assert.match(overlay, /overlay-lock-icon-button/);
  assert.match(overlay, /getOverlayLockButtonIcon/);
  assert.match(overlay, /toggleOverlayMovementLock/);
  assert.match(overlay, /getResizeGripClassName/);
  assert.match(lock, /'🔓'/);
  assert.match(lock, /'🔒'/);
  assert.match(styles, /overlay-lock-icon-button/);
  assert.match(styles, /resize-grip\.is-disabled/);
  assert.doesNotMatch(overlay, /unlockDragGuardActiveRef/);
  assert.doesNotMatch(overlay, /getWindowDragStripClassName/);
});



test('overlay drag suspends adaptive auto-resize to avoid high-DPI window growth', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const types = readText('src/shared/types.ts');

  assert.match(overlay, /suspendAdaptiveOverlayHeight/);
  assert.match(overlay, /isAdaptiveOverlayHeightSuspended/);
  assert.match(overlay, /setOverlayAutoResizeSuspended/);
  assert.match(overlay, /setOverlayDragActive/);
  assert.match(main, /app:set-overlay-auto-resize-suspended/);
  assert.match(main, /app:set-overlay-drag-active/);
  assert.match(main, /overlayAutoResizeSuspendedUntil/);
  assert.match(preload, /setOverlayAutoResizeSuspended/);
  assert.match(preload, /setOverlayDragActive/);
  assert.match(types, /setOverlayAutoResizeSuspended/);
  assert.match(types, /setOverlayDragActive/);
});

test('main overlay no longer shows old F9/F10 hint text', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  assert.doesNotMatch(overlay, /РџРѕРґСЂРѕР±РЅРѕСЃС‚Рё:\s*F9\s*В·\s*F10 СЃРІРµСЂРЅСѓС‚СЊ/);
  assert.doesNotMatch(overlay, /F10 СЃРІРµСЂРЅСѓС‚СЊ/);
});

test('unknown/no-guide zones keep act context available for act timer display', () => {
  const main = readMainProcessSource();
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  assert.match(main, /inferActHintFromInternalAreaId/);
  assert.match(main, /lastGameplayAct/);
  assert.match(overlay, /currentZone\.actHint/);
  assert.match(overlay, /lastGameplayAct/);
});
