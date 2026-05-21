export type OverlayRenderCommitReason = 'animation-frame' | 'timeout-fallback' | 'manual-flush';

export interface OverlayRenderCommitInfo {
  source: string;
  reason: OverlayRenderCommitReason;
  scheduledAtMs: number;
  committedAtMs: number;
  delayMs: number;
  fallbackMs: number;
}

export interface OverlayRenderCommitOptions {
  source: string;
  fallbackMs?: number;
  commit: (info: OverlayRenderCommitInfo) => void;
  onCommit?: (info: OverlayRenderCommitInfo) => void;
}

export interface OverlayRenderTask {
  cancel: () => void;
  flush: (reason?: OverlayRenderCommitReason) => void;
  isPending: () => boolean;
}

const DEFAULT_RENDER_FALLBACK_MS = 16;

function getSchedulerNowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function scheduleOverlayRenderCommit({
  source,
  fallbackMs = DEFAULT_RENDER_FALLBACK_MS,
  commit,
  onCommit
}: OverlayRenderCommitOptions): OverlayRenderTask {
  const safeFallbackMs = Math.max(0, Math.floor(fallbackMs));
  const scheduledAtMs = getSchedulerNowMs();
  let frameId: number | null = null;
  let fallbackTimerId: number | null = null;
  let pending = true;

  const cancelScheduledCallbacks = () => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }

    if (fallbackTimerId !== null) {
      window.clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }
  };

  const flush = (reason: OverlayRenderCommitReason = 'manual-flush') => {
    if (!pending) {
      return;
    }

    pending = false;
    cancelScheduledCallbacks();

    const committedAtMs = getSchedulerNowMs();
    const info: OverlayRenderCommitInfo = {
      source,
      reason,
      scheduledAtMs,
      committedAtMs,
      delayMs: Math.max(0, Math.round(committedAtMs - scheduledAtMs)),
      fallbackMs: safeFallbackMs
    };

    onCommit?.(info);
    commit(info);
  };

  frameId = window.requestAnimationFrame(() => flush('animation-frame'));
  fallbackTimerId = window.setTimeout(() => flush('timeout-fallback'), safeFallbackMs);

  return {
    cancel: () => {
      pending = false;
      cancelScheduledCallbacks();
    },
    flush,
    isPending: () => pending
  };
}
