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

  assert.match(main, /TIMER_VISUAL_HEARTBEAT_MS\s*=\s*250/);
  assert.match(main, /timer:visual-tick/);
  assert.match(main, /startTimerVisualHeartbeat/);
  assert.match(preload, /onTimerVisualTick/);
  assert.match(preload, /timer:visual-tick/);
  assert.match(types, /TimerVisualTickPayload/);
});

test('timer diagnostics stay env-gated and keep anomaly thresholds explicit', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const hooks = readText('src/renderer/hooks.ts');
  const helper = readText('src/main/timer-diagnostics-log.ts');
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const visualHook = hooks.slice(hooks.indexOf('export function useLiveRunTimerText'));

  assert.match(preload, /POE2_TIMER_DIAGNOSTICS/);
  assert.match(main, /app:timer-diagnostics/);
  assert.match(main, /timer-diagnostics-enabled/);
  assert.match(main, /TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS\s*=\s*250/);
  assert.match(hooks, /TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS\s*=\s*250/);
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

test('snapshot updates use the shared render scheduler with a timeout fallback', () => {
  const hooks = readText('src/renderer/hooks.ts');
  const extractedHook = readText('src/renderer/hooks/app-snapshot.ts');
  const scheduler = readText('src/renderer/render-scheduler.ts');
  const diagnostics = readText('src/renderer/render-diagnostics.ts');
  const types = readText('src/shared/types.ts');
  const main = readMainProcessSource();
  const snapshotHook = hooks.slice(
    hooks.indexOf('export function useAppSnapshot'),
    hooks.indexOf('export function useLiveNow')
  );

  for (const source of [snapshotHook, extractedHook]) {
    assert.match(source, /pendingRenderTask/);
    assert.match(source, /clearPendingFlush/);
    assert.match(source, /scheduleOverlayRenderCommit/);
    assert.match(source, /fallbackMs:\s*16/);
    assert.match(source, /overlay-render-scheduler-ready/);
    assert.match(source, /overlay-render-commit-delay/);
  }

  assert.match(scheduler, /requestAnimationFrame/);
  assert.match(scheduler, /setTimeout/);
  assert.match(scheduler, /timeout-fallback/);
  assert.match(diagnostics, /RENDER_DIAGNOSTICS_DELAY_THRESHOLD_MS\s*=\s*64/);
  assert.match(types, /overlay-render-scheduler-ready/);
  assert.match(types, /overlay-render-commit-delay/);
  assert.match(main, /renderDelayMs/);
  assert.match(main, /BROADCAST_THROTTLE_MS\s*=\s*32/);
});


test('timer text updates are routed through the shared render scheduler', () => {
  const hooks = readText('src/renderer/hooks.ts');
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const visualHook = hooks.slice(hooks.indexOf('export function useLiveRunTimerText'));

  assert.match(visualHook, /schedulePublishText/);
  assert.match(visualHook, /timer-text:.*renderSource/);
  assert.match(visualHook, /main-visual-heartbeat/);
  assert.match(visualHook, /renderer-local-timeout/);
  assert.match(visualHook, /snapshot-or-timer-state/);
  assert.match(visualHook, /rendererVisualTickCountRef/);
  assert.match(visualHook, /renderCommitCount/);
  assert.match(visualHook, /fallbackMs:\s*16/);
  assert.match(overlay, /adaptive-overlay-height/);
  assert.match(overlay, /scheduleOverlayRenderCommit/);
  assert.match(overlay, /fallbackMs:\s*16/);
});

test('timer diagnostics IPC is registered before the overlay renderer can emit startup events', () => {
  const main = readMainProcessSource();
  const registerIpcIndex = main.indexOf('this.registerIpc();');
  const createOverlayWindowIndex = main.indexOf('this.createOverlayWindow();');

  assert.notEqual(registerIpcIndex, -1);
  assert.notEqual(createOverlayWindowIndex, -1);
  assert.ok(registerIpcIndex < createOverlayWindowIndex);
});


test('real-time priority remains opt-in and is controlled from settings', () => {
  const main = readMainProcessSource();
  const performance = readText('src/main/app-performance-priority.ts');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const defaults = readText('src/shared/defaults.ts');
  const configStore = readText('src/main/services/config-store.ts');
  const translations = readText('src/i18n/translations.ts');

  assert.match(defaults, /realtimePriorityEnabled:\s*false/);
  assert.match(configStore, /safeBoolean\(rawConfig\.realtimePriorityEnabled/);
  assert.match(configStore, /patch\.realtimePriorityEnabled/);
  assert.match(settingsPage, /checked=\{config\.realtimePriorityEnabled\}/);
  assert.match(settingsPage, /realtimePriorityEnabled:\s*event\.target\.checked/);
  assert.match(translations, /Экстремальный режим отрисовки/);
  assert.match(translations, /Extreme rendering mode/);
  assert.match(main, /scheduleRealtimePriorityApply\(this\.config\.realtimePriorityEnabled\)/);
  assert.match(main, /previousRealtimePriorityEnabled/);
  assert.match(performance, /POE2_TARGET_PROCESS_PATH/);
  assert.match(performance, /POE2_TARGET_PRIORITY_CLASS/);
  assert.match(performance, /RealTime/);
  assert.match(performance, /Normal/);
  assert.match(performance, /process\.platform !== 'win32'/);
});

test('overlay visual effects can be disabled independently from global FX intensity', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const defaults = readText('src/shared/defaults.ts');
  const configStore = readText('src/main/services/config-store.ts');
  const translations = readText('src/i18n/translations.ts');

  assert.match(defaults, /overlayEffectsEnabled:\s*true/);
  assert.match(configStore, /safeBoolean\(rawConfig\.overlayEffectsEnabled/);
  assert.match(configStore, /patch\.overlayEffectsEnabled/);
  assert.match(settingsPage, /checked=\{config\.overlayEffectsEnabled\}/);
  assert.match(settingsPage, /overlayEffectsEnabled:\s*event\.target\.checked/);
  assert.match(overlay, /config\.overlayEffectsEnabled\s*\?\s*`fx-\$\{config\.visualFxIntensity\}`\s*:\s*'fx-off'/);
  assert.match(overlay, /!\s*config\.overlayEffectsEnabled/);
  assert.match(translations, /Эффекты оверлея/);
  assert.match(translations, /Overlay effects/);
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

test('secondary app windows share smooth show/focus handling', () => {
  const controller = readText('src/main/app-window-controller.ts');

  assert.match(controller, /function showWindowWhenReady/);
  assert.match(controller, /webContents\.isLoading\(\)/);
  assert.match(controller, /did-finish-load/);
  assert.match(controller, /did-fail-load/);
  assert.doesNotMatch(
    controller,
    /this\.(settings|companion|info|community|support|report)Window\.show\(\);\s*this\.\1Window\.focus\(\);/
  );
});

test('default motion avoids continuous compositor-heavy ambient animations', () => {
  const fxControls = readText('src/renderer/styles/28-fx-controls-debug.css');
  const modeTransitions = readText('src/renderer/styles/32-overlay-mode-transitions.css');

  assert.match(fxControls, /\.overlay-page\.fx-normal:not\(\.overlay-page-timer-only\):not\(\.is-overlay-collapsed\) \.overlay-shell/);
  assert.match(fxControls, /poe2-panel-enter var\(--motion-medium, 180ms\)/);
  assert.match(fxControls, /\.companion-page\.fx-normal \.route-overview-card\.status-current:not\(\.is-focus-flash\)/);
  assert.match(fxControls, /\.companion-page\.fx-subtle \.bonuses-tab-layout \.bonus-row\.is-pending/);
  assert.doesNotMatch(modeTransitions, /will-change:\s*opacity,\s*transform,\s*filter/);

  for (const keyframeName of [
    'poe2-overlay-mode-enter-full',
    'poe2-overlay-mode-enter-compact',
    'poe2-overlay-mode-enter-collapsed'
  ]) {
    const keyframeStart = modeTransitions.indexOf(`@keyframes ${keyframeName}`);
    const nextKeyframe = modeTransitions.indexOf('@keyframes', keyframeStart + 1);
    const shellRule = modeTransitions.indexOf('.overlay-page.is-overlay-mode-transitioning .overlay-shell', keyframeStart);
    const keyframeEnd = nextKeyframe === -1 ? shellRule : Math.min(nextKeyframe, shellRule);
    const keyframeSource = modeTransitions.slice(keyframeStart, keyframeEnd);
    assert.doesNotMatch(keyframeSource, /filter:/);
  }
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
