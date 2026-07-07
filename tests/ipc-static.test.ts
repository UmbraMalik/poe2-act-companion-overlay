import test from 'node:test';
import assert from 'node:assert/strict';
import { readMainProcessSource, readText } from './helpers/loadJson';

test('preload exposes only specific safe IPC APIs and not the raw ipcRenderer', () => {
  const preload = readText('src/main/preload.ts');

  for (const channel of [
    'app:get-overlay-snapshot',
    'app:get-ui-preferences-snapshot',
    'app:update-settings',
    'app:open-report-issue',
    'app:open-external',
    'app:get-overlay-bounds',
    'app:set-overlay-position',
    'app:timer-diagnostics',
    'app:ui-preferences-changed',
    'timer:visual-tick'
  ]) {
    assert.match(preload, new RegExp(channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(preload, /isTimerDiagnosticsEnabled/);
  assert.match(preload, /sendTimerDiagnostics/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('poe2Overlay', api\)/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer/);
});

test('overlay initial snapshot uses trimmed overlay IPC while app pages keep full snapshot', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const types = readText('src/shared/types.ts');
  const hooks = readText('src/renderer/hooks.ts');
  const overlayPage = readText('src/renderer/pages/OverlayPage.tsx');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const companionPage = readText('src/renderer/pages/CompanionPage.tsx');
  const useI18n = readText('src/renderer/useI18n.ts');
  const snapshotHook = hooks.slice(
    hooks.indexOf('export interface UseAppSnapshotOptions'),
    hooks.indexOf('export function useLiveNow')
  );

  assert.match(main, /ipcMain\.handle\('app:get-overlay-snapshot', async \(\) => this\.getOverlaySnapshot\(\)\)/);
  assert.match(preload, /getOverlaySnapshot: \(\) => ipcRenderer\.invoke\('app:get-overlay-snapshot'\)/);
  assert.match(types, /export type OverlaySnapshot = Omit/);
  assert.match(types, /getOverlaySnapshot: \(\) => Promise<OverlaySnapshot>/);
  assert.match(snapshotHook, /initialSnapshot\?: 'full' \| 'overlay'/);
  assert.match(snapshotHook, /initialSnapshot === 'overlay'/);
  assert.match(snapshotHook, /window\.poe2Overlay\.getOverlaySnapshot\(\)/);
  assert.match(snapshotHook, /window\.poe2Overlay\.getSnapshot\(\)/);
  assert.match(overlayPage, /useAppSnapshot\(\{\s*initialSnapshot:\s*'overlay'\s*\}\)/);
  assert.match(settingsPage, /const snapshot = useAppSnapshot\(\);/);
  assert.match(companionPage, /const snapshot = useAppSnapshot\(\);/);
  assert.match(useI18n, /const shouldReadSnapshot = arguments\.length === 0/);
  assert.match(useI18n, /useAppSnapshot\(\{\s*enabled:\s*shouldReadSnapshot\s*\}\)/);
});

test('overlay snapshot omits unused top-level fields while full snapshot keeps them', () => {
  const stateController = readText('src/main/app-state-controller.ts');
  const types = readText('src/shared/types.ts');
  const fullSnapshotBuilder = stateController.slice(
    stateController.indexOf('export function runGetSnapshot'),
    stateController.indexOf('export function runGetOverlaySnapshot')
  );
  const overlaySnapshotBuilder = stateController.slice(
    stateController.indexOf('export function runGetOverlaySnapshot'),
    stateController.indexOf('export function runGetUiPreferencesSnapshot')
  );

  assert.match(types, /'currentZoneProgress' \| 'currentChecklist' \| 'guideEntries' \| 'activeLevelReminder'/);

  for (const field of ['currentZoneProgress', 'currentChecklist', 'guideEntries', 'activeLevelReminder']) {
    assert.match(fullSnapshotBuilder, new RegExp(`${field}[,:]`));
    assert.doesNotMatch(overlaySnapshotBuilder, new RegExp(`${field}[,:]`));
  }

  for (const retainedField of ['currentGuideEntry', 'vendorCheckpoints', 'powerSpikes', 'campaignBonuses']) {
    assert.match(overlaySnapshotBuilder, new RegExp(`${retainedField}[,:]`));
  }
});

test('static info community support pages use lightweight UI preferences snapshots', () => {
  const main = readMainProcessSource();
  const stateController = readText('src/main/app-state-controller.ts');
  const preload = readText('src/main/preload.ts');
  const types = readText('src/shared/types.ts');
  const hooks = readText('src/renderer/hooks.ts');
  const infoPage = readText('src/renderer/pages/InfoPage.tsx');
  const communityPage = readText('src/renderer/pages/CommunityPage.tsx');
  const supportPage = readText('src/renderer/pages/SupportPage.tsx');
  const reportPage = readText('src/renderer/pages/ReportIssuePage.tsx');
  const uiSnapshotBuilder = stateController.slice(
    stateController.indexOf('export function runGetUiPreferencesSnapshot'),
    stateController.indexOf('export function runClearBroadcastTimer')
  );
  const flushState = stateController.slice(
    stateController.indexOf('export function runFlushBroadcastState'),
    stateController.indexOf('export function runBroadcastState')
  );
  const uiSnapshotHook = hooks.slice(
    hooks.indexOf('export function useUiPreferencesSnapshot'),
    hooks.indexOf('export function useLiveNow')
  );

  assert.match(main, /ipcMain\.handle\('app:get-ui-preferences-snapshot', async \(\) => this\.getUiPreferencesSnapshot\(\)\)/);
  assert.match(preload, /getUiPreferencesSnapshot: \(\) => ipcRenderer\.invoke\('app:get-ui-preferences-snapshot'\)/);
  assert.match(preload, /onUiPreferencesChanged: \(callback: \(snapshot: UiPreferencesSnapshot\) => void\) =>/);
  assert.match(types, /export interface UiPreferencesSnapshot/);
  assert.match(types, /config: Pick<AppConfig, 'appLanguage' \| 'theme' \| 'visualFxIntensity'>;/);
  assert.match(types, /getUiPreferencesSnapshot: \(\) => Promise<UiPreferencesSnapshot>/);
  assert.match(types, /onUiPreferencesChanged: \(callback: \(snapshot: UiPreferencesSnapshot\) => void\) => \(\) => void/);

  assert.match(uiSnapshotHook, /window\.poe2Overlay\.getUiPreferencesSnapshot\(\)/);
  assert.match(uiSnapshotHook, /window\.poe2Overlay\.onUiPreferencesChanged/);
  assert.match(uiSnapshotHook, /getPreviewSnapshot\(\)/);
  assert.doesNotMatch(uiSnapshotHook, /window\.poe2Overlay\.getSnapshot\(\)/);
  assert.doesNotMatch(uiSnapshotHook, /window\.poe2Overlay\.onStateChanged/);

  for (const page of [infoPage, communityPage, supportPage]) {
    assert.match(page, /useUiPreferencesSnapshot\(\)/);
    assert.doesNotMatch(page, /useAppSnapshot/);
  }
  assert.match(reportPage, /useAppSnapshot\(\)/);

  assert.match(uiSnapshotBuilder, /appLanguage: this\.config\.appLanguage/);
  assert.match(uiSnapshotBuilder, /theme: this\.config\.theme/);
  assert.match(uiSnapshotBuilder, /visualFxIntensity: this\.config\.visualFxIntensity/);
  assert.doesNotMatch(uiSnapshotBuilder, /guideEntries/);
  assert.doesNotMatch(uiSnapshotBuilder, /campaignBonuses/);
  assert.doesNotMatch(uiSnapshotBuilder, /runtime/);

  assert.match(flushState, /const uiPreferencesTargets = targetWindows\.filter/);
  assert.match(flushState, /win === this\.infoWindow/);
  assert.match(flushState, /win === this\.communityWindow/);
  assert.match(flushState, /win === this\.supportWindow/);
  assert.match(flushState, /const uiPreferencesSnapshot = this\.getUiPreferencesSnapshot\(\)/);
  assert.match(flushState, /webContents\.send\('app:ui-preferences-changed', uiPreferencesSnapshot\)/);
});

test('main process keeps renderer windows isolated and guards shell.openExternal', () => {
  const main = readMainProcessSource();
  const environment = readText('src/main/app-environment.ts');
  const windowSecurity = readText('src/main/window-security.ts');

  assert.match(environment, /isAllowedExternalUrl/);
  assert.match(environment, /return isAllowedExternalUrl\(url\)/);
  assert.doesNotMatch(environment, /parsed\.protocol\s*===\s*'https:'\s*\|\|\s*parsed\.protocol\s*===\s*'http:'/);
  assert.match(main, /ipcMain\.handle\('app:open-external'/);
  assert.match(main, /if \(!isSafeExternalUrl\(url\)\)/);
  assert.match(windowSecurity, /contextIsolation:\s*true/);
  assert.match(windowSecurity, /nodeIntegration:\s*false/);
  assert.match(windowSecurity, /webSecurity:\s*true/);
  assert.match(windowSecurity, /setWindowOpenHandler/);
  assert.match(windowSecurity, /will-navigate/);
  assert.match(windowSecurity, /isSafeExternalUrl/);
  assert.match(windowSecurity, /devServerUrl/);
  assert.match(windowSecurity, /isDev/);
  assert.match(windowSecurity, /resolveRuntimePath\('dist'\)/);
  assert.match(windowSecurity, /Sandbox is not forced yet/);
  assert.match(main, /getSecureWebPreferences/);
  const browserWindowCreations = main.match(/new BrowserWindow\(/g)?.length ?? 0;
  const navigationGuardCalls = main.match(/attachWindowNavigationGuards\(/g)?.length ?? 0;
  assert.equal(navigationGuardCalls, browserWindowCreations);
  assert.doesNotMatch(main, /\bremote\b/);
  assert.doesNotMatch(main, /\beval\s*\(/);
  assert.doesNotMatch(main, /\bnew Function\b/);
});


test('overlay drag IPC routes absolute movement through the dragMove helper path without inline setBounds', () => {
  const main = readMainProcessSource();
  const overlayBounds = readText('src/main/overlay-window-bounds.ts');
  const handlerStart = main.indexOf("ipcMain.handle('app:set-overlay-position'");
  const handlerEnd = main.indexOf("ipcMain.handle('app:set-overlay-mode'", handlerStart);

  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);

  const moveHandler = main.slice(handlerStart, handlerEnd);

  assert.match(moveHandler, /applyOverlayWindowBounds\('dragMove'/);
  assert.match(moveHandler, /x:\s*nextX/);
  assert.match(moveHandler, /y:\s*nextY/);
  assert.match(moveHandler, /finiteRoundedNumber\(x,\s*currentBounds\.x\)/);
  assert.match(moveHandler, /finiteRoundedNumber\(y,\s*currentBounds\.y\)/);
  assert.doesNotMatch(moveHandler, /Number\(x\)\s*\|\|/);
  assert.doesNotMatch(moveHandler, /Number\(y\)\s*\|\|/);
  assert.doesNotMatch(moveHandler, /setBounds\(/);
  assert.match(overlayBounds, /Number\.isFinite\(numberValue\)/);
  assert.doesNotMatch(overlayBounds, /Number\(bounds\.x\)\s*\|\|/);
  assert.doesNotMatch(overlayBounds, /Number\(bounds\.y\)\s*\|\|/);
});

test('overlay geometry IPC returns compact booleans instead of full snapshots', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const types = readText('src/shared/types.ts');
  const overlayPage = readText('src/renderer/pages/OverlayPage.tsx');
  const resizeStart = main.indexOf("ipcMain.handle('app:resize-overlay'");
  const resizeEnd = main.indexOf("ipcMain.handle('app:set-overlay-auto-resize-suspended'", resizeStart);
  const heightStart = main.indexOf("ipcMain.handle('app:resize-overlay-height'");
  const heightEnd = main.indexOf("ipcMain.handle('app:set-overlay-position'", heightStart);

  assert.notEqual(resizeStart, -1);
  assert.notEqual(resizeEnd, -1);
  assert.notEqual(heightStart, -1);
  assert.notEqual(heightEnd, -1);

  const resizeHandler = main.slice(resizeStart, resizeEnd);
  const heightHandler = main.slice(heightStart, heightEnd);

  assert.doesNotMatch(resizeHandler, /getSnapshot\(/);
  assert.doesNotMatch(heightHandler, /getSnapshot\(/);
  assert.match(resizeHandler, /return false/);
  assert.match(resizeHandler, /return true/);
  assert.match(heightHandler, /return false/);
  assert.match(heightHandler, /return true/);
  assert.match(types, /resizeOverlay: \(width: number, height: number\) => Promise<boolean>/);
  assert.match(types, /resizeOverlayHeight: \(height: number, options\?: \{ force\?: boolean; allowBelowMinimum\?: boolean \}\) => Promise<boolean>/);
  assert.match(preload, /resizeOverlay: \(width: number, height: number\) =>\s*\n\s*ipcRenderer\.invoke\('app:resize-overlay', width, height\)/);
  assert.match(preload, /resizeOverlayHeight: \(height: number, options\?: \{ force\?: boolean; allowBelowMinimum\?: boolean \}\) =>\s*\n\s*ipcRenderer\.invoke\('app:resize-overlay-height', height, options\)/);
  assert.match(overlayPage, /resizeOverlay\(nextWidth, currentHeight\)\.then\(\(changed\)/);
  assert.match(overlayPage, /if \(changed\) \{/);
  assert.match(overlayPage, /resizeOverlayHeight\(nextHeight, \{ force, allowBelowMinimum \}\)\.catch\(\(\) => false\)/);
});

test('update settings IPC normalizes unknown renderer payloads before reading fields', () => {
  const main = readMainProcessSource();
  const handlerStart = main.indexOf("ipcMain.handle('app:update-settings'");
  const handlerEnd = main.indexOf("ipcMain.handle('app:simulate-zone'", handlerStart);

  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);
  assert.match(main, /function normalizeSettingsPatchInput\(value: unknown\): SettingsPatch/);

  const updateSettingsHandler = main.slice(handlerStart, handlerEnd);
  const normalizePatchIndex = updateSettingsHandler.indexOf('patch = normalizeSettingsPatchInput(patch)');
  const normalizeOverlayModeIndex = updateSettingsHandler.indexOf('patch = normalizeOverlayModeSettingsPatch(patch)');
  const firstPatchFieldReadIndex = updateSettingsHandler.search(
    /\bpatch\.(mainOverlaySettings|overlayDensity|overlayScale|overlayOpacity|companionAlwaysOnTop|realtimePriorityEnabled|hotkeys|manualHotkeysEnabled)/
  );

  assert.notEqual(normalizePatchIndex, -1);
  assert.notEqual(normalizeOverlayModeIndex, -1);
  assert.notEqual(firstPatchFieldReadIndex, -1);
  assert.ok(normalizePatchIndex < firstPatchFieldReadIndex);
  assert.ok(normalizeOverlayModeIndex < firstPatchFieldReadIndex);
  assert.match(main, /function isOverlayMode\(value: unknown\): value is OverlayMode/);
  assert.match(main, /value === 'full' \|\| value === 'timer_only'/);
});

test('dev log append IPC accepts bounded strings only and is gated outside dev mode', () => {
  const main = readMainProcessSource();
  const handlerStart = main.indexOf("ipcMain.handle('app:append-dev-log-line'");
  const handlerEnd = main.indexOf("ipcMain.handle('app:mark-current-checklist-item-done'", handlerStart);

  assert.notEqual(handlerStart, -1);
  assert.notEqual(handlerEnd, -1);

  const appendHandler = main.slice(handlerStart, handlerEnd);
  assert.match(main, /const MAX_DEV_LOG_LINE_LENGTH = 4000/);
  assert.match(main, /typeof value !== 'string'/);
  assert.match(main, /\.slice\(0, MAX_DEV_LOG_LINE_LENGTH\)/);
  assert.match(appendHandler, /if \(!isDev && !this\.config\.devPanelEnabled\)/);
  assert.match(appendHandler, /normalizeDevLogLine\(rawLine\)/);
  assert.match(appendHandler, /line === null/);
  assert.match(appendHandler, /appendFile\(targetPath, payload, 'utf8'\)/);
});

test('manual checklist IPC stays a legacy no-op compatibility surface', () => {
  const main = readMainProcessSource();
  const preload = readText('src/main/preload.ts');
  const stateController = readText('src/main/app-state-controller.ts');

  assert.match(main, /ipcMain\.handle\('app:mark-current-checklist-item-done'/);
  assert.match(main, /ipcMain\.handle\('app:undo-last-checklist-mark'/);
  assert.match(preload, /markCurrentChecklistItemDone: \(\) =>/);
  assert.match(preload, /undoLastChecklistMark: \(\) =>/);
  assert.match(stateController, /Legacy compatibility no-op/);

  const markStart = stateController.indexOf('export function runMarkCurrentChecklistItemDone');
  const undoStart = stateController.indexOf('export function runUndoLastChecklistMark');
  const nextStart = stateController.indexOf('export function runSetLogStatus');
  assert.notEqual(markStart, -1);
  assert.notEqual(undoStart, -1);
  assert.notEqual(nextStart, -1);

  const noOpBodies = stateController.slice(markStart, nextStart);
  assert.doesNotMatch(noOpBodies, /configStore\.update|broadcastState|checklistHistory|zoneProgress/);
});

test('default saved run labels use the configured app language outside timer controller', () => {
  const main = readText('src/main/main.ts');

  assert.match(main, /const runLabelLocale = this\.config\.appLanguage === 'en' \? 'en-US' : 'ru-RU'/);
  assert.match(main, /this\.t\('companion\.savedRunFallback'\)/);
  assert.match(main, /label: safeLabel \?\? defaultRunLabel/);
  assert.doesNotMatch(main, /label: safeLabel \?\? `Run \$\{new Date\(now\)\.toLocaleString\('ru-RU'\)\}`/);
});
