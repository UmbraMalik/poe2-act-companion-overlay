import { useEffect, useState } from 'react';
import type { AppSnapshot } from '../../shared/types';
import { getPreviewSnapshot } from '../preview-snapshot';

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
