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

  assert.match(environment, /isAllowedExternalUrl/);
  assert.match(environment, /return isAllowedExternalUrl\(url\)/);
  assert.doesNotMatch(environment, /parsed\.protocol\s*===\s*'https:'\s*\|\|\s*parsed\.protocol\s*===\s*'http:'/);
  assert.match(main, /ipcMain\.handle\('app:open-external'/);
  assert.match(main, /if \(!isSafeExternalUrl\(url\)\)/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
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
  const firstPatchFieldReadIndex = updateSettingsHandler.search(
    /\bpatch\.(mainOverlaySettings|overlayDensity|overlayScale|overlayOpacity|companionAlwaysOnTop|realtimePriorityEnabled|hotkeys|manualHotkeysEnabled)/
  );

  assert.notEqual(normalizePatchIndex, -1);
  assert.notEqual(firstPatchFieldReadIndex, -1);
  assert.ok(normalizePatchIndex < firstPatchFieldReadIndex);
});
