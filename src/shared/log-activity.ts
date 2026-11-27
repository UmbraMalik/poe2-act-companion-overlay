export const LOG_HEALTH_STALE_AFTER_MS = 120_000;

export function isLogActivityRecent(timestamp: string | null, nowMs = Date.now()): boolean {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  // Allow small clock skew, but never treat a far-future mtime as live forever.
  const age = nowMs - time;
  return Number.isFinite(age) && age >= -5000 && age <= LOG_HEALTH_STALE_AFTER_MS;
}
