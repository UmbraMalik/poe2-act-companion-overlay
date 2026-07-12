import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import type { SavedRunHistoryEntry, ZoneTimeEntry } from '../src/shared/types';
import { formatSignedPaceDuration, getRunPaceSnapshot } from '../src/renderer/run-pace';

function zone(zoneId: string, elapsedMs: number, act = 2): ZoneTimeEntry {
  return {
    zoneId,
    zone_ru: zoneId,
    act,
    elapsedMs,
    enteredAt: 1,
    leftAt: 1 + elapsedMs
  };
}

function savedRun(id: string, totalElapsedMs: number, status: SavedRunHistoryEntry['status'] = 'finished'): SavedRunHistoryEntry {
  return {
    id,
    label: id,
    savedAt: id === 'fast' ? 2 : 1,
    totalElapsedMs,
    currentAct: 2,
    status,
    actSplits: [
      { act: 1, elapsedMs: 60 * 60_000, timestamp: 1 },
      { act: 2, elapsedMs: 150 * 60_000, timestamp: 2 }
    ],
    longestZones: [],
    zoneTimeHistory: [
      zone('zone-1', 10 * 60_000),
      zone('zone-2', 20 * 60_000),
      zone('zone-3', 15 * 60_000)
    ],
    runTimer: {
      ...DEFAULT_CONFIG.runTimer,
      status,
      elapsedMs: totalElapsedMs
    }
  };
}

test('live pace uses the fastest finished comparable run and projects finish from the current checkpoint', () => {
  const snapshot = getRunPaceSnapshot({
    runHistory: [savedRun('slow', 6 * 60 * 60_000), savedRun('fast', 5 * 60 * 60_000)],
    zoneId: 'zone-3',
    currentRunElapsedMs: 40 * 60_000,
    currentZoneElapsedMs: 5 * 60_000,
    currentAct: 2,
    currentActElapsedMs: 40 * 60_000,
    targetRunTimeMs: 5 * 60 * 60_000,
    timerStatus: 'running'
  });

  assert.equal(snapshot.referenceRun?.id, 'fast');
  assert.equal(snapshot.referenceCheckpointMs, 30 * 60_000);
  assert.equal(snapshot.currentCheckpointMs, 35 * 60_000);
  assert.equal(snapshot.checkpointDeltaMs, 5 * 60_000);
  assert.equal(snapshot.projectedFinishMs, 5 * 60 * 60_000 + 5 * 60_000);
  assert.equal(snapshot.targetDeltaMs, 5 * 60_000);
  assert.equal(snapshot.bestActElapsedMs, 30 * 60_000);
  assert.equal(snapshot.actDeltaMs, 5 * 60_000);
  assert.equal(snapshot.tone, 'behind');
});

test('live pace stays empty until the timer is active or a comparable checkpoint exists', () => {
  const notStarted = getRunPaceSnapshot({
    runHistory: [savedRun('fast', 5 * 60 * 60_000)],
    zoneId: 'zone-3',
    currentRunElapsedMs: 0,
    currentZoneElapsedMs: 0,
    currentAct: 1,
    currentActElapsedMs: 0,
    targetRunTimeMs: null,
    timerStatus: 'not_started'
  });
  const missingZone = getRunPaceSnapshot({
    runHistory: [savedRun('fast', 5 * 60 * 60_000)],
    zoneId: 'unknown-zone',
    currentRunElapsedMs: 40 * 60_000,
    currentZoneElapsedMs: 5 * 60_000,
    currentAct: 1,
    currentActElapsedMs: 35 * 60_000,
    targetRunTimeMs: null,
    timerStatus: 'running'
  });

  assert.equal(notStarted.referenceRun, null);
  assert.equal(notStarted.projectedFinishMs, null);
  assert.equal(missingZone.referenceRun, null);
  assert.equal(missingZone.checkpointDeltaMs, null);
});

test('signed pace formatting makes direction explicit', () => {
  assert.equal(formatSignedPaceDuration(-65_000), '−01:05');
  assert.equal(formatSignedPaceDuration(65_000), '+01:05');
  assert.equal(formatSignedPaceDuration(0), '±00:00');
  assert.equal(formatSignedPaceDuration(null), '—');
});
