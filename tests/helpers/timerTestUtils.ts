import type { RunTimerState, TownTimerState } from '../../src/shared/types';

export function makeRunTimer(overrides: Partial<RunTimerState> = {}): RunTimerState {
  return {
    status: 'not_started',
    elapsedMs: 0,
    startedAt: null,
    resumedAt: null,
    pausedAt: null,
    finishedAt: null,
    lastZoneEnteredAt: null,
    currentZoneElapsedMs: 0,
    currentZoneStartedAt: null,
    pauseReason: null,
    pauseCount: 0,
    actSplits: [],
    ...overrides
  };
}

export function makeTownTimer(overrides: Partial<TownTimerState> = {}): TownTimerState {
  return {
    isInTown: false,
    currentTownName: null,
    townEnteredAt: null,
    currentTownElapsedMs: 0,
    totalTownElapsedMs: 0,
    townVisits: [],
    ...overrides
  };
}

export function withMockedNow<T>(now: number, run: () => T): T {
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    return run();
  } finally {
    Date.now = originalNow;
  }
}
