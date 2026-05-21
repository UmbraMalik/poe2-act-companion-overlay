import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActTimeRowsFromSplits,
  getCurrentActElapsedMsForAct
} from '../src/renderer/companion-helpers';
import type { RunTimerState } from '../src/shared/types';

function runTimer(patch: Partial<RunTimerState>): RunTimerState {
  return {
    status: 'running',
    startedAt: 0,
    resumedAt: 3_600_000,
    elapsedMs: 3_600_000,
    pausedAt: null,
    pauseReason: null,
    finishedAt: null,
    actSplits: [],
    currentZoneId: null,
    currentZoneEnteredAt: null,
    currentZoneElapsedMs: 0,
    lastZoneId: null,
    lastZoneEnteredAt: null,
    deaths: [],
    ...patch
  } as RunTimerState;
}

test('act time rows preserve finished splits and append current act', () => {
  const rows = getActTimeRowsFromSplits(
    [
      { act: 1, elapsedMs: 1_800_000, timestamp: 1000 },
      { act: 2, elapsedMs: 3_600_000, timestamp: 2000 }
    ],
    5_400_000,
    { currentAct: 3, includeCurrentAct: true, currentStatus: 'running' }
  );

  assert.deepEqual(rows.map((row) => [row.act, row.elapsedMs, row.status]), [
    [1, 1_800_000, 'finished'],
    [2, 1_800_000, 'finished'],
    [3, 1_800_000, 'current']
  ]);
});

test('act timer can be calculated from act hint even without a guide card', () => {
  const timer = runTimer({
    status: 'running',
    elapsedMs: 3_600_000,
    resumedAt: 3_600_000,
    actSplits: [
      { act: 1, elapsedMs: 1_800_000, timestamp: 1000 }
    ]
  });

  assert.equal(getCurrentActElapsedMsForAct(timer, 2, 5_400_000), 3_600_000);
  assert.equal(getCurrentActElapsedMsForAct(timer, null, 5_400_000), null);
});

test('act rows do not duplicate an already finished act as current', () => {
  const rows = getActTimeRowsFromSplits(
    [{ act: 1, elapsedMs: 1_800_000, timestamp: 1000 }],
    2_400_000,
    { currentAct: 1, includeCurrentAct: true, currentStatus: 'running' }
  );

  assert.deepEqual(rows.map((row) => row.act), [1]);
  assert.equal(rows[0]?.status, 'finished');
});
