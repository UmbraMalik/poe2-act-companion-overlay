import { useEffect, useRef, useState } from 'react';
import {
  getCountdownDisplayMs,
  getRunTimerDisplayElapsed
} from '../shared/timers';
import type {
  AppSnapshot,
  RunTimerSettings,
  RunTimerState
} from '../shared/types';
import { getPreviewSnapshot } from './preview-snapshot';

export function useAppSnapshot() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;
    const previewMode =
      new URLSearchParams(window.location.search).get('preview') === '1';
    const hasElectronApi =
      typeof window !== 'undefined' &&
      typeof window.poe2Overlay !== 'undefined';

    if (previewMode || !hasElectronApi) {
      setSnapshot(getPreviewSnapshot());
      return () => {
        isMounted = false;
      };
    }

    void window.poe2Overlay.getSnapshot().then((nextSnapshot) => {
      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    });

    let pendingSnapshot: AppSnapshot | null = null;
    let pendingFrame: number | null = null;

    const flushPendingSnapshot = () => {
      pendingFrame = null;
      if (!isMounted || !pendingSnapshot) {
        return;
      }

      setSnapshot(pendingSnapshot);
      pendingSnapshot = null;
    };

    const unsubscribe = window.poe2Overlay.onStateChanged((nextSnapshot) => {
      pendingSnapshot = nextSnapshot;
      if (pendingFrame !== null) {
        return;
      }

      pendingFrame = window.requestAnimationFrame(flushPendingSnapshot);
    });

    return () => {
      isMounted = false;
      if (pendingFrame !== null) {
        window.cancelAnimationFrame(pendingFrame);
      }
      unsubscribe();
    };
  }, []);

  return snapshot;
}

export function useLiveNow(intervalMs = 500) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, intervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}

export interface LiveRunTimerState {
  nowMs: number;
  runTimer: RunTimerState | null;
  runElapsedMs: number;
  countdownMs: number | null;
}

export interface LiveRunTimerDiagnostics {
  overlayMode?: string | null;
}

const TIMER_DRIFT_WARNING_MS = 1200;
const TIMER_DRIFT_WARNING_INTERVAL_MS = 5000;
const MIN_TIMER_TICK_MS = 16;
const COUNTDOWN_ZERO_POLL_MS = 250;

function shouldTickRunTimer(
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined
): boolean {
  if (!runTimer) {
    return false;
  }

  if (runTimer.status === 'running') {
    return true;
  }

  return runTimer.status === 'armed' && typeof settings?.leagueStartAt === 'number';
}

function getDisplaySecond(ms: number): number {
  return Math.floor(Math.max(0, ms) / 1000);
}

function createLiveRunTimerState(
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined,
  nowMs: number
): LiveRunTimerState {
  const effectiveRunTimer = runTimer ?? null;

  return {
    nowMs,
    runTimer: effectiveRunTimer,
    runElapsedMs: effectiveRunTimer
      ? getRunTimerDisplayElapsed(effectiveRunTimer, nowMs)
      : 0,
    countdownMs: settings ? getCountdownDisplayMs(settings, nowMs) : null
  };
}

function getAscendingSecondBoundaryDelay(ms: number): number {
  const wholeMs = Math.max(0, Math.floor(ms));
  const remainder = wholeMs % 1000;
  return remainder === 0 ? 1000 : 1000 - remainder;
}

function getDescendingSecondBoundaryDelay(ms: number): number | null {
  const wholeMs = Math.max(0, Math.floor(ms));
  if (wholeMs <= 0) {
    return null;
  }

  const remainder = wholeMs % 1000;
  return remainder === 0 ? 1 : remainder + 1;
}

function getNextTimerUpdateDelay(
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined,
  nowMs: number,
  minimumDelayMs: number
): number | null {
  const floorDelayMs = Math.max(MIN_TIMER_TICK_MS, Math.floor(minimumDelayMs));
  const delays: number[] = [];

  if (!runTimer) {
    return floorDelayMs;
  }

  if (runTimer.status === 'running') {
    delays.push(
      getAscendingSecondBoundaryDelay(getRunTimerDisplayElapsed(runTimer, nowMs))
    );
  }

  if (runTimer.status === 'armed' && settings) {
    const countdownMs = getCountdownDisplayMs(settings, nowMs);

    if (countdownMs === 0) {
      delays.push(COUNTDOWN_ZERO_POLL_MS);
    } else if (countdownMs !== null) {
      const delay = getDescendingSecondBoundaryDelay(countdownMs);
      if (delay !== null) {
        delays.push(delay);
      }
    }
  }

  if (delays.length === 0) {
    return null;
  }

  return Math.max(floorDelayMs, Math.min(...delays));
}

function shouldPublishTimerTick(
  previousNowMs: number,
  nextNowMs: number,
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined
): boolean {
  if (!runTimer) {
    return getDisplaySecond(previousNowMs) !== getDisplaySecond(nextNowMs);
  }

  const previousRunSecond = getDisplaySecond(
    getRunTimerDisplayElapsed(runTimer, previousNowMs)
  );
  const nextRunSecond = getDisplaySecond(
    getRunTimerDisplayElapsed(runTimer, nextNowMs)
  );

  if (previousRunSecond !== nextRunSecond) {
    return true;
  }

  if (!settings) {
    return false;
  }

  const previousCountdown = getCountdownDisplayMs(settings, previousNowMs);
  const nextCountdown = getCountdownDisplayMs(settings, nextNowMs);

  if (previousCountdown === null || nextCountdown === null) {
    return previousCountdown !== nextCountdown;
  }

  return getDisplaySecond(previousCountdown) !== getDisplaySecond(nextCountdown);
}

function hasRunTimerElectronApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.poe2Overlay !== 'undefined' &&
    typeof window.poe2Overlay.getRunTimerState === 'function' &&
    typeof window.poe2Overlay.onRunTimerChanged === 'function'
  );
}

export function useRunTimerState(
  runTimer: RunTimerState | null | undefined
): RunTimerState | null {
  const [independentRunTimer, setIndependentRunTimer] = useState<RunTimerState | null>(
    runTimer ?? null
  );

  useEffect(() => {
    setIndependentRunTimer(runTimer ?? null);
  }, [
    runTimer?.status,
    runTimer?.elapsedMs,
    runTimer?.startedAt,
    runTimer?.resumedAt,
    runTimer?.pausedAt,
    runTimer?.finishedAt,
    runTimer?.lastZoneEnteredAt,
    runTimer?.currentZoneElapsedMs,
    runTimer?.currentZoneStartedAt,
    runTimer?.pauseCount,
    runTimer?.actSplits.length
  ]);

  useEffect(() => {
    if (!hasRunTimerElectronApi()) {
      return;
    }

    let isMounted = true;

    void window.poe2Overlay.getRunTimerState().then((nextRunTimer) => {
      if (isMounted) {
        setIndependentRunTimer(nextRunTimer);
      }
    });

    const unsubscribe = window.poe2Overlay.onRunTimerChanged((nextRunTimer) => {
      if (isMounted) {
        setIndependentRunTimer(nextRunTimer);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return independentRunTimer ?? runTimer ?? null;
}

export function useLiveRunTimerDisplay(
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined,
  snapshotNowMs: number | null | undefined,
  minimumDelayMs = 32,
  diagnostics?: LiveRunTimerDiagnostics
): LiveRunTimerState {
  const resolvedSnapshotNowMs = snapshotNowMs ?? Date.now();
  const initialNowMs = Math.max(resolvedSnapshotNowMs, Date.now());
  const effectiveRunTimer = runTimer ?? null;
  const shouldTick = shouldTickRunTimer(effectiveRunTimer, settings);
  const latestTimerRef = useRef({
    runTimer: effectiveRunTimer,
    settings,
    diagnostics
  });
  latestTimerRef.current = {
    runTimer: effectiveRunTimer,
    settings,
    diagnostics
  };

  const anchorRef = useRef({
    nowMs: initialNowMs,
    perfMs: performance.now()
  });
  const computedNowMsRef = useRef(initialNowMs);
  const publishedNowMsRef = useRef(initialNowMs);
  const expectedTickPerfMsRef = useRef<number | null>(null);
  const lastDriftWarningAtRef = useRef(0);
  const lastSnapshotReceivedAtRef = useRef(Date.now());
  const [timerState, setTimerState] = useState(() =>
    createLiveRunTimerState(effectiveRunTimer, settings, initialNowMs)
  );

  useEffect(() => {
    lastSnapshotReceivedAtRef.current = Date.now();
  }, [resolvedSnapshotNowMs]);

  useEffect(() => {
    const perfNow = performance.now();
    const nextNowMs = Math.max(
      resolvedSnapshotNowMs,
      Date.now(),
      computedNowMsRef.current
    );

    anchorRef.current = {
      nowMs: nextNowMs,
      perfMs: perfNow
    };
    computedNowMsRef.current = nextNowMs;
    publishedNowMsRef.current = nextNowMs;
    expectedTickPerfMsRef.current = null;
    setTimerState(createLiveRunTimerState(effectiveRunTimer, settings, nextNowMs));
  }, [
    resolvedSnapshotNowMs,
    effectiveRunTimer?.status,
    effectiveRunTimer?.elapsedMs,
    effectiveRunTimer?.resumedAt,
    effectiveRunTimer?.pausedAt,
    effectiveRunTimer?.finishedAt,
    effectiveRunTimer?.startedAt,
    effectiveRunTimer?.lastZoneEnteredAt,
    effectiveRunTimer?.currentZoneElapsedMs,
    effectiveRunTimer?.currentZoneStartedAt,
    effectiveRunTimer?.pauseCount,
    effectiveRunTimer?.actSplits.length,
    settings?.leagueStartAt
  ]);

  useEffect(() => {
    if (!shouldTick) {
      return;
    }

    let timeoutId: number | null = null;
    let cancelled = false;

    const warnOnDrift = (driftMs: number, nowMs: number) => {
      const warningNow = Date.now();
      if (
        driftMs <= TIMER_DRIFT_WARNING_MS ||
        warningNow - lastDriftWarningAtRef.current < TIMER_DRIFT_WARNING_INTERVAL_MS
      ) {
        return;
      }

      const latest = latestTimerRef.current;
      if (!latest.diagnostics) {
        return;
      }

      lastDriftWarningAtRef.current = warningNow;

      console.warn('[TimerDrift]', {
        driftMs: Math.round(driftMs),
        documentHidden: document.hidden,
        visibilityState: document.visibilityState,
        timerStatus: latest.runTimer?.status ?? 'unknown',
        overlayMode: latest.diagnostics?.overlayMode ?? null,
        elapsedMs: latest.runTimer
          ? getRunTimerDisplayElapsed(latest.runTimer, nowMs)
          : 0,
        lastSnapshotAgeMs: Math.max(
          0,
          Date.now() - lastSnapshotReceivedAtRef.current
        )
      });
    };

    const scheduleNextTick = () => {
      if (cancelled) {
        return;
      }

      const latest = latestTimerRef.current;
      const delayMs = getNextTimerUpdateDelay(
        latest.runTimer,
        latest.settings,
        computedNowMsRef.current,
        minimumDelayMs
      );

      if (delayMs === null) {
        expectedTickPerfMsRef.current = null;
        return;
      }

      expectedTickPerfMsRef.current = performance.now() + delayMs;
      timeoutId = window.setTimeout(runTick, delayMs);
    };

    const runTick = () => {
      if (cancelled) {
        return;
      }

      timeoutId = null;

      const perfNow = performance.now();
      const expectedTickPerfMs = expectedTickPerfMsRef.current;
      expectedTickPerfMsRef.current = null;

      if (expectedTickPerfMs !== null) {
        warnOnDrift(perfNow - expectedTickPerfMs, computedNowMsRef.current);
      }

      const anchor = anchorRef.current;
      const nextNowMs = Math.max(
        computedNowMsRef.current,
        anchor.nowMs + (perfNow - anchor.perfMs)
      );
      computedNowMsRef.current = nextNowMs;

      const latest = latestTimerRef.current;
      const previousPublishedNowMs = publishedNowMsRef.current;

      if (
        shouldPublishTimerTick(
          previousPublishedNowMs,
          nextNowMs,
          latest.runTimer,
          latest.settings
        )
      ) {
        publishedNowMsRef.current = nextNowMs;
        setTimerState(
          createLiveRunTimerState(latest.runTimer, latest.settings, nextNowMs)
        );
      }

      scheduleNextTick();
    };

    scheduleNextTick();

    return () => {
      cancelled = true;
      expectedTickPerfMsRef.current = null;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [minimumDelayMs, shouldTick]);

  return timerState;
}

export function useLiveRunTimer(
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined,
  snapshotNowMs: number | null | undefined,
  minimumDelayMs = 32,
  diagnostics?: LiveRunTimerDiagnostics
): LiveRunTimerState {
  const effectiveRunTimer = useRunTimerState(runTimer);

  return useLiveRunTimerDisplay(
    effectiveRunTimer,
    settings,
    snapshotNowMs,
    minimumDelayMs,
    diagnostics
  );
}
