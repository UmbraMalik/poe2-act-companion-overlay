import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, appendFile, readFile, utimes, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigStore } from '../src/main/services/config-store';
import { findNewestReadableLog } from '../src/main/services/log-discovery';
import { normalizeDebugBundleExportText, redactSensitiveText, sanitizeDebugLogLines } from '../src/shared/debug-bundle';
import { installElectronMock, invokeIpcHandlerWithEvent, mockIpcEvent, resetElectronMockState } from './helpers/electron-mock';
import { createTestAppInstance } from './helpers/zoneTestUtils';
import { readText } from './helpers/loadJson';

installElectronMock();
const { GuideService } = require('../src/main/services/guide-service') as typeof import('../src/main/services/guide-service');
const { LogWatcher } = require('../src/main/services/log-watcher') as typeof import('../src/main/services/log-watcher');

async function temporary<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'poe-major-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

function createWatcher() {
  const guide = new GuideService(); guide.load();
  const lines: { line: string; source: 'append' | 'bootstrap' }[] = [];
  const appends: string[] = [];
  const watcher = new LogWatcher(guide, {
    onLine: (line, source) => lines.push({ line, source }), onAppendLine: (line) => appends.push(line),
    onZoneDetected: () => {}, onStatusChange: () => {}, onRuntimeStateChange: () => {}
  });
  return { watcher, lines, appends };
}

test('failed config write leaves memory and disk consistent and same update can retry', async () => temporary(async dir => {
  const path = join(dir, 'config.json');
  const store = new ConfigStore(path);
  const previous = store.load().overlayOpacity;
  await mkdir(`${path}.tmp`);
  assert.throws(() => store.update({ overlayOpacity: 0.5 }));
  assert.equal(store.get().overlayOpacity, previous);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).overlayOpacity, previous);
  await rm(`${path}.tmp`, { recursive: true, force: true });
  assert.equal(store.update({ overlayOpacity: 0.5 }).overlayOpacity, 0.5);
  assert.equal(JSON.parse(await readFile(path, 'utf8')).overlayOpacity, 0.5);
}));

test('autodiscovery prefers a recognizable populated log over newer empty and foreign files', async () => temporary(async dir => {
  const valid = join(dir, 'Client.txt'), empty = join(dir, 'LatestClient.txt'), foreign = join(dir, 'foreign.txt');
  await writeFile(valid, '[SCENE] Set Source [Grelwood]\n');
  await utimes(valid, new Date(1000), new Date(1000));
  await writeFile(empty, ''); await writeFile(foreign, 'unrelated content');
  assert.equal(await findNewestReadableLog([empty, foreign, valid]), valid);
}));

test('watcher start during pending old read honors skipBootstrap and emits only new-file live lines', async () => temporary(async dir => {
  const a = join(dir, 'a.txt'), b = join(dir, 'b.txt');
  await writeFile(a, 'old\n'); await writeFile(b, 'historical-b\n');
  const { watcher, lines } = createWatcher();
  try {
    await watcher.start(a, { skipBootstrap: true });
    await appendFile(a, 'old-append\n');
    const pending = watcher.checkNow();
    await watcher.start(b, { skipBootstrap: true }); await pending;
    assert.deepEqual(lines, []);
    await appendFile(b, 'new-b\n'); await watcher.checkNow();
    assert.deepEqual(lines, [{ line: 'new-b', source: 'append' }]);
  } finally { watcher.stop(); }
}));

test('small rotation, incomplete historical line and next live line are classified correctly', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt'), replacement = join(dir, 'new.txt');
  await writeFile(path, 'original\n');
  const { watcher, lines, appends } = createWatcher();
  try {
    await watcher.start(path, { skipBootstrap: true });
    await writeFile(replacement, 'rotated\n[SCENE] Set Source [The River');
    // Remove first for Windows rename semantics.
    await rm(path); await rename(replacement, path);
    await watcher.checkNow();
    await appendFile(path, 'bank]\nlive\n'); await watcher.checkNow();
    assert.deepEqual(lines, [
      { line: 'rotated', source: 'bootstrap' },
      { line: '[SCENE] Set Source [The Riverbank]', source: 'bootstrap' },
      { line: 'live', source: 'append' }
    ]);
    assert.deepEqual(appends, ['live']);
  } finally { watcher.stop(); }
}));

test('watcher reads multiple chunks, including split UTF-8, and discards excessive unterminated lines', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt'); await writeFile(path, '');
  const { watcher, lines } = createWatcher();
  try {
    await watcher.start(path, { skipBootstrap: true });
    const line = `${'x'.repeat(65535)}ё`;
    await appendFile(path, `${line}\n${'z'.repeat(300000)}\nlast\n`);
    await watcher.checkNow();
    assert.deepEqual(lines, [{ line, source: 'append' }, { line: 'last', source: 'append' }]);
  } finally { watcher.stop(); }
}));

test('FSWatcher errors are handled and subsequent reads still work', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt'); await writeFile(path, '');
  const { watcher, lines } = createWatcher();
  try {
    await watcher.start(path, { skipBootstrap: true });
    const w = watcher as unknown as { fileWatcher: import('node:fs').FSWatcher; directoryWatcher: import('node:fs').FSWatcher };
    w.fileWatcher.emit('error', new Error('simulated error'));
    w.directoryWatcher.emit('error', new Error('simulated error'));
    await appendFile(path, 'recovered\n'); await watcher.checkNow();
    assert.deepEqual(lines, [{ line: 'recovered', source: 'append' }]);
    assert.ok(w.fileWatcher && w.directoryWatcher);
  } finally { watcher.stop(); }
}));

test('diagnostics redact authorization credentials, quoted secrets, cookies, and email before export', () => {
  const raw = 'Authorization: Bearer SAMPLE_SECRET\nuser@example.invalid\n{"password":"a secret value","Authorization":"Basic ENCODED"}\nCookie: session=COOKIE_SECRET';
  const clean = redactSensitiveText(raw);
  for (const secret of ['SAMPLE_SECRET', 'user@example.invalid', 'a secret value', 'ENCODED', 'COOKIE_SECRET']) {
    assert.ok(!clean.includes(secret));
    assert.ok(!normalizeDebugBundleExportText(raw)?.includes(secret));
  }
  assert.deepEqual(sanitizeDebugLogLines(['secret'], 0), []);
});

test('IPC denies wrong role, child frame, wrong page, missing sender and unknown window', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');
  app.overlayWindow = new BrowserWindow(); app.settingsWindow = new BrowserWindow();
  app.infoWindow = new BrowserWindow(); app.registerIpc();
  const info = mockIpcEvent(app.infoWindow, 'info');
  const settings = mockIpcEvent(app.settingsWindow, 'settings');
  const overlay = mockIpcEvent(app.overlayWindow, 'overlay');
  assert.ok(await invokeIpcHandlerWithEvent('app:get-ui-preferences-snapshot', info));
  assert.ok(await invokeIpcHandlerWithEvent('app:get-snapshot', settings));
  await assert.rejects(invokeIpcHandlerWithEvent('app:delete-saved-run', info, 'x'), /IPC request denied/);
  await assert.rejects(invokeIpcHandlerWithEvent('app:auto-update-install', overlay), /IPC request denied/);
  await assert.rejects(invokeIpcHandlerWithEvent('app:get-snapshot', { ...settings, senderFrame: { url: settings.senderFrame.url } }), /IPC request denied/);
  await assert.rejects(invokeIpcHandlerWithEvent('app:get-snapshot', mockIpcEvent(app.settingsWindow, 'companion')), /IPC request denied/);
  await assert.rejects(invokeIpcHandlerWithEvent('app:get-snapshot', {}), /IPC request denied/);
  await assert.rejects(invokeIpcHandlerWithEvent('app:get-snapshot', mockIpcEvent(new BrowserWindow(), 'settings')), /IPC request denied/);
});

test('all registered IPC channels have an explicit role policy and build CSP drops dev permissions', () => {
  const handlers = readText('src/main/app-ipc-handlers.ts');
  const policy = readText('src/main/ipc-security.ts');
  const channels = [...handlers.matchAll(/ipcMain\.handle\('([^']+)'/g)].map(m => m[1]).sort();
  const policies = [...policy.matchAll(/'((?:app|timer|close-confirm):[^']+)'/g)].map(m => m[1]).sort();
  assert.deepEqual(channels, policies);
  const vite = readText('vite.config.ts');
  assert.match(vite, /apply: 'build'/);
  assert.match(vite, /\.replace\("script-src 'self' 'unsafe-inline'", "script-src 'self'"\)/);
  assert.match(vite, /\.replace\("connect-src 'self' http:\/\/127\.0\.0\.1:5173 ws:\/\/127\.0\.0\.1:5173", "connect-src 'self'"\)/);
});
