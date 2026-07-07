import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LogWatcherRuntimeState } from '../src/shared/types';
import { installElectronMock } from './helpers/electron-mock';

installElectronMock();

const { GuideService } = require('../src/main/services/guide-service') as typeof import('../src/main/services/guide-service');
const { LogWatcher } = require('../src/main/services/log-watcher') as typeof import('../src/main/services/log-watcher');

test('LogWatcher resyncs large files from the capped tail and continues appended reads', async () => {
  const tempDir = join(
    process.cwd(),
    '.tmp-tests',
    `log-watcher-large-resync-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const logPath = join(tempDir, 'Client.txt');
  mkdirSync(tempDir, { recursive: true });

  const fillerLine = `2026/05/16 22:00:00 000 [INFO Client] ${'x'.repeat(120)}\n`;
  const oldHeadLine = 'EARLY_SHOULD_NOT_BE_READ\n';
  const tailZoneLine = '[SCENE] Set Source [Grelwood]\n';
  writeFileSync(logPath, `${oldHeadLine}${fillerLine.repeat(3000)}${tailZoneLine}`, 'utf8');

  const guideService = new GuideService();
  guideService.load();

  const seenLines: Array<{ line: string; source: 'bootstrap' | 'append' }> = [];
  const detectedZones: string[] = [];
  const runtimeStates: Array<LogWatcherRuntimeState & { fileExists: boolean }> = [];

  const watcher = new LogWatcher(guideService, {
    onLine: (line, source) => {
      seenLines.push({ line, source });
    },
    onAppendLine: () => {},
    onZoneDetected: (zoneMatch) => {
      detectedZones.push(zoneMatch.guide?.zone_en ?? zoneMatch.rawZoneName);
    },
    onStatusChange: () => {},
    onRuntimeStateChange: (state) => {
      runtimeStates.push(state);
    }
  });

  try {
    await watcher.start(logPath, { skipBootstrap: true });
    seenLines.length = 0;
    detectedZones.length = 0;
    (watcher as unknown as { needsResync: boolean }).needsResync = true;

    await watcher.checkNow();

    assert.equal(seenLines.some((entry) => entry.line.includes('EARLY_SHOULD_NOT_BE_READ')), false);
    assert.equal(seenLines.some((entry) => entry.line.includes('Grelwood')), true);
    assert.equal(seenLines.every((entry) => entry.source === 'bootstrap'), true);
    assert.ok(seenLines.length < 3000, 'large resync should not replay the full old file');
    assert.ok(detectedZones.includes('Grelwood'));
    const latestRuntimeState = runtimeStates[runtimeStates.length - 1];
  assert.equal(
    latestRuntimeState?.currentOffset,
    Buffer.byteLength(`${oldHeadLine}${fillerLine.repeat(3000)}${tailZoneLine}`, 'utf8')
);

    seenLines.length = 0;
    appendFileSync(logPath, '[SCENE] Set Source [The Riverbank]\n', 'utf8');
    await watcher.checkNow();

    assert.deepEqual(seenLines, [
      { line: '[SCENE] Set Source [The Riverbank]', source: 'append' }
    ]);
  } finally {
    watcher.stop();
  }
});
