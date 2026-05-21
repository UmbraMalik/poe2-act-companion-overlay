import { useEffect, useState } from 'react';
import type { AppSnapshot } from '../../shared/types';
import { getPreviewSnapshot } from '../preview-snapshot';
import {
  reportOverlayRenderDiagnostics,
  reportOverlayRenderDiagnosticsOnce,
  shouldReportOverlayRenderDelay
} from '../render-diagnostics';
import {
  scheduleOverlayRenderCommit,
  type OverlayRenderTask
} from '../render-scheduler';

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
