import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { isLogActivityRecent, LOG_HEALTH_STALE_AFTER_MS } from '../src/shared/log-activity';
import { isAllowedExternalUrl, ALLOWED_EXTERNAL_URL_EXAMPLES } from '../src/shared/external-url-policy';
import { sanitizeDebugLogLines } from '../src/shared/debug-bundle';
import { parseFixedDriveRoots } from '../src/main/services/log-discovery';
import { installElectronMock } from './helpers/electron-mock';
import { createTestAppInstance } from './helpers/zoneTestUtils';

installElectronMock();
const { GuideService } = require('../src/main/services/guide-service') as typeof import('../src/main/services/guide-service');
const { LogWatcher } = require('../src/main/services/log-watcher') as typeof import('../src/main/services/log-watcher');
const { getSecureWebPreferences } = require('../src/main/window-security') as typeof import('../src/main/window-security');
const { TimerDiagnosticsLog, TIMER_DIAGNOSTICS_MAX_BYTES } = require('../src/main/timer-diagnostics-log') as typeof import('../src/main/timer-diagnostics-log');
const { TIMER_VISUAL_HEARTBEAT_MS } = require('../src/main/app-environment') as typeof import('../src/main/app-environment');

async function temporary<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'poe-minor-'));
  try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('log activity accepts small clock skew but rejects distant future, stale and invalid timestamps', () => {
  const now = Date.parse('2026-11-27T12:00:00Z');
  const time = (delta: number) => new Date(now + delta).toISOString();
  assert.equal(isLogActivityRecent(time(5000), now), true);
  assert.equal(isLogActivityRecent(time(5001), now), false);
  assert.equal(isLogActivityRecent(time(86400000), now), false);
  assert.equal(isLogActivityRecent(time(-LOG_HEALTH_STALE_AFTER_MS), now), true);
  assert.equal(isLogActivityRecent(time(-LOG_HEALTH_STALE_AFTER_MS - 1), now), false);
  assert.equal(isLogActivityRecent('invalid', now), false);
  assert.equal(isLogActivityRecent(time(0), NaN), false);
});

test('fixed-volume enumeration accepts only drive identifiers and deduplicates them', () => {
  assert.deepEqual(parseFixedDriveRoots('c:\r\nD:\r\nC:\r\ninvalid\r\n\\\\server\\share\r\nE:\r\n'), ['C:\\', 'D:\\', 'E:\\']);
});

test('external URL policy permits default HTTPS port but rejects alternate ports', () => {
  for (const value of ALLOWED_EXTERNAL_URL_EXAMPLES) {
    const url = new URL(value);
    url.port = '443';
    assert.equal(isAllowedExternalUrl(url.href), true);
    url.port = '8443';
    assert.equal(isAllowedExternalUrl(url.href), false);
  }
});

test('zero and invalid diagnostic line limits return no lines', () => {
  for (const limit of [0, -1, NaN]) assert.deepEqual(sanitizeDebugLogLines(['private', 'latest'], limit), []);
  assert.deepEqual(sanitizeDebugLogLines(['first', 'latest'], 1), ['latest']);
});

test('initial bootstrap preserves an incomplete scene line and passes one parsed match to callbacks', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt');
  await writeFile(path, '[SCENE] Set Source [Grel');
  const service = new GuideService(); service.load();
  const lines: Array<{ line: string; source: string; match: unknown }> = [];
  const matches: unknown[] = [];
  const watcher = new LogWatcher(service, {
    onLine: (line, source, match) => lines.push({ line, source, match }),
    onAppendLine: () => {}, onZoneDetected: match => matches.push(match),
    onStatusChange: () => {}, onRuntimeStateChange: () => {}
  });
  try {
    await watcher.start(path);
    assert.equal(lines.length, 0);
    await appendFile(path, 'wood]\n[SCENE] Set Source [The Riverbank]\n');
    await watcher.checkNow();
    assert.deepEqual(lines.map(({ line, source }) => ({ line, source })), [
      { line: '[SCENE] Set Source [Grelwood]', source: 'bootstrap' },
      { line: '[SCENE] Set Source [The Riverbank]', source: 'append' }
    ]);
    assert.equal(lines[0].match, matches[0]);
    assert.equal(lines[1].match, matches[1]);
    assert.ok(matches[0]); assert.ok(matches[1]);
  } finally { watcher.stop(); }
}));

test('watcher pipeline shares parsed zone match without calling the controller extractor again', async () => temporary(async dir => {
  const app = createTestAppInstance() as any;
  const path = join(dir, 'Client.txt');
  await writeFile(path, '[SCENE] Set Source [Grelwood]\n');
  app.extractZoneMatchFromLogLine = () => { throw new Error('unexpected second extraction'); };
  try {
    await app.logWatcher.start(path);
    assert.equal(app.currentZone.guide?.zone_en, 'Grelwood');
    await appendFile(path, '[SCENE] Set Source [The Red Vale]\n');
    await app.logWatcher.checkNow();
    assert.equal(app.currentZone.rawZoneName, 'The Red Vale');
    assert.equal(app.currentZone.guide?.zone_en, 'The Red Vale');
  } finally { app.logWatcher.stop(); app.clearBroadcastTimer(); }
}));

test('overlay snapshot omits unrelated configuration while keeping every required presentation field', () => {
  const app = createTestAppInstance();
  const overlay = app.getOverlaySnapshot();
  const full = app.getSnapshot();
  for (const field of ['zoneProgress', 'visitedZones', 'zoneTimeHistory', 'bestRunsByProfile', 'overlaySavedLayouts', 'companionBounds', 'realtimePriorityEnabled']) {
    assert.equal(Object.prototype.hasOwnProperty.call(overlay.config, field), false, field);
    assert.equal(Object.prototype.hasOwnProperty.call(full.config, field), true, field);
  }
  for (const key of Object.keys(overlay.config) as Array<keyof typeof overlay.config>) {
    assert.deepEqual(overlay.config[key], full.config[key], key);
  }
  assert.ok(Object.keys(overlay.config).length < Object.keys(full.config).length);
  assert.ok(JSON.stringify(overlay).length < JSON.stringify(full).length);
  assert.deepEqual(overlay.config.runHistory, full.config.runHistory);
  assert.deepEqual(overlay.config.runTimerSettings, full.config.runTimerSettings);
});

test('utility windows use background throttling, with an explicit visible overlay exception', () => {
  assert.equal(getSecureWebPreferences().backgroundThrottling, true);
  assert.equal(getSecureWebPreferences(false).backgroundThrottling, false);
});

test('visual heartbeat skips hidden overlay and resumes with a fresh tick', async () => {
  const app = createTestAppInstance() as any;
  let visible = false;
  let sends = 0;
  app.overlayWindow = { isDestroyed: () => false, isVisible: () => visible,
    webContents: { isDestroyed: () => false, send: (channel: string) => { if (channel === 'timer:visual-tick') sends++; } } };
  app.startTimerVisualHeartbeat();
  try {
    await delay(TIMER_VISUAL_HEARTBEAT_MS + 100);
    assert.equal(sends, 0);
    assert.equal(app.lastTimerVisualHeartbeatSentAtMs, null);
    visible = true;
    await delay(TIMER_VISUAL_HEARTBEAT_MS + 100);
    assert.ok(sends > 0);
    const beforeHide = sends;
    visible = false;
    await delay(TIMER_VISUAL_HEARTBEAT_MS + 100);
    assert.equal(sends, beforeHide);
    assert.equal(app.lastTimerVisualHeartbeatSentAtMs, null);
  } finally { app.stopTimerVisualHeartbeat(); }
});

test('diagnostic log rotates serial writes at the byte limit and retains one backup', async () => temporary(async dir => {
  class TestLog extends TimerDiagnosticsLog {
    override isEnabled() { return true; }
    override getLogDirectoryPath() { return dir; }
  }
  const log = new TestLog();
  const path = log.getLogFilePath();
  const backup = `${path}.1`;
  const record = { timestamp: new Date().toISOString(), event: 'timer-display-jump' as const, source: 'test' };
  await mkdir(dir, { recursive: true });
  await writeFile(backup, 'old backup');
  await writeFile(path, Buffer.alloc(TIMER_DIAGNOSTICS_MAX_BYTES, 'x'));
  assert.deepEqual(await Promise.all([log.write(record), log.write(record)]), [true, true]);
  await log.whenIdle();
  assert.equal((await stat(backup)).size, TIMER_DIAGNOSTICS_MAX_BYTES);
  assert.equal((await readFile(path, 'utf8')).trim().split('\n').length, 2);
  assert.ok((await stat(path)).size < TIMER_DIAGNOSTICS_MAX_BYTES);
}));

test('bootstrap keeps an unfinished UTF-8 code point historical even after a complete line', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt');
  const bytes = Buffer.from('ё');
  await writeFile(path, Buffer.concat([Buffer.from('complete\n'), bytes.subarray(0, 1)]));
  const service = new GuideService(); service.load();
  const lines: Array<{ line: string; source: string }> = [];
  const watcher = new LogWatcher(service, {
    onLine: (line, source) => lines.push({ line, source }), onAppendLine: () => {},
    onZoneDetected: () => {}, onStatusChange: () => {}, onRuntimeStateChange: () => {}
  });
  try {
    await watcher.start(path);
    await appendFile(path, Buffer.concat([bytes.subarray(1), Buffer.from('\nlive\n')]));
    await watcher.checkNow();
    assert.deepEqual(lines, [
      { line: 'complete', source: 'bootstrap' }, { line: 'ё', source: 'bootstrap' }, { line: 'live', source: 'append' }
    ]);
  } finally { watcher.stop(); }
}));

test('bootstrap does not drop a complete first line at the exact tail boundary', async () => temporary(async dir => {
  const path = join(dir, 'Client.txt');
  const firstLine = '[SCENE] Set Source [Grelwood]\n';
  const tail = firstLine + 'x'.repeat(128 * 1024 - Buffer.byteLength(firstLine) - 1) + '\n';
  await writeFile(path, `old\n${tail}`);
  const service = new GuideService(); service.load();
  const lines: string[] = [];
  const watcher = new LogWatcher(service, {
    onLine: line => lines.push(line), onAppendLine: () => {}, onZoneDetected: () => {},
    onStatusChange: () => {}, onRuntimeStateChange: () => {}
  });
  try {
    await watcher.start(path);
    assert.equal(lines[0], firstLine.trim());
    assert.ok(!lines.includes('old'));
  } finally { watcher.stop(); }
}));
