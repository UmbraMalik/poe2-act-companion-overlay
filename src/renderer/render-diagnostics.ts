import type { TimerDiagnosticsPayload } from '../shared/types';

const RENDER_DIAGNOSTICS_DELAY_THRESHOLD_MS = 64;

let cachedDiagnosticsEnabled: boolean | null = null;
let diagnosticsEnabledPromise: Promise<boolean> | null = null;
const oneTimeDiagnosticsKeys = new Set<string>();

function hasRenderDiagnosticsApi(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.poe2Overlay !== 'undefined' &&
    typeof window.poe2Overlay.isTimerDiagnosticsEnabled === 'function' &&
    typeof window.poe2Overlay.sendTimerDiagnostics === 'function'
  );
}

async function isRenderDiagnosticsEnabled(): Promise<boolean> {
  if (cachedDiagnosticsEnabled !== null) {
    return cachedDiagnosticsEnabled;
  }

  if (!hasRenderDiagnosticsApi()) {
    cachedDiagnosticsEnabled = false;
    return false;
  }

  if (!diagnosticsEnabledPromise) {
    diagnosticsEnabledPromise = window.poe2Overlay.isTimerDiagnosticsEnabled()
      .then((enabled) => {
        cachedDiagnosticsEnabled = Boolean(enabled);
        return cachedDiagnosticsEnabled;
      })
      .catch(() => {
        cachedDiagnosticsEnabled = false;
        return false;
      });
  }

  return diagnosticsEnabledPromise;
}

export function shouldReportOverlayRenderDelay(delayMs: number, reason: string): boolean {
  return reason === 'timeout-fallback' || delayMs > RENDER_DIAGNOSTICS_DELAY_THRESHOLD_MS;
}

export function reportOverlayRenderDiagnostics(payload: TimerDiagnosticsPayload): void {
  if (!hasRenderDiagnosticsApi()) {
    return;
  }

  void isRenderDiagnosticsEnabled().then((enabled) => {
    if (!enabled) {
      return;
    }

    void window.poe2Overlay.sendTimerDiagnostics(payload).catch(() => false);
  });
}

export function reportOverlayRenderDiagnosticsOnce(
  key: string,
  payload: TimerDiagnosticsPayload
): void {
  if (oneTimeDiagnosticsKeys.has(key)) {
    return;
  }

  oneTimeDiagnosticsKeys.add(key);
  reportOverlayRenderDiagnostics(payload);
}
