import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRunHistoryDetailModel,
  formatRunHistoryDelta
} from '../src/renderer/run-history-detail';
import type { RunTimerState, SavedRunHistoryEntry, ZoneTimeEntry } from '../src/shared/types';

function timerState(patch: Partial<RunTimerState> = {}): RunTimerState {
  return {
    status: 'finished',
    elapsedMs: 0,
    startedAt: 1_000,
    resumedAt: null,
    pausedAt: null,
    finishedAt: 2_000,
    lastZoneEnteredAt: null,
    currentZoneElapsedMs: 0,
    currentZoneStartedAt: null,
    pauseReason: null,
    pauseCount: 0,
    actSplits: [],
    ...patch
  };
}

function zone(zoneId: string, elapsedMs: number): ZoneTimeEntry {
  return {
    zoneId,
    zone_ru: zoneId,
    act: 1,
    elapsedMs,
    enteredAt: 100,
    leftAt: 100 + elapsedMs
  };
}

function run(patch: Partial<SavedRunHistoryEntry>): SavedRunHistoryEntry {
  const actSplits = patch.actSplits ?? [];
  return {
    id: 'run',
    label: 'Run',
    savedAt: 1_000,
    totalElapsedMs: 0,
    currentAct: 1,
    status: 'finished',
    actSplits,
    longestZones: [],
    zoneTimeHistory: [],
    runTimer: timerState({ actSplits }),
    ...patch
  };
}

test('run history detail handles empty history', () => {
  const model = buildRunHistoryDetailModel([]);

  assert.equal(model.selectedRun, null);
  assert.equal(model.previousRun, null);
  assert.equal(model.bestRun, null);
  assert.deepEqual(model.actRows, []);
  assert.deepEqual(model.zoneRows, []);
});

test('run history detail compares selected run with previous and best by acts and zones', () => {
  const selected = run({
    id: 'selected',
    savedAt: 3_000,
    totalElapsedMs: 220_000,
    actSplits: [
      { act: 1, elapsedMs: 100_000, timestamp: 1_000 },
      { act: 2, elapsedMs: 220_000, timestamp: 2_000 }
    ],
    zoneTimeHistory: [zone('grelwood', 50_000), zone('red-vale', 70_000)]
  });
  const previous = run({
    id: 'previous',
    savedAt: 2_000,
    totalElapsedMs: 240_000,
    actSplits: [
      { act: 1, elapsedMs: 90_000, timestamp: 1_000 },
      { act: 2, elapsedMs: 240_000, timestamp: 2_000 }
    ],
    zoneTimeHistory: [zone('red-vale', 80_000)]
  });
  const best = run({
    id: 'best',
    savedAt: 1_000,
    totalElapsedMs: 200_000,
    actSplits: [
      { act: 1, elapsedMs: 80_000, timestamp: 1_000 },
      { act: 2, elapsedMs: 200_000, timestamp: 2_000 }
    ],
    zoneTimeHistory: [zone('red-vale', 60_000)]
  });

  const model = buildRunHistoryDetailModel([previous, selected, best], 'selected');
  const actTwo = model.actRows.find((row) => row.act === 2);
  const redVale = model.zoneRows.find((row) => row.zoneId === 'red-vale');

  assert.equal(model.selectedRun?.id, 'selected');
  assert.equal(model.previousRun?.id, 'previous');
  assert.equal(model.bestRun?.id, 'best');
  assert.equal(actTwo?.elapsedMs, 120_000);
  assert.equal(actTwo?.previousDeltaMs, -30_000);
  assert.equal(actTwo?.bestDeltaMs, 0);
  assert.equal(model.zoneRows[0]?.zoneId, 'red-vale');
  assert.equal(redVale?.previousDeltaMs, -10_000);
  assert.equal(redVale?.bestDeltaMs, 10_000);
});

test('run history detail tolerates legacy records without zone arrays or timer timestamps', () => {
  const legacy = run({
    id: 'legacy',
    savedAt: 1_000,
    totalElapsedMs: 60_000,
    longestZones: undefined as unknown as ZoneTimeEntry[],
    zoneTimeHistory: undefined as unknown as ZoneTimeEntry[],
    runTimer: {} as RunTimerState
  });

  const model = buildRunHistoryDetailModel([legacy], 'legacy');

  assert.equal(model.selectedRun?.id, 'legacy');
  assert.equal(model.startedAt, null);
  assert.equal(model.finishedAt, null);
  assert.deepEqual(model.zoneRows, []);
});


test('run history detail bounds oversized zone history but keeps saved longest zones', () => {
  const oldLongest = zone('ancient-longest', 999_000);
  const largeHistory = Array.from({ length: 320 }, (_, index) => zone(`recent-${index}`, index + 1));
  const selected = run({
    id: 'selected-large',
    savedAt: 1_000,
    totalElapsedMs: 1_000_000,
    longestZones: [oldLongest],
    zoneTimeHistory: largeHistory
  });

  const model = buildRunHistoryDetailModel([selected], 'selected-large');

  assert.equal(model.zoneRows[0]?.zoneId, 'ancient-longest');
  assert.equal(model.zoneRows.length, 8);
  assert.equal(model.zoneRows.some((row) => row.zoneId === 'recent-0'), false);
});

test('run history delta formatting uses timer duration formatting', () => {
  assert.equal(formatRunHistoryDelta(null), '—');
  assert.equal(formatRunHistoryDelta(0), '±00:00');
  assert.equal(formatRunHistoryDelta(60_000), '+01:00');
  assert.equal(formatRunHistoryDelta(-3_661_000), '-1:01:01');
});
