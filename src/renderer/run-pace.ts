import type {
  RunTimerStatus,
  SavedRunHistoryEntry,
  ZoneAct
} from '../shared/types';
import { formatDuration } from './utils';

export type RunPaceTone = 'ahead' | 'behind' | 'even' | 'empty';

export interface RunPaceSnapshot {
  referenceRun: SavedRunHistoryEntry | null;
  referenceCheckpointMs: number | null;
  currentCheckpointMs: number | null;
  checkpointDeltaMs: number | null;
  projectedFinishMs: number | null;
  targetDeltaMs: number | null;
  currentActElapsedMs: number | null;
  bestActElapsedMs: number | null;
  actDeltaMs: number | null;
  tone: RunPaceTone;
}

interface ComparableRun {
  run: SavedRunHistoryEntry;
  checkpointMs: number;
}

function getZoneEntryCheckpoint(entry: SavedRunHistoryEntry, zoneId: string): number | null {
  const history = Array.isArray(entry.zoneTimeHistory) ? entry.zoneTimeHistory : [];
  const currentZoneIndex = history.findIndex((zone) => zone.zoneId === zoneId);

  if (currentZoneIndex < 0) {
    return null;
  }

  return history
    .slice(0, currentZoneIndex)
    .reduce((total, zone) => total + Math.max(0, zone.elapsedMs), 0);
}

function getReferenceRun(
  runHistory: SavedRunHistoryEntry[],
  zoneId: string
): ComparableRun | null {
  const comparable = runHistory.flatMap((run): ComparableRun[] => {
    const checkpointMs = getZoneEntryCheckpoint(run, zoneId);
    const totalElapsedMs = Number.isFinite(run.totalElapsedMs) ? Math.max(0, run.totalElapsedMs) : 0;

    if (checkpointMs === null || totalElapsedMs <= checkpointMs) {
      return [];
    }

    return [{ run, checkpointMs }];
  });

  const finished = comparable.filter(({ run }) => run.status === 'finished');
  const candidates = finished.length > 0 ? finished : comparable;

  return [...candidates].sort((left, right) => (
    left.run.totalElapsedMs - right.run.totalElapsedMs ||
    left.checkpointMs - right.checkpointMs ||
    right.run.savedAt - left.run.savedAt
  ))[0] ?? null;
}

function getActCheckpointMs(
  entry: SavedRunHistoryEntry,
  zoneId: string,
  act: number
): number | null {
  const history = Array.isArray(entry.zoneTimeHistory) ? entry.zoneTimeHistory : [];
  const currentZoneIndex = history.findIndex((zone) => zone.zoneId === zoneId);

  if (currentZoneIndex < 0) {
    return null;
  }

  return history
    .slice(0, currentZoneIndex)
    .filter((zone) => zone.act === act)
    .reduce((total, zone) => total + Math.max(0, zone.elapsedMs), 0);
}

function getPaceTone(deltaMs: number | null): RunPaceTone {
  if (deltaMs === null) {
    return 'empty';
  }

  if (Math.abs(deltaMs) < 1000) {
    return 'even';
  }

  return deltaMs < 0 ? 'ahead' : 'behind';
}

export function getRunPaceSnapshot(options: {
  runHistory: SavedRunHistoryEntry[];
  zoneId: string | null;
  currentRunElapsedMs: number;
  currentZoneElapsedMs: number;
  currentAct: ZoneAct | null;
  currentActElapsedMs: number | null;
  targetRunTimeMs: number | null;
  timerStatus: RunTimerStatus;
}): RunPaceSnapshot {
  const {
    runHistory,
    zoneId,
    currentRunElapsedMs,
    currentZoneElapsedMs,
    currentAct,
    currentActElapsedMs,
    targetRunTimeMs,
    timerStatus
  } = options;

  const empty: RunPaceSnapshot = {
    referenceRun: null,
    referenceCheckpointMs: null,
    currentCheckpointMs: null,
    checkpointDeltaMs: null,
    projectedFinishMs: null,
    targetDeltaMs: null,
    currentActElapsedMs,
    bestActElapsedMs: null,
    actDeltaMs: null,
    tone: 'empty'
  };

  if (
    !zoneId ||
    timerStatus === 'not_started' ||
    timerStatus === 'armed' ||
    currentRunElapsedMs <= 0
  ) {
    return empty;
  }

  const reference = getReferenceRun(runHistory, zoneId);
  if (!reference) {
    return empty;
  }

  const currentCheckpointMs = Math.max(0, currentRunElapsedMs - currentZoneElapsedMs);
  const checkpointDeltaMs = currentCheckpointMs - reference.checkpointMs;
  const projectedFinishMs = Math.max(
    currentRunElapsedMs,
    reference.run.totalElapsedMs + checkpointDeltaMs
  );
  const bestActElapsedMs = typeof currentAct === 'number'
    ? getActCheckpointMs(reference.run, zoneId, currentAct)
    : null;
  const currentActCheckpointMs = currentActElapsedMs === null
    ? null
    : Math.max(0, currentActElapsedMs - currentZoneElapsedMs);
  const actDeltaMs = currentActCheckpointMs !== null && bestActElapsedMs !== null
    ? currentActCheckpointMs - bestActElapsedMs
    : null;

  return {
    referenceRun: reference.run,
    referenceCheckpointMs: reference.checkpointMs,
    currentCheckpointMs,
    checkpointDeltaMs,
    projectedFinishMs,
    targetDeltaMs: targetRunTimeMs === null ? null : projectedFinishMs - targetRunTimeMs,
    currentActElapsedMs,
    bestActElapsedMs,
    actDeltaMs,
    tone: getPaceTone(checkpointDeltaMs)
  };
}

export function formatSignedPaceDuration(deltaMs: number | null): string {
  if (deltaMs === null) {
    return '—';
  }

  if (Math.abs(deltaMs) < 1000) {
    return '±00:00';
  }

  return `${deltaMs < 0 ? '−' : '+'}${formatDuration(Math.abs(deltaMs))}`;
}
