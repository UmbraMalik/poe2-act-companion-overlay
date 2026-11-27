export const LOG_HEALTH_STALE_AFTER_MS = 120_000;

export function isLogActivityRecent(timestamp: string | null, nowMs = Date.now()): boolean {
  const time = timestamp ? Date.parse(timestamp) : NaN;
  return Number.isFinite(time) && nowMs - time <= LOG_HEALTH_STALE_AFTER_MS;
}
