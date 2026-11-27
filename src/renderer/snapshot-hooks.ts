import {
  useEffect,
  useState
} from 'react';
import type {
  AppSnapshot,
  OverlaySnapshot,
  UiPreferencesSnapshot
} from '../shared/types';
import {
  getPreviewSnapshot
} from './preview-snapshot';
import {
  reportOverlayRenderDiagnostics,
  reportOverlayRenderDiagnosticsOnce,
  shouldReportOverlayRenderDelay
} from './render-diagnostics';
import {
  scheduleOverlayRenderCommit,
  type OverlayRenderTask
} from './render-scheduler';

export interface UseAppSnapshotOptions {
  enabled?: boolean;
  initialSnapshot?: 'full' | 'overlay';
}

export function useAppSnapshot(options: UseAppSnapshotOptions & { initialSnapshot: 'overlay' }): OverlaySnapshot | null;

export function useAppSnapshot(options?: UseAppSnapshotOptions): AppSnapshot | null;

export function useAppSnapshot(options: UseAppSnapshotOptions = {}) {
  const enabled = options.enabled ?? true;
  const initialSnapshot = options.initialSnapshot ?? 'full';
  const [snapshot, setSnapshot] = useState<AppSnapshot | OverlaySnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!enabled) {
      setSnapshot(null);
      return () => {
        isMounted = false;
      };
    }

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

    const initialSnapshotPromise = initialSnapshot === 'overlay' &&
      typeof window.poe2Overlay.getOverlaySnapshot === 'function'
      ? window.poe2Overlay.getOverlaySnapshot()
      : window.poe2Overlay.getSnapshot();

    void initialSnapshotPromise.then((nextSnapshot) => {
      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    });

    let pendingSnapshot: AppSnapshot | OverlaySnapshot | null = null;
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
  }, [enabled, initialSnapshot]);

  return snapshot;
}

export function useUiPreferencesSnapshot() {
  const [snapshot, setSnapshot] = useState<UiPreferencesSnapshot | null>(null);

  useEffect(() => {
    let isMounted = true;
    const previewMode =
      new URLSearchParams(window.location.search).get('preview') === '1';
    const hasElectronApi =
      typeof window !== 'undefined' &&
      typeof window.poe2Overlay !== 'undefined';

    if (previewMode || !hasElectronApi) {
      const previewSnapshot = getPreviewSnapshot();
      setSnapshot({
        config: {
          appLanguage: previewSnapshot.config.appLanguage,
          theme: previewSnapshot.config.theme,
          visualFxIntensity: previewSnapshot.config.visualFxIntensity
        }
      });
      return () => {
        isMounted = false;
      };
    }

    void window.poe2Overlay.getUiPreferencesSnapshot().then((nextSnapshot) => {
      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    });

    const unsubscribe = window.poe2Overlay.onUiPreferencesChanged((nextSnapshot) => {
      if (isMounted) {
        setSnapshot(nextSnapshot);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return snapshot;
}
