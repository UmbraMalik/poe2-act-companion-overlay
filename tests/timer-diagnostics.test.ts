import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  invokeIpcHandler,
  resetElectronMockState
} from './helpers/electron-mock';
import { withMockedNow } from './helpers/timerTestUtils';
import {
  applyAppLogLine,
  createTestAppInstance
} from './helpers/zoneTestUtils';

interface DiagnosticsRecord {
  event: string;
  source: string;
  overlayMode: string | null;
  zoneName: string | null;
  act: number | string | null;
  isRunning: boolean | null;
  isPaused: boolean | null;
  totalElapsedMs: number | null;
  actElapsedMs: number | null;
  expectedTickMs: number | null;
  actualTickMs: number | null;
  tickDelayMs: number | null;
  lastRenderedElapsedMs: number | null;
  currentElapsedMs: number | null;
  displayDeltaMs: number | null;
  wallClockDeltaMs: number | null;
  previousDisplayedText: string | null;
  nextDisplayedText: string | null;
  previousDisplayedElapsedMs: number | null;
  nextDisplayedElapsedMs: number | null;
  component: string | null;
  timestamp: string;
}

async function readDiagnosticsRecords(logFilePath: string): Promise<DiagnosticsRecord[]> {
  const text = await readFile(logFilePath, 'utf8');
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DiagnosticsRecord);
}

test('timer diagnostics stay disabled by default and do not create a log file', async () => {
  const previousValue = process.env.POE2_TIMER_DIAGNOSTICS;
  delete process.env.POE2_TIMER_DIAGNOSTICS;

  try {
    resetElectronMockState();
    const app = createTestAppInstance() as any;
    app.registerIpc();

    const logFilePath = app.timerDiagnosticsLog.getLogFilePath();
    const result = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-display-jump',
      source: 'renderer.test-disabled',
      displayDeltaMs: 1700
    });

    await app.timerDiagnosticsLog.whenIdle();

    assert.equal(result, false);
    assert.equal(existsSync(logFilePath), false);
  } finally {
    if (previousValue === undefined) {
      delete process.env.POE2_TIMER_DIAGNOSTICS;
    } else {
      process.env.POE2_TIMER_DIAGNOSTICS = previousValue;
    }
  }
});

test('timer diagnostics write explicit timer events and renderer anomalies when enabled', async () => {
  const previousValue = process.env.POE2_TIMER_DIAGNOSTICS;
  process.env.POE2_TIMER_DIAGNOSTICS = '1';

  try {
    resetElectronMockState();
    const app = createTestAppInstance() as any;
    app.registerIpc();

    withMockedNow(1_000, () => {
      applyAppLogLine(app as never, '2026/05/16 22:00:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
      applyAppLogLine(app as never, '[SCENE] Set Source [Hunting Grounds]');
      app.startRunTimerFromAnchor(1_000, 'test.manual-start');
    });

    withMockedNow(2_500, () => {
      app.pauseRunTimer();
    });

    withMockedNow(4_000, () => {
      app.resumeRunTimer();
    });

    app.logTimerDiagnostics('timer-diagnostics-enabled', {
      source: 'main',
      note: 'env-flag-detected-at-bootstrap'
    });

    const rendererEnabledResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-diagnostics-enabled',
      source: 'renderer',
      component: 'overlay-run-time-text',
      overlayMode: 'full',
      note: 'renderer-confirmed-preload-diagnostics-flag'
    });

    const visualReadyResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-visual-diagnostics-ready',
      source: 'renderer.visual-text',
      component: 'overlay-run-time-text',
      overlayMode: 'full',
      note: 'useLiveRunTimerText-initialized'
    });

    const tickDelayResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-tick-delay',
      source: 'renderer.test-tick-delay',
      expectedTickMs: 1000,
      actualTickMs: 1605,
      tickDelayMs: 605
    });

    const displayJumpResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-display-jump',
      source: 'renderer.test-display-jump',
      lastRenderedElapsedMs: 1000,
      currentElapsedMs: 2700,
      displayDeltaMs: 1700
    });

    withMockedNow(6_000, () => {
      app.resetRunTimer();
    });

    await app.timerDiagnosticsLog.whenIdle();

    const logFilePath = app.timerDiagnosticsLog.getLogFilePath();
    assert.equal(rendererEnabledResult, true);
    assert.equal(visualReadyResult, true);
    assert.equal(tickDelayResult, true);
    assert.equal(displayJumpResult, true);
    assert.equal(existsSync(logFilePath), true);

    const records = await readDiagnosticsRecords(logFilePath);
    const events = records.map((record) => record.event);

    assert.ok(events.includes('timer-diagnostics-enabled'));
    assert.ok(events.includes('timer-visual-diagnostics-ready'));
    assert.ok(events.includes('timer-start'));
    assert.ok(events.includes('timer-pause'));
    assert.ok(events.includes('timer-resume'));
    assert.ok(events.includes('timer-reset'));
    assert.ok(events.includes('timer-tick-delay'));
    assert.ok(events.includes('timer-display-jump'));

    const pauseRecord = records.find((record) => record.event === 'timer-pause' && record.source === 'main.manual-pause');
    assert.ok(pauseRecord);
    assert.equal(pauseRecord.overlayMode, 'full');
    assert.equal(pauseRecord.isPaused, true);
    assert.equal(pauseRecord.isRunning, false);
    assert.equal(typeof pauseRecord.totalElapsedMs, 'number');

    const mainEnabledRecord = records.find(
      (record) =>
        record.event === 'timer-diagnostics-enabled' &&
        record.source === 'main'
    );
    assert.ok(mainEnabledRecord);

    const rendererEnabledRecord = records.find(
      (record) =>
        record.event === 'timer-diagnostics-enabled' &&
        record.source === 'renderer'
    );
    assert.ok(rendererEnabledRecord);
    assert.equal(rendererEnabledRecord.component, 'overlay-run-time-text');

    const visualReadyRecord = records.find(
      (record) =>
        record.event === 'timer-visual-diagnostics-ready' &&
        record.source === 'renderer.visual-text'
    );
    assert.ok(visualReadyRecord);
    assert.equal(visualReadyRecord.component, 'overlay-run-time-text');

    const tickDelayRecord = records.find((record) => record.event === 'timer-tick-delay' && record.source === 'renderer.test-tick-delay');
    assert.ok(tickDelayRecord);
    assert.equal(tickDelayRecord.expectedTickMs, 1000);
    assert.equal(tickDelayRecord.actualTickMs, 1605);
    assert.equal(tickDelayRecord.tickDelayMs, 605);

    const displayJumpRecord = records.find((record) => record.event === 'timer-display-jump' && record.source === 'renderer.test-display-jump');
    assert.ok(displayJumpRecord);
    assert.equal(displayJumpRecord.lastRenderedElapsedMs, 1000);
    assert.equal(displayJumpRecord.currentElapsedMs, 2700);
    assert.equal(displayJumpRecord.displayDeltaMs, 1700);
    assert.equal(typeof displayJumpRecord.zoneName, 'string');
    assert.equal(displayJumpRecord.act, 1);
  } finally {
    if (previousValue === undefined) {
      delete process.env.POE2_TIMER_DIAGNOSTICS;
    } else {
      process.env.POE2_TIMER_DIAGNOSTICS = previousValue;
    }
  }
});

test('timer diagnostics persist renderer-side visual timer anomalies with displayed text details', async () => {
  const previousValue = process.env.POE2_TIMER_DIAGNOSTICS;
  process.env.POE2_TIMER_DIAGNOSTICS = '1';

  try {
    resetElectronMockState();
    const app = createTestAppInstance() as any;
    app.registerIpc();

    const updateDelayResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-visual-update-delay',
      source: 'renderer.test-visual-delay',
      component: 'timer-only-run-time-text',
      overlayMode: 'timer_only',
      previousDisplayedText: '00:10',
      nextDisplayedText: '00:12',
      previousDisplayedElapsedMs: 10_000,
      nextDisplayedElapsedMs: 12_000,
      displayDeltaMs: 2_000,
      wallClockDeltaMs: 2_150,
      isRunning: true,
      isPaused: false
    });

    const displayJumpResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-visual-display-jump',
      source: 'renderer.test-visual-jump',
      component: 'overlay-run-time-text',
      overlayMode: 'full',
      previousDisplayedText: '00:21',
      nextDisplayedText: '00:23',
      previousDisplayedElapsedMs: 21_000,
      nextDisplayedElapsedMs: 23_200,
      displayDeltaMs: 2_200,
      wallClockDeltaMs: 1_180,
      isRunning: true,
      isPaused: false
    });

    const backwardsResult = await invokeIpcHandler<boolean>('app:timer-diagnostics', {
      event: 'timer-visual-elapsed-backwards',
      source: 'renderer.test-visual-backwards',
      component: 'timer-only-act-time-text',
      overlayMode: 'timer_only',
      previousDisplayedText: '02:05',
      nextDisplayedText: '02:03',
      previousDisplayedElapsedMs: 125_000,
      nextDisplayedElapsedMs: 123_000,
      displayDeltaMs: -2_000,
      wallClockDeltaMs: 1_005,
      isRunning: true,
      isPaused: false,
      act: 1
    });

    await app.timerDiagnosticsLog.whenIdle();

    const logFilePath = app.timerDiagnosticsLog.getLogFilePath();
    assert.equal(updateDelayResult, true);
    assert.equal(displayJumpResult, true);
    assert.equal(backwardsResult, true);
    assert.equal(existsSync(logFilePath), true);

    const records = await readDiagnosticsRecords(logFilePath);

    const visualDelayRecord = records.find(
      (record) =>
        record.event === 'timer-visual-update-delay' &&
        record.source === 'renderer.test-visual-delay'
    );
    assert.ok(visualDelayRecord);
    assert.equal(visualDelayRecord.component, 'timer-only-run-time-text');
    assert.equal(visualDelayRecord.previousDisplayedText, '00:10');
    assert.equal(visualDelayRecord.nextDisplayedText, '00:12');
    assert.equal(visualDelayRecord.previousDisplayedElapsedMs, 10_000);
    assert.equal(visualDelayRecord.nextDisplayedElapsedMs, 12_000);
    assert.equal(visualDelayRecord.wallClockDeltaMs, 2_150);

    const visualJumpRecord = records.find(
      (record) =>
        record.event === 'timer-visual-display-jump' &&
        record.source === 'renderer.test-visual-jump'
    );
    assert.ok(visualJumpRecord);
    assert.equal(visualJumpRecord.component, 'overlay-run-time-text');
    assert.equal(visualJumpRecord.previousDisplayedText, '00:21');
    assert.equal(visualJumpRecord.nextDisplayedText, '00:23');
    assert.equal(visualJumpRecord.displayDeltaMs, 2_200);

    const backwardsRecord = records.find(
      (record) =>
        record.event === 'timer-visual-elapsed-backwards' &&
        record.source === 'renderer.test-visual-backwards'
    );
    assert.ok(backwardsRecord);
    assert.equal(backwardsRecord.component, 'timer-only-act-time-text');
    assert.equal(backwardsRecord.previousDisplayedElapsedMs, 125_000);
    assert.equal(backwardsRecord.nextDisplayedElapsedMs, 123_000);
    assert.equal(backwardsRecord.act, 1);
  } finally {
    if (previousValue === undefined) {
      delete process.env.POE2_TIMER_DIAGNOSTICS;
    } else {
      process.env.POE2_TIMER_DIAGNOSTICS = previousValue;
    }
  }
});
