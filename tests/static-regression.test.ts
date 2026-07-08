// @ts-nocheck
import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readMainProcessSource, readText } from './test-utils';

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
  const scheduler = readText('src/renderer/render-scheduler.ts');
  const diagnostics = readText('src/renderer/render-diagnostics.ts');
  const types = readText('src/shared/types.ts');
  const main = readMainProcessSource();
  const snapshotHook = hooks.slice(
    hooks.indexOf('export function useAppSnapshot'),
    hooks.indexOf('export function useLiveNow')
  );

  assert.match(snapshotHook, /pendingRenderTask/);
  assert.match(snapshotHook, /clearPendingFlush/);
  assert.match(snapshotHook, /scheduleOverlayRenderCommit/);
  assert.match(snapshotHook, /fallbackMs:\s*16/);
  assert.match(snapshotHook, /overlay-render-scheduler-ready/);
  assert.match(snapshotHook, /overlay-render-commit-delay/);

  assert.match(scheduler, /requestAnimationFrame/);
  assert.match(scheduler, /setTimeout/);
  assert.match(scheduler, /timeout-fallback/);
  assert.match(diagnostics, /RENDER_DIAGNOSTICS_DELAY_THRESHOLD_MS\s*=\s*64/);
  assert.match(types, /overlay-render-scheduler-ready/);
  assert.match(types, /overlay-render-commit-delay/);
  assert.match(main, /renderDelayMs/);
  assert.match(main, /BROADCAST_THROTTLE_MS\s*=\s*32/);
});

test('snapshot broadcast skips destroyed webContents before sending', () => {
  const stateController = readText('src/main/app-state-controller.ts');
  const flushState = stateController.slice(
    stateController.indexOf('export function runFlushBroadcastState'),
    stateController.indexOf('export function runBroadcastState')
  );

  assert.match(flushState, /!win\.isDestroyed\(\)/);
  assert.match(flushState, /!win\.webContents\.isDestroyed\(\)/);
  assert.match(flushState, /!win\.webContents\.isLoading\(\)/);
  assert.match(flushState, /webContents\.send\('app:state-changed'/);
});

test('window page routing uses html body markers before URL fallback', () => {
  const rendererMain = readText('src/renderer/main.tsx');
  const windowController = readText('src/main/app-window-controller.ts');

  assert.match(rendererMain, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(rendererMain, /params\.get\('page'\)/);
  assert.match(rendererMain, /window\.location\.pathname\.split\('\/'\)\.pop\(\)/);
  assert.match(rendererMain, /const bodyPage = getRendererPageCandidate\(document\.body\.dataset\.page\)/);
  assert.match(rendererMain, /return bodyPage \?\? getRendererPageFromLocation\(\) \?\? 'overlay'/);
  assert.match(windowController, /const pageSearch = `\?page=\$\{encodeURIComponent\(pageName\)\}`/);
  assert.match(windowController, /loadURL\(`\$\{devServerUrl\}\/\$\{pageName\}\.html\$\{pageSearch\}`\)/);
  assert.match(
    windowController,
    /loadFile\(resolveRuntimePath\('dist', `\$\{pageName\}\.html`\), \{ search: pageSearch \}\)/
  );
});

test('run timer snapshot sync tracks act split content changes', () => {
  const hooks = readText('src/renderer/hooks.ts');
  const runTimerHook = hooks.slice(
    hooks.indexOf('export function useRunTimerState'),
    hooks.indexOf('export function useLiveRunTimerDisplay')
  );

  assert.match(hooks, /function getRunTimerActSplitsSignature/);
  assert.match(runTimerHook, /runTimerActSplitsSignature/);
  assert.doesNotMatch(runTimerHook, /runTimer\?\.actSplits\.length/);
});

test('settings page memoizes repeated snapshot-derived option lists', () => {
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');

  assert.match(settingsPage, /import \{ useEffect, useMemo, useState/);
  assert.match(settingsPage, /const zoneOptions = useMemo\(/);
  assert.match(settingsPage, /\[snapshot\?\.guideEntries, language\]/);
  assert.match(settingsPage, /const settingsQuickLinks = useMemo\(/);
  assert.doesNotMatch(settingsPage, /const zoneOptions = snapshot\.guideEntries\.map/);
  assert.doesNotMatch(settingsPage, /const settingsQuickLinks = SETTINGS_QUICK_LINKS\.filter/);
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

test('town timer legacy surface stays intentionally disabled', () => {
  const timerController = readText('src/main/app-timer-controller.ts');
  const guideLogController = readText('src/main/app-guide-log-controller.ts');

  assert.match(timerController, /Town timer is intentionally disabled/);
  assert.match(timerController, /runGetCurrentTownElapsedMs[\s\S]*?return 0;/);
  assert.match(timerController, /runGetTotalTownElapsedMs[\s\S]*?return 0;/);
  assert.match(guideLogController, /Town timer removed/);
  assert.match(guideLogController, /Towns no longer close or pause the active gameplay zone timer/);
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

test('settings search keeps performance toggles under advanced grouping', () => {
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const settingsSearch = readText('src/renderer/settings-search.ts');
  const overlayStart = settingsPage.indexOf('id="settings-overlay"');
  const detailPanelStart = settingsPage.indexOf('id="settings-detail-panel"');
  const advancedStart = settingsPage.indexOf('id="settings-advanced"');
  const developerStart = settingsPage.indexOf('id="settings-developer"');

  assert.notEqual(overlayStart, -1);
  assert.notEqual(detailPanelStart, -1);
  assert.notEqual(advancedStart, -1);
  assert.notEqual(developerStart, -1);
  assert.doesNotMatch(settingsPage.slice(overlayStart, detailPanelStart), /realtimePriorityEnabled/);
  assert.match(settingsPage.slice(advancedStart, developerStart), /realtimePriorityEnabled/);
  assert.match(settingsPage, /getSettingsSearchResult\(settingsSearchQuery, SHOW_DEVELOPER_SETTINGS\)/);
  assert.match(settingsSearch, /settings-log-file/);
  assert.match(settingsSearch, /settings-advanced/);
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

test('app theme is persisted and available in overlay and settings', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const companionPage = readText('src/renderer/pages/CompanionPage.tsx');
  const defaults = readText('src/shared/defaults.ts');
  const types = readText('src/shared/types.ts');
  const configStore = readText('src/main/services/config-store.ts');
  const stylesIndex = readText('src/renderer/styles.css');
  const styleCheck = readText('scripts/check-style-partials.cjs');
  const themeStyles = readText('src/renderer/styles/35-dark-fantasy-theme.css');
  const translations = readText('src/i18n/translations.ts');

  assert.match(types, /export type AppTheme = 'classic' \| 'dark_fantasy'/);
  assert.match(defaults, /theme:\s*'classic'/);
  assert.match(defaults, /themePreferencePrompted:\s*false/);
  assert.match(configStore, /normalizeAppTheme\(rawConfig\.theme\)/);
  assert.match(configStore, /safeBoolean\(rawConfig\.themePreferencePrompted/);
  assert.match(configStore, /patch\.theme/);
  assert.match(configStore, /patch\.themePreferencePrompted/);
  assert.match(overlay, /overlay-theme-preference-card/);
  assert.match(overlay, /themePreferencePrompted:\s*true/);
  assert.doesNotMatch(overlay, /overlay-theme-icon-button/);
  assert.match(settingsPage, /app-theme-choice/);
  assert.match(settingsPage, /updateSettings\(\{ theme, themePreferencePrompted:\s*true \}\)/);
  assert.match(companionPage, /getAppThemeClassName\(config\.theme\)/);
  assert.match(stylesIndex, /35-dark-fantasy-theme\.css/);
  assert.match(styleCheck, /35-dark-fantasy-theme\.css/);
  assert.match(themeStyles, /\.theme-dark-fantasy/);
  assert.match(themeStyles, /\.theme-dark-fantasy\.overlay-page\s*\{\s*background:\s*transparent !important;/);
  assert.match(themeStyles, /overlay-shell::after[\s\S]*content:\s*none !important/);
  assert.match(themeStyles, /\.theme-dark-fantasy\.overlay-page \.resize-grip:not\(\.is-disabled\)/);
  assert.match(translations, /Тёмное фэнтези/);
  assert.match(translations, /Выбери тему/);
  assert.match(translations, /Dark fantasy/);
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

test('quality gates keep source reachability and release artifact checks wired', () => {
  const packageJson = readJson('package.json') as any;
  const mainCheck = readText('scripts/check-main-modules.cjs');
  const rendererCheck = readText('scripts/check-renderer-source-modules.cjs');
  const releaseCheck = readText('scripts/check-release-files.cjs');

  assert.match(packageJson.scripts['test:regression'], /check:main-modules/);
  assert.match(packageJson.scripts['test:regression'], /check:renderer-modules/);
  assert.match(packageJson.scripts['dist:checked'], /check:release/);
  assert.deepEqual(
    packageJson.scripts['dist:checked'].split('&&').map((step: string) => step.trim()),
    ['npm run clean:release', 'npm run build:checked', 'electron-builder', 'npm run check:release']
  );
  assert.match(mainCheck, /collectReachableSources/);
  assert.match(mainCheck, /Unreachable main-process source files/);
  assert.match(mainCheck, /page-model/i);
  assert.match(rendererCheck, /src\/renderer\/main\.tsx/);
  assert.match(rendererCheck, /is not reachable from src\/renderer\/main\.tsx/);
  assert.match(rendererCheck, /page-model/i);
  assert.match(releaseCheck, /packageJson\.version/);
  assert.match(releaseCheck, /expectedExeName/);
  assert.match(releaseCheck, /latestFileEntries/);
  assert.match(releaseCheck, /duplicate installer entries/);
  assert.match(releaseCheck, /file entry sha512 does not match top-level sha512/);
  assert.match(releaseCheck, /latest\.yml sha512 does not match/);
  assert.match(releaseCheck, /latest\.yml installer size/);
});

test('secondary app windows share smooth show/focus handling', () => {
  const controller = readText('src/main/app-window-controller.ts');

  assert.match(controller, /function showWindowWhenReady/);
  assert.match(controller, /webContents\.isLoading\(\)/);
  assert.match(controller, /did-finish-load/);
  assert.match(controller, /did-fail-load/);
  assert.match(controller, /afterShow\?:\s*\(\)\s*=>\s*void/);
  assert.match(controller, /afterShow:\s*\(\)\s*=>\s*this\.broadcastState\(\)/);
  assert.doesNotMatch(
    controller,
    /this\.(settings|companion|info|community|support|report)Window\.show\(\);\s*this\.\1Window\.focus\(\);/
  );
});

test('hidden windows and unchanged bounds do not trigger unnecessary smoothness work', () => {
  const stateController = readText('src/main/app-state-controller.ts');
  const boundsController = readText('src/main/app-overlay-bounds-controller.ts');
  const windowController = readText('src/main/app-window-controller.ts');
  const ipcHandlers = readText('src/main/app-ipc-handlers.ts');
  const configStore = readText('src/main/services/config-store.ts');
  const main = readText('src/main/main.ts');
  const overlaySnapshotBuilder = stateController.slice(
    stateController.indexOf('export function runGetOverlaySnapshot'),
    stateController.indexOf('export function runGetUiPreferencesSnapshot')
  );

  assert.match(stateController, /function runGetOverlaySnapshot/);
  assert.doesNotMatch(overlaySnapshotBuilder, /guideEntries/);
  assert.match(stateController, /const overlayTargets = targetWindows\.filter/);
  assert.match(stateController, /const appTargets = targetWindows\.filter/);
  assert.match(main, /getOverlaySnapshot\(\)/);
  assert.match(stateController, /win\.isVisible\(\)/);
  assert.match(stateController, /!win\.webContents\.isLoading\(\)/);
  assert.match(stateController, /if \(targetWindows\.length === 0\)/);
  assert.match(windowController, /showInactive\(\);\s*this\.broadcastState\(\);/);
  assert.match(boundsController, /areOverlayBoundsEqual\(currentBounds, normalizedBounds\)/);
  assert.match(boundsController, /return this\.persistOverlayBoundsForState/);
  assert.match(boundsController, /if \(changed\) \{\s*this\.broadcastState\(\);/);
  assert.match(boundsController, /areOverlayBoundsEqual\(this\.config\.companionBounds, bounds\)/);
  assert.match(ipcHandlers, /areOverlayBoundsEqual\(currentBounds, nextBounds\)/);
  assert.match(ipcHandlers, /const changed = this\.persistOverlayBoundsForCurrentState/);
  assert.match(configStore, /JSON\.stringify\(nextConfig\) === JSON\.stringify\(this\.config\)/);
});

test('overlay renderer memoizes heavy derived view state and throttles layout IPC', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const types = readText('src/shared/types.ts');

  assert.match(overlay, /useMemo/);
  assert.match(overlay, /const overlayDerived = useMemo/);
  assert.match(overlay, /getImportantOverlayLines\(snapshot, language\)/);
  assert.match(overlay, /getCurrentZoneCampaignBonuses\(snapshot\)/);
  assert.match(overlay, /getOverlayUpcomingReminders\(snapshot, language\)/);
  assert.match(overlay, /lastAdaptiveOverlayHeightRequestRef/);
  assert.match(overlay, /lastAdaptiveOverlaySuspensionSyncAtRef/);
  assert.match(overlay, /now - lastAdaptiveOverlaySuspensionSyncAtRef\.current > 500/);
  assert.match(overlay, /event:\s*'overlay-render-frequency'/);
  assert.match(types, /'overlay-render-frequency'/);
});

test('companion route tab memoizes route card derived labels outside render map', () => {
  const companion = readText('src/renderer/pages/CompanionPage.tsx');
  const helpers = readText('src/renderer/companion-helpers.ts');
  const routeCardModelsStart = companion.indexOf('{visibleRouteCardModels.map');
  const routeCardModelsEnd = companion.indexOf('const latestActRow', routeCardModelsStart);
  const routeCardRender = companion.slice(routeCardModelsStart, routeCardModelsEnd);
  const routeActsMemoStart = companion.indexOf('const routeActs = useMemo');
  const routeActsMemoEnd = companion.indexOf('const selectedRouteAct', routeActsMemoStart);
  const routeActsMemo = companion.slice(routeActsMemoStart, routeActsMemoEnd);

  assert.notEqual(routeCardModelsStart, -1);
  assert.notEqual(routeCardModelsEnd, -1);
  assert.match(companion, /function getRouteCardModels/);
  assert.match(companion, /const routeCardModels = useMemo/);
  assert.match(companion, /const visibleRouteCardModels = useMemo/);
  assert.match(companion, /getRequiredRewardLabelsForZone\(entry\.guide, snapshot, language\)/);
  assert.doesNotMatch(routeCardRender, /getRequiredRewardLabelsForZone/);
  assert.doesNotMatch(routeCardRender, /getRouteFallbackLabels/);
  assert.doesNotMatch(routeCardRender, /getGuideView\(entry\.guide/);
  assert.match(routeCardRender, /model\.visibleRouteLabels/);
  assert.match(routeCardRender, /model\.recommendedLevelLabel/);
  assert.doesNotMatch(routeActsMemo, /currentZone\.actHint/);
  assert.doesNotMatch(routeActsMemo, /currentGuideEntry\?\.act/);
  assert.match(helpers, /const visitedZoneIds = new Set\(snapshot\.config\.visitedZones\.map/);
  assert.match(helpers, /getRouteZoneStatus\(guide, snapshot, visitedZoneIds\)/);
});

test('companion route tab keeps search and filters in helper-backed memoized flow', () => {
  const companion = readText('src/renderer/pages/CompanionPage.tsx');
  const routeControls = readText('src/renderer/RouteTabControls.tsx');
  const routeSearch = readText('src/renderer/route-tab-search.ts');
  const routeBonuses = readText('src/renderer/RouteCardBonuses.tsx');

  assert.match(companion, /RouteTabControls/);
  assert.match(companion, /filterRouteCards\(routeCardModels/);
  assert.match(companion, /getRouteFilterEmptyText/);
  assert.match(companion, /getRouteCampaignBonusModels\(entry\.guide, snapshot, language\)/);
  assert.doesNotMatch(companion, /const hasBonusRewards = entry\.rewardItems\.length > 0/);
  assert.match(routeControls, /getRouteFilterSummary/);
  assert.match(routeControls, /getRouteJumpDisabledReason/);
  assert.match(routeControls, /routeText\('quickJump', language\)/);
  assert.match(routeSearch, /current_zone/);
  assert.match(routeSearch, /hasBonusRewards/);
  assert.match(routeBonuses, /route-card-bonus-panel/);
  assert.match(routeBonuses, /routeBonusNotTaken/);
  assert.doesNotMatch(routeSearch, /'current_next'/);
  assert.doesNotMatch(routeSearch, /'missed',/);
  assert.doesNotMatch(routeControls, /canJumpNext|canJumpMissed|onJumpNext|onJumpMissed/);
  assert.doesNotMatch(routeControls, /routeText\('next'|routeText\('missed'/);
});

test('companion bonus manual marks keep visible source-specific feedback', () => {
  const companion = readText('src/renderer/pages/CompanionPage.tsx');
  const provenance = readText('src/shared/campaign-bonus-provenance.ts');
  const translations = readText('src/i18n/translations.ts');
  const cohesion = readText('src/renderer/styles/36-companion-cohesion.css');

  assert.match(companion, /getCampaignBonusProvenanceView\(progress, language\)/);
  assert.match(companion, /className=\{`bonus-detected-line is-\$\{provenance\.source\}`\}/);
  assert.match(provenance, /log_reward_line/);
  assert.match(translations, /Detected from reward line/);
  assert.match(cohesion, /\.bonus-detected-line\.is-manual/);
  assert.match(cohesion, /\.bonus-detected-line\.is-log_reward_line/);
  assert.match(cohesion, /\.bonus-detected-line\.is-context/);
  assert.match(cohesion, /\.bonus-detected-line\.is-unknown/);
});

test('companion run history details button opens an inline detail card', () => {
  const detailPanel = readText('src/renderer/RunHistoryDetailPanel.tsx');
  const companion = readText('src/renderer/pages/CompanionPage.tsx');

  assert.match(detailPanel, /const \[isDetailOpen,\s*setIsDetailOpen\] = useState\(false\)/);
  assert.match(detailPanel, /const openRunDetails = \(runId: string\)/);
  assert.match(detailPanel, /setPendingRunId\(runId\);\s*setSelectedRunId\(null\);\s*setIsDetailOpen\(true\);/);
  assert.match(detailPanel, /window\.setTimeout\(\(\) => \{\s*setSelectedRunId\(runId\);/);
  assert.match(detailPanel, /<RunHistoryDetailLoading language=\{language\} \/>/);
  assert.match(detailPanel, /<RunHistoryDetailCard model=\{model\} language=\{language\} \/>/);
  assert.match(detailPanel, /export const RunHistoryDetailPanel = memo\(RunHistoryDetailPanelInner\)/);
  assert.doesNotMatch(detailPanel, /getRunHistorySignature\(previous\.history\)/);
  assert.match(companion, /stableRunHistoryRef/);
  assert.match(companion, /getRunHistorySignature\(rawRunHistory\)/);
  assert.match(companion, /const restoreSavedRun = useCallback/);
  assert.match(companion, /const deleteSavedRun = useCallback/);
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
