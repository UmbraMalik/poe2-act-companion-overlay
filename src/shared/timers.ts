import type {
  RunTimerSettings,
  RunTimerState,
  TownTimerState
} from './types';

export function formatDuration(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getRunTimerDisplayElapsed(
  runTimer: RunTimerState,
  now: number
): number {
  if (runTimer.status === 'running' && runTimer.resumedAt !== null) {
    return runTimer.elapsedMs + Math.max(0, now - runTimer.resumedAt);
  }

  return runTimer.elapsedMs;
}

export function getZoneTimerDisplayElapsed(
  runTimer: RunTimerState,
  now: number
): number {
  if (runTimer.status === 'running' && runTimer.lastZoneEnteredAt !== null) {
    return runTimer.currentZoneElapsedMs + Math.max(0, now - runTimer.lastZoneEnteredAt);
  }

  return runTimer.currentZoneElapsedMs;
}

export function getTownTimerDisplayElapsed(
  runTimer: RunTimerState,
  townTimer: TownTimerState,
  now: number
): number {
  if (
    townTimer.isInTown &&
    runTimer.status === 'running' &&
    townTimer.townEnteredAt !== null
  ) {
    return townTimer.currentTownElapsedMs + Math.max(0, now - townTimer.townEnteredAt);
  }

  return townTimer.currentTownElapsedMs;
}

export function getTownTimerTotalElapsed(
  runTimer: RunTimerState,
  townTimer: TownTimerState,
  now: number
): number {
  if (townTimer.isInTown) {
    return townTimer.totalTownElapsedMs + getTownTimerDisplayElapsed(runTimer, townTimer, now);
  }

  return townTimer.totalTownElapsedMs;
}

export function getCountdownDisplayMs(
  settings: RunTimerSettings,
  now: number
): number | null {
  if (!settings.leagueStartAt) {
    return null;
  }

  return Math.max(0, settings.leagueStartAt - now);
}
