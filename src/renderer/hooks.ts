import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  getCountdownDisplayMs,
  getRunTimerDisplayElapsed
} from '../shared/timers';
import type {
  AppSnapshot,
  RunTimerSettings,
  RunTimerState,
  TimerDiagnosticsPayload,
  ZoneAct
} from '../shared/types';
import { getPreviewSnapshot } from './preview-snapshot';
import {
  reportOverlayRenderDiagnostics,
  reportOverlayRenderDiagnosticsOnce,
  shouldReportOverlayRenderDelay
} from './render-diagnostics';
import {
  scheduleOverlayRenderCommit,
  type OverlayRenderTask
} from './render-scheduler';

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
    let pendingRenderTask: OverlayRenderTask | null = null;
    let snapshotReceivedCount = 0;
    let snapshotCommitCount = 0;
    let lastSnapshotReceivedAtMs: number | null = null;
    let lastSnapshotCommittedAtMs: number | null = null;

    reportOverlayRenderDiagnosticsOnce('snapshot-render-scheduler-ready', {
      event: 'overlay-render-scheduler-ready',
      source: 'renderer.snapshot',
      component: 'useAppSnapshot',
      note: 'snapshot-raf-timeout-fallback-ready-16ms',
      documentHidden: document.hidden,
      visibilityState: document.visibilityState
    });

    const clearPendingFlush = () => {
      if (pendingRenderTask !== null) {
        pendingRenderTask.cancel();
        pendingRenderTask = null;
      }
    };

    const flushPendingSnapshot = (info: { reason: string; delayMs: number }) => {
      pendingRenderTask = null;
      if (!isMounted || !pendingSnapshot) {
        return;
      }

      snapshotCommitCount += 1;
      lastSnapshotCommittedAtMs = Date.now();
      const snapshotAgeMs = lastSnapshotReceivedAtMs === null
        ? null
        : Math.max(0, lastSnapshotCommittedAtMs - lastSnapshotReceivedAtMs);

      setSnapshot(pendingSnapshot);
      pendingSnapshot = null;

      if (shouldReportOverlayRenderDelay(info.delayMs, info.reason)) {
        reportOverlayRenderDiagnostics({
          event: 'overlay-render-commit-delay',
          source: 'renderer.snapshot',
          component: 'useAppSnapshot',
          renderSource: 'snapshot',
          renderReason: info.reason,
          renderDelayMs: info.delayMs,
          snapshotAgeMs,
          snapshotReceivedCount,
          snapshotCommitCount,
          lastSnapshotReceivedAtMs,
          lastSnapshotCommittedAtMs,
          note: 'snapshot-state-commit-delayed',
          documentHidden: document.hidden,
          visibilityState: document.visibilityState
        });
      }
    };

    const schedulePendingSnapshotFlush = () => {
      if (pendingRenderTask !== null) {
        return;
      }

      pendingRenderTask = scheduleOverlayRenderCommit({
        source: 'snapshot',
        fallbackMs: 16,
        commit: (info) => flushPendingSnapshot(info)
      });
    };

    const unsubscribe = window.poe2Overlay.onStateChanged((nextSnapshot) => {
      snapshotReceivedCount += 1;
      lastSnapshotReceivedAtMs = Date.now();
      pendingSnapshot = nextSnapshot;
      schedulePendingSnapshotFlush();
    });

    return () => {
      isMounted = false;
      clearPendingFlush();
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
  zoneName?: string | null;
  act?: ZoneAct | null;
  component?: string | null;
}

export interface LiveRunTimerTextFrame {
  text: string | null;
  displayedElapsedMs: number | null;
}

const TIMER_DRIFT_WARNING_MS = 1200;
const TIMER_DRIFT_WARNING_INTERVAL_MS = 5000;
const TIMER_VISUAL_HEARTBEAT_MS = 250;
const TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS = 250;
const TIMER_DIAGNOSTICS_DISPLAY_JUMP_THRESHOLD_MS = 1500;
const TIMER_DIAGNOSTICS_VISUAL_UPDATE_DELAY_THRESHOLD_MS = 1200;
const TIMER_DIAGNOSTICS_VISUAL_STALE_THRESHOLD_MS = 1500;
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

function hasTimerVisualTickElectronApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.poe2Overlay !== 'undefined' &&
    typeof window.poe2Overlay.onTimerVisualTick === 'function'
  );
}

function hasTimerDiagnosticsElectronApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.poe2Overlay !== 'undefined' &&
    typeof window.poe2Overlay.isTimerDiagnosticsEnabled === 'function' &&
    typeof window.poe2Overlay.sendTimerDiagnostics === 'function'
  );
}

let cachedTimerDiagnosticsEnabled: boolean | null = null;
let timerDiagnosticsEnabledPromise: Promise<boolean> | null = null;
type TimerDiagnosticsOneTimeState = 'idle' | 'pending' | 'done';
const oneTimeTimerDiagnosticsState = new Map<string, TimerDiagnosticsOneTimeState>();

async function isTimerDiagnosticsEnabled(): Promise<boolean> {
  if (cachedTimerDiagnosticsEnabled !== null) {
    return cachedTimerDiagnosticsEnabled;
  }

  if (!hasTimerDiagnosticsElectronApi()) {
    cachedTimerDiagnosticsEnabled = false;
    return false;
  }

  if (!timerDiagnosticsEnabledPromise) {
    timerDiagnosticsEnabledPromise = window.poe2Overlay.isTimerDiagnosticsEnabled()
      .then((enabled) => {
        cachedTimerDiagnosticsEnabled = Boolean(enabled);
        return cachedTimerDiagnosticsEnabled;
      })
      .catch(() => {
        cachedTimerDiagnosticsEnabled = false;
        return false;
      });
  }

  return timerDiagnosticsEnabledPromise;
}

function buildTimerDiagnosticsPayload(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  payload: Omit<TimerDiagnosticsPayload, 'overlayMode' | 'zoneName' | 'act' | 'component'>
): TimerDiagnosticsPayload {
  return {
    ...payload,
    overlayMode: diagnostics?.overlayMode ?? null,
    zoneName: diagnostics?.zoneName ?? null,
    act: diagnostics?.act ?? null,
    component: diagnostics?.component ?? null
  };
}

async function sendTimerDiagnosticsIfEnabled(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  payload: Omit<TimerDiagnosticsPayload, 'overlayMode' | 'zoneName' | 'act' | 'component'>
): Promise<boolean> {
  if (!diagnostics || !hasTimerDiagnosticsElectronApi()) {
    return false;
  }

  const enabled = await isTimerDiagnosticsEnabled();
  if (!enabled) {
    return false;
  }

  try {
    return await window.poe2Overlay.sendTimerDiagnostics(
      buildTimerDiagnosticsPayload(diagnostics, payload)
    );
  } catch {
    return false;
  }
}

function reportTimerDiagnostics(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  payload: Omit<TimerDiagnosticsPayload, 'overlayMode' | 'zoneName' | 'act' | 'component'>
): void {
  if (!diagnostics) {
    return;
  }

  void sendTimerDiagnosticsIfEnabled(diagnostics, payload);
}

function reportTimerDiagnosticsOnce(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  payload: Omit<TimerDiagnosticsPayload, 'overlayMode' | 'zoneName' | 'act' | 'component'>
): void {
  const stateKey = payload.event;
  const currentState = oneTimeTimerDiagnosticsState.get(stateKey) ?? 'idle';
  if (currentState !== 'idle') {
    return;
  }

  oneTimeTimerDiagnosticsState.set(stateKey, 'pending');

  void sendTimerDiagnosticsIfEnabled(diagnostics, payload).then((didSend) => {
    oneTimeTimerDiagnosticsState.set(stateKey, didSend ? 'done' : 'idle');
  });
}

interface TimerVisualDisplayState {
  displayedText: string;
  displayedElapsedMs: number | null;
  displayedAtWallClockMs: number;
  timerStatus: RunTimerState['status'] | 'unknown';
  updateDelayReported: boolean;
}

const timerVisualStateByComponent = new Map<string, TimerVisualDisplayState>();

function getTimerVisualComponentKey(
  diagnostics: LiveRunTimerDiagnostics | undefined
): string | null {
  const component = diagnostics?.component?.trim();

  if (!component) {
    return null;
  }

  if (component.endsWith('act-time-text')) {
    return `${component}:${String(diagnostics?.act ?? 'unknown')}`;
  }

  return component;
}

function reportTimerVisualTransitionAnomalies(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  previousState: TimerVisualDisplayState,
  nextDisplayedText: string,
  nextDisplayedElapsedMs: number | null,
  nextStatus: RunTimerState['status'] | 'unknown',
  options: {
    source: string;
    note?: string | null;
    reportRemount?: boolean;
  }
): boolean {
  const wallClockDeltaMs = Math.max(
    0,
    Date.now() - previousState.displayedAtWallClockMs
  );
  const previousDisplayedElapsedMs = previousState.displayedElapsedMs;
  const hasNumericElapsed =
    typeof previousDisplayedElapsedMs === 'number' &&
    typeof nextDisplayedElapsedMs === 'number';
  const displayDeltaMs = hasNumericElapsed
    ? Math.round(nextDisplayedElapsedMs - previousDisplayedElapsedMs)
    : null;
  const isRunning = nextStatus === 'running';
  const isPaused = nextStatus === 'paused';
  const basePayload = {
    source: options.source,
    isRunning,
    isPaused,
    timerStatus: nextStatus,
    previousStatus: previousState.timerStatus,
    nextStatus,
    previousDisplayedText: previousState.displayedText,
    nextDisplayedText,
    previousDisplayedElapsedMs,
    nextDisplayedElapsedMs,
    displayDeltaMs,
    wallClockDeltaMs,
    documentHidden: document.hidden,
    visibilityState: document.visibilityState
  } satisfies Omit<
    TimerDiagnosticsPayload,
    'event' | 'overlayMode' | 'zoneName' | 'act' | 'component'
  >;

  if (options.reportRemount && isRunning) {
    reportTimerDiagnostics(diagnostics, {
      event: 'timer-renderer-mount',
      ...basePayload,
      note: options.note ?? 'remount-while-running'
    });
  }

  if (!isRunning) {
    return false;
  }

  let delayReported = false;

  if (
    !previousState.updateDelayReported &&
    wallClockDeltaMs > TIMER_DIAGNOSTICS_VISUAL_UPDATE_DELAY_THRESHOLD_MS
  ) {
    delayReported = true;
    reportTimerDiagnostics(diagnostics, {
      event: 'timer-visual-update-delay',
      ...basePayload,
      note: options.note ?? 'wall-clock-gap-between-visual-updates'
    });
  }

  if (
    displayDeltaMs !== null &&
    displayDeltaMs > TIMER_DIAGNOSTICS_DISPLAY_JUMP_THRESHOLD_MS
  ) {
    reportTimerDiagnostics(diagnostics, {
      event: 'timer-visual-display-jump',
      ...basePayload,
      note: 'displayed-elapsed-advanced-too-far'
    });
  }

  if (
    typeof nextDisplayedElapsedMs === 'number' &&
    typeof previousDisplayedElapsedMs === 'number' &&
    nextDisplayedElapsedMs < previousDisplayedElapsedMs
  ) {
    reportTimerDiagnostics(diagnostics, {
      event: 'timer-visual-elapsed-backwards',
      ...basePayload,
      note: 'displayed-elapsed-went-backward'
    });
  }

  return delayReported;
}

let lastExternalVisualTickPerfMs: number | null = null;
let lastExternalVisualTickWarningAtMs = 0;

function warnOnExternalVisualTickDrift(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  runTimer: RunTimerState | null | undefined,
  nowMs: number
): void {
  if (!diagnostics) {
    return;
  }

  const perfNow = performance.now();
  const previousPerfMs = lastExternalVisualTickPerfMs;
  lastExternalVisualTickPerfMs = perfNow;

  if (previousPerfMs === null) {
    return;
  }

  const driftMs = perfNow - previousPerfMs - TIMER_VISUAL_HEARTBEAT_MS;
  const actualTickMs = perfNow - previousPerfMs;
  const warningNow = Date.now();

  if (driftMs > TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS) {
    reportTimerDiagnostics(diagnostics, {
      event: 'timer-tick-delay',
      source: 'renderer.external-heartbeat',
      expectedTickMs: TIMER_VISUAL_HEARTBEAT_MS,
      actualTickMs: Math.round(actualTickMs),
      tickDelayMs: Math.round(driftMs),
      timerStatus: runTimer?.status ?? 'unknown',
      totalElapsedMs: runTimer ? getRunTimerDisplayElapsed(runTimer, nowMs) : 0,
      currentElapsedMs: runTimer ? getRunTimerDisplayElapsed(runTimer, nowMs) : 0,
      documentHidden: document.hidden,
      visibilityState: document.visibilityState,
      note: 'renderer-thread-stall-symptom'
    });
  }

  if (
    driftMs <= TIMER_DRIFT_WARNING_MS ||
    warningNow - lastExternalVisualTickWarningAtMs < TIMER_DRIFT_WARNING_INTERVAL_MS
  ) {
    return;
  }

  lastExternalVisualTickWarningAtMs = warningNow;

  console.warn('[TimerDrift]', {
    driftMs: Math.round(driftMs),
    source: 'main-heartbeat',
    documentHidden: document.hidden,
    visibilityState: document.visibilityState,
    timerStatus: runTimer?.status ?? 'unknown',
    overlayMode: diagnostics.overlayMode ?? null,
    elapsedMs: runTimer ? getRunTimerDisplayElapsed(runTimer, nowMs) : 0
  });
}

function reportTimerDisplayJump(
  diagnostics: LiveRunTimerDiagnostics | undefined,
  runTimer: RunTimerState | null | undefined,
  previousElapsedMs: number | null,
  currentElapsedMs: number,
  previousStatus: RunTimerState['status'] | 'unknown' | null,
  currentStatus: RunTimerState['status'] | 'unknown'
): void {
  if (previousElapsedMs === null || !runTimer) {
    return;
  }

  if (previousStatus !== currentStatus) {
    return;
  }

  if (currentStatus !== 'running' && currentStatus !== 'paused') {
    return;
  }

  const displayDeltaMs = currentElapsedMs - previousElapsedMs;

  if (
    displayDeltaMs >= 0 &&
    displayDeltaMs <= TIMER_DIAGNOSTICS_DISPLAY_JUMP_THRESHOLD_MS
  ) {
    return;
  }

  reportTimerDiagnostics(diagnostics, {
    event: 'timer-display-jump',
    source: 'renderer.display',
    timerStatus: currentStatus,
    totalElapsedMs: currentElapsedMs,
    lastRenderedElapsedMs: previousElapsedMs,
    currentElapsedMs,
    displayDeltaMs,
    documentHidden: document.hidden,
    visibilityState: document.visibilityState,
    note: displayDeltaMs < 0 ? 'elapsed-went-backward' : 'large-display-jump'
  });
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
  const scheduledTickDelayMsRef = useRef<number | null>(null);
  const lastDriftWarningAtRef = useRef(0);
  const lastSnapshotReceivedAtRef = useRef(Date.now());
  const lastPublishedElapsedMsRef = useRef<number | null>(
    effectiveRunTimer ? getRunTimerDisplayElapsed(effectiveRunTimer, initialNowMs) : 0
  );
  const lastPublishedStatusRef = useRef<RunTimerState['status'] | 'unknown'>(
    effectiveRunTimer?.status ?? 'unknown'
  );
  const [timerState, setTimerState] = useState(() =>
    createLiveRunTimerState(effectiveRunTimer, settings, initialNowMs)
  );

  useEffect(() => {
    if (!diagnostics?.component) {
      return;
    }

    reportTimerDiagnostics(diagnostics, {
      event: 'timer-renderer-mount',
      source: 'renderer.mount',
      timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
      totalElapsedMs: latestTimerRef.current.runTimer
        ? getRunTimerDisplayElapsed(latestTimerRef.current.runTimer, computedNowMsRef.current)
        : 0,
      note: 'local-timeout'
    });

    return () => {
      reportTimerDiagnostics(latestTimerRef.current.diagnostics, {
        event: 'timer-renderer-unmount',
        source: 'renderer.unmount',
        timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
        totalElapsedMs: latestTimerRef.current.runTimer
          ? getRunTimerDisplayElapsed(latestTimerRef.current.runTimer, computedNowMsRef.current)
          : 0,
        note: 'local-timeout'
      });
    };
  }, [diagnostics?.component]);

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
    scheduledTickDelayMsRef.current = null;
    const nextElapsedMs = effectiveRunTimer
      ? getRunTimerDisplayElapsed(effectiveRunTimer, nextNowMs)
      : 0;
    reportTimerDisplayJump(
      latestTimerRef.current.diagnostics,
      effectiveRunTimer,
      lastPublishedElapsedMsRef.current,
      nextElapsedMs,
      lastPublishedStatusRef.current,
      effectiveRunTimer?.status ?? 'unknown'
    );
    lastPublishedElapsedMsRef.current = nextElapsedMs;
    lastPublishedStatusRef.current = effectiveRunTimer?.status ?? 'unknown';
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
        scheduledTickDelayMsRef.current = null;
        return;
      }

      scheduledTickDelayMsRef.current = delayMs;
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
      const expectedTickMs = scheduledTickDelayMsRef.current;
      expectedTickPerfMsRef.current = null;
      scheduledTickDelayMsRef.current = null;

      if (expectedTickPerfMs !== null) {
        const driftMs = perfNow - expectedTickPerfMs;
        warnOnDrift(driftMs, computedNowMsRef.current);
        if (
          driftMs > TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS &&
          expectedTickMs !== null
        ) {
          const latest = latestTimerRef.current;
          const currentElapsedMs = latest.runTimer
            ? getRunTimerDisplayElapsed(latest.runTimer, computedNowMsRef.current)
            : 0;
          reportTimerDiagnostics(latest.diagnostics, {
            event: 'timer-tick-delay',
            source: 'renderer.local-timeout',
            expectedTickMs: Math.round(expectedTickMs),
            actualTickMs: Math.round(expectedTickMs + driftMs),
            tickDelayMs: Math.round(driftMs),
            timerStatus: latest.runTimer?.status ?? 'unknown',
            totalElapsedMs: currentElapsedMs,
            currentElapsedMs,
            documentHidden: document.hidden,
            visibilityState: document.visibilityState,
            note: 'renderer-thread-stall-symptom'
          });
        }
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
        const currentElapsedMs = latest.runTimer
          ? getRunTimerDisplayElapsed(latest.runTimer, nextNowMs)
          : 0;
        reportTimerDisplayJump(
          latest.diagnostics,
          latest.runTimer,
          lastPublishedElapsedMsRef.current,
          currentElapsedMs,
          lastPublishedStatusRef.current,
          latest.runTimer?.status ?? 'unknown'
        );
        lastPublishedElapsedMsRef.current = currentElapsedMs;
        lastPublishedStatusRef.current = latest.runTimer?.status ?? 'unknown';
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
      scheduledTickDelayMsRef.current = null;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [minimumDelayMs, shouldTick]);

  return timerState;
}


export type LiveRunTimerTextFormatter = (
  state: LiveRunTimerState
) => LiveRunTimerTextFrame;

export function useLiveRunTimerText<TElement extends HTMLElement>(
  textRef: RefObject<TElement | null>,
  runTimer: RunTimerState | null | undefined,
  settings: RunTimerSettings | null | undefined,
  snapshotNowMs: number | null | undefined,
  formatter: LiveRunTimerTextFormatter,
  minimumDelayMs = 32,
  diagnostics?: LiveRunTimerDiagnostics
): void {
  const resolvedSnapshotNowMs = snapshotNowMs ?? Date.now();
  const initialNowMs = Math.max(resolvedSnapshotNowMs, Date.now());
  const effectiveRunTimer = runTimer ?? null;
  const shouldTick = shouldTickRunTimer(effectiveRunTimer, settings);
  const usesExternalVisualTick = hasTimerVisualTickElectronApi();
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

  const formatterRef = useRef(formatter);
  formatterRef.current = formatter;

  const anchorRef = useRef({
    nowMs: initialNowMs,
    perfMs: performance.now()
  });
  const computedNowMsRef = useRef(initialNowMs);
  const publishedNowMsRef = useRef(initialNowMs);
  const expectedTickPerfMsRef = useRef<number | null>(null);
  const scheduledTickDelayMsRef = useRef<number | null>(null);
  const lastDriftWarningAtRef = useRef(0);
  const lastSnapshotReceivedAtRef = useRef(Date.now());
  const lastPublishedTextRef = useRef<string | null>(null);
  const lastPublishedComponentKeyRef = useRef<string | null>(null);
  const staleCheckTimeoutIdRef = useRef<number | null>(null);
  const textRenderTaskRef = useRef<OverlayRenderTask | null>(null);
  const pendingTextNowMsRef = useRef(initialNowMs);
  const timerTextRenderRequestCountRef = useRef(0);
  const timerTextCommitCountRef = useRef(0);
  const rendererVisualTickCountRef = useRef(0);
  const lastTimerTextCommittedAtMsRef = useRef<number | null>(null);

  const clearStaleCheckTimeout = () => {
    if (staleCheckTimeoutIdRef.current !== null) {
      window.clearTimeout(staleCheckTimeoutIdRef.current);
      staleCheckTimeoutIdRef.current = null;
    }
  };

  const clearPendingTextRenderTask = () => {
    if (textRenderTaskRef.current !== null) {
      textRenderTaskRef.current.cancel();
      textRenderTaskRef.current = null;
    }
  };

  useEffect(() => {
    if (!diagnostics?.component) {
      return;
    }

    const totalElapsedMs = latestTimerRef.current.runTimer
      ? getRunTimerDisplayElapsed(
          latestTimerRef.current.runTimer,
          computedNowMsRef.current
        )
      : 0;

    reportTimerDiagnosticsOnce(diagnostics, {
      event: 'timer-diagnostics-enabled',
      source: 'renderer',
      timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
      totalElapsedMs,
      note: 'renderer-confirmed-preload-diagnostics-flag',
      documentHidden: document.hidden,
      visibilityState: document.visibilityState
    });

    reportTimerDiagnosticsOnce(diagnostics, {
      event: 'timer-visual-diagnostics-ready',
      source: 'renderer.visual-text',
      timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
      totalElapsedMs,
      note: 'useLiveRunTimerText-initialized',
      documentHidden: document.hidden,
      visibilityState: document.visibilityState
    });

    reportOverlayRenderDiagnosticsOnce(
      `timer-text-render-scheduler-ready:${diagnostics.component}`,
      {
        event: 'overlay-render-scheduler-ready',
        source: 'renderer.timer-text',
        component: diagnostics.component,
        overlayMode: diagnostics.overlayMode ?? null,
        zoneName: diagnostics.zoneName ?? null,
        act: diagnostics.act ?? null,
        timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
        totalElapsedMs,
        note: 'timer-text-raf-timeout-fallback-ready',
        documentHidden: document.hidden,
        visibilityState: document.visibilityState
      }
    );
  }, [diagnostics?.component]);

  useEffect(() => {
    if (!diagnostics?.component) {
      return;
    }

    reportTimerDiagnostics(diagnostics, {
      event: 'timer-renderer-mount',
      source: 'renderer.mount',
      timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
      totalElapsedMs: latestTimerRef.current.runTimer
        ? getRunTimerDisplayElapsed(
            latestTimerRef.current.runTimer,
            computedNowMsRef.current
          )
        : 0,
      note: 'visual-text-hook'
    });

    return () => {
      reportTimerDiagnostics(latestTimerRef.current.diagnostics, {
        event: 'timer-renderer-unmount',
        source: 'renderer.unmount',
        timerStatus: latestTimerRef.current.runTimer?.status ?? 'unknown',
        totalElapsedMs: latestTimerRef.current.runTimer
          ? getRunTimerDisplayElapsed(
              latestTimerRef.current.runTimer,
              computedNowMsRef.current
            )
          : 0,
        note: 'visual-text-hook'
      });
    };
  }, [diagnostics?.component]);

  const scheduleStaleCheck = (componentKey: string | null) => {
    clearStaleCheckTimeout();

    if (!componentKey) {
      return;
    }

    const currentState = timerVisualStateByComponent.get(componentKey);
    if (!currentState || currentState.timerStatus !== 'running') {
      return;
    }

    staleCheckTimeoutIdRef.current = window.setTimeout(() => {
      staleCheckTimeoutIdRef.current = null;
      const latest = latestTimerRef.current;

      if (latest.runTimer?.status !== 'running') {
        return;
      }

      if (getTimerVisualComponentKey(latest.diagnostics) !== componentKey) {
        return;
      }

      const staleState = timerVisualStateByComponent.get(componentKey);
      if (!staleState || staleState.timerStatus !== 'running') {
        return;
      }

      const wallClockDeltaMs = Math.max(
        0,
        Date.now() - staleState.displayedAtWallClockMs
      );

      if (
        staleState.updateDelayReported ||
        wallClockDeltaMs <= TIMER_DIAGNOSTICS_VISUAL_STALE_THRESHOLD_MS
      ) {
        return;
      }

      reportTimerDiagnostics(latest.diagnostics, {
        event: 'timer-visual-update-delay',
        source: 'renderer.visual-watchdog',
        isRunning: true,
        isPaused: false,
        timerStatus: 'running',
        previousStatus: staleState.timerStatus,
        nextStatus: 'running',
        previousDisplayedText: staleState.displayedText,
        nextDisplayedText: staleState.displayedText,
        previousDisplayedElapsedMs: staleState.displayedElapsedMs,
        nextDisplayedElapsedMs: staleState.displayedElapsedMs,
        displayDeltaMs: 0,
        wallClockDeltaMs,
        documentHidden: document.hidden,
        visibilityState: document.visibilityState,
        note: 'text-stale-while-running'
      });

      timerVisualStateByComponent.set(componentKey, {
        ...staleState,
        updateDelayReported: true
      });
    }, TIMER_DIAGNOSTICS_VISUAL_STALE_THRESHOLD_MS);
  };

  const publishText = (nowMs: number) => {
    const latest = latestTimerRef.current;
    const componentKey = getTimerVisualComponentKey(latest.diagnostics);
    const nextFrame = formatterRef.current(
      createLiveRunTimerState(latest.runTimer, latest.settings, nowMs)
    );
    const nextText = nextFrame.text;
    const nextDisplayedElapsedMs =
      typeof nextFrame.displayedElapsedMs === 'number'
        ? Math.round(nextFrame.displayedElapsedMs)
        : null;
    const nextStatus = latest.runTimer?.status ?? 'unknown';

    if (nextText === null) {
      clearStaleCheckTimeout();
      return;
    }

    const isSameVisualText =
      lastPublishedTextRef.current === nextText &&
      lastPublishedComponentKeyRef.current === componentKey;

    if (isSameVisualText) {
      if (componentKey) {
        const currentState = timerVisualStateByComponent.get(componentKey);
        if (currentState && currentState.timerStatus !== nextStatus) {
          timerVisualStateByComponent.set(componentKey, {
            ...currentState,
            displayedAtWallClockMs: Date.now(),
            timerStatus: nextStatus,
            updateDelayReported: false
          });
          scheduleStaleCheck(componentKey);
        } else if (nextStatus !== 'running') {
          clearStaleCheckTimeout();
        }
      }
      return;
    }

    const previousState = componentKey
      ? timerVisualStateByComponent.get(componentKey) ?? null
      : null;
    const statusChanged =
      previousState !== null && previousState.timerStatus !== nextStatus;

    if (previousState && !statusChanged) {
      const reportRemount =
        lastPublishedTextRef.current === null &&
        lastPublishedComponentKeyRef.current === null;
      const delayReported = reportTimerVisualTransitionAnomalies(
        latest.diagnostics,
        previousState,
        nextText,
        nextDisplayedElapsedMs,
        nextStatus,
        {
          source: 'renderer.visual-text',
          note: reportRemount ? 'remount-while-running' : null,
          reportRemount
        }
      );

      if (componentKey) {
        timerVisualStateByComponent.set(componentKey, {
          displayedText: nextText,
          displayedElapsedMs: nextDisplayedElapsedMs,
          displayedAtWallClockMs: Date.now(),
          timerStatus: nextStatus,
          updateDelayReported: delayReported
        });
      }
    } else if (componentKey) {
      // Start/resume/reset/finish transitions intentionally reset the visual
      // diagnostics baseline. A legitimate state transition can change the
      // displayed text by a large amount, but it is not a visual stutter.
      timerVisualStateByComponent.set(componentKey, {
        displayedText: nextText,
        displayedElapsedMs: nextDisplayedElapsedMs,
        displayedAtWallClockMs: Date.now(),
        timerStatus: nextStatus,
        updateDelayReported: false
      });
    }

    if (textRef.current) {
      textRef.current.textContent = nextText;
    }

    lastPublishedTextRef.current = nextText;
    lastPublishedComponentKeyRef.current = componentKey;
    scheduleStaleCheck(componentKey);
  };

  const schedulePublishText = (nowMs: number, renderSource: string) => {
    pendingTextNowMsRef.current = Math.max(pendingTextNowMsRef.current, nowMs);
    timerTextRenderRequestCountRef.current += 1;

    if (textRenderTaskRef.current !== null) {
      return;
    }

    textRenderTaskRef.current = scheduleOverlayRenderCommit({
      source: `timer-text:${renderSource}`,
      fallbackMs: 16,
      commit: (info) => {
        textRenderTaskRef.current = null;
        timerTextCommitCountRef.current += 1;
        lastTimerTextCommittedAtMsRef.current = Date.now();

        const nextNowMs = Math.max(
          pendingTextNowMsRef.current,
          Date.now(),
          computedNowMsRef.current
        );
        computedNowMsRef.current = nextNowMs;
        publishedNowMsRef.current = nextNowMs;

        const latest = latestTimerRef.current;
        if (shouldReportOverlayRenderDelay(info.delayMs, info.reason)) {
          reportOverlayRenderDiagnostics({
            event: 'overlay-render-commit-delay',
            source: 'renderer.timer-text',
            component: latest.diagnostics?.component ?? null,
            overlayMode: latest.diagnostics?.overlayMode ?? null,
            zoneName: latest.diagnostics?.zoneName ?? null,
            act: latest.diagnostics?.act ?? null,
            renderSource,
            renderReason: info.reason,
            renderDelayMs: info.delayMs,
            renderCommitCount: timerTextCommitCountRef.current,
            rendererVisualTickCount: rendererVisualTickCountRef.current,
            lastRenderCommittedAtMs: lastTimerTextCommittedAtMsRef.current,
            timerStatus: latest.runTimer?.status ?? 'unknown',
            totalElapsedMs: latest.runTimer
              ? getRunTimerDisplayElapsed(latest.runTimer, nextNowMs)
              : 0,
            note: 'timer-text-commit-delayed',
            documentHidden: document.hidden,
            visibilityState: document.visibilityState
          });
        }

        publishText(nextNowMs);
      }
    });
  };

  useEffect(() => {
    lastSnapshotReceivedAtRef.current = Date.now();
  }, [resolvedSnapshotNowMs]);

  useEffect(() => {
    if (!usesExternalVisualTick) {
      return;
    }

    const unsubscribe = window.poe2Overlay.onTimerVisualTick((payload) => {
      const latest = latestTimerRef.current;
      const nextNowMs = Math.max(
        Number.isFinite(payload?.now) ? payload.now : 0,
        Date.now(),
        computedNowMsRef.current
      );

      warnOnExternalVisualTickDrift(
        latest.diagnostics,
        latest.runTimer,
        nextNowMs
      );

      computedNowMsRef.current = nextNowMs;
      publishedNowMsRef.current = nextNowMs;
      expectedTickPerfMsRef.current = null;
      scheduledTickDelayMsRef.current = null;
      rendererVisualTickCountRef.current += 1;
      schedulePublishText(nextNowMs, 'main-visual-heartbeat');
    });

    return unsubscribe;
  }, [usesExternalVisualTick]);

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
    scheduledTickDelayMsRef.current = null;
    schedulePublishText(nextNowMs, 'snapshot-or-timer-state');
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
    settings?.leagueStartAt,
    formatter
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
        scheduledTickDelayMsRef.current = null;
        return;
      }

      scheduledTickDelayMsRef.current = delayMs;
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
      const expectedTickMs = scheduledTickDelayMsRef.current;
      expectedTickPerfMsRef.current = null;
      scheduledTickDelayMsRef.current = null;

      if (expectedTickPerfMs !== null) {
        const driftMs = perfNow - expectedTickPerfMs;
        warnOnDrift(driftMs, computedNowMsRef.current);
        if (
          driftMs > TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS &&
          expectedTickMs !== null
        ) {
          const latest = latestTimerRef.current;
          const currentElapsedMs = latest.runTimer
            ? getRunTimerDisplayElapsed(latest.runTimer, computedNowMsRef.current)
            : 0;
          reportTimerDiagnostics(latest.diagnostics, {
            event: 'timer-tick-delay',
            source: 'renderer.local-timeout',
            expectedTickMs: Math.round(expectedTickMs),
            actualTickMs: Math.round(expectedTickMs + driftMs),
            tickDelayMs: Math.round(driftMs),
            timerStatus: latest.runTimer?.status ?? 'unknown',
            totalElapsedMs: currentElapsedMs,
            currentElapsedMs,
            documentHidden: document.hidden,
            visibilityState: document.visibilityState,
            note: 'renderer-thread-stall-symptom'
          });
        }
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
        schedulePublishText(nextNowMs, 'renderer-local-timeout');
      }

      scheduleNextTick();
    };

    scheduleNextTick();

    return () => {
      cancelled = true;
      expectedTickPerfMsRef.current = null;
      scheduledTickDelayMsRef.current = null;
      clearStaleCheckTimeout();
      clearPendingTextRenderTask();

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [minimumDelayMs, shouldTick]);

  useEffect(() => () => {
    clearStaleCheckTimeout();
    clearPendingTextRenderTask();
  }, []);
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
