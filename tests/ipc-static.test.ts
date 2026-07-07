import test from 'node:test';
import assert from 'node:assert/strict';
import { readMainProcessSource, readText } from './helpers/loadJson';

test('preload exposes only specific safe IPC APIs and not the raw ipcRenderer', () => {
  const preload = readText('src/main/preload.ts');

  for (const channel of [
    'app:update-settings',
    'app:open-report-issue',
    'app:open-external',
    'app:get-overlay-bounds',
    'app:set-overlay-position',
    'app:timer-diagnostics',
    'timer:visual-tick'
  ]) {
    assert.match(preload, new RegExp(channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(preload, /isTimerDiagnosticsEnabled/);
  assert.match(preload, /sendTimerDiagnostics/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('poe2Overlay', api\)/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^)]*ipcRenderer/);
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
