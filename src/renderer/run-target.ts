export function formatTargetRunTimeInput(value: number | null): string {
  if (value === null) {
    return '';
  }

  const totalMinutes = Math.max(0, Math.round(value / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function parseTargetRunTimeInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = /^(\d{1,2}):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    return Number.NaN;
  }

  const totalMs = (Number(match[1]) * 60 + Number(match[2])) * 60_000;
  return totalMs >= 10 * 60_000 && totalMs <= 72 * 60 * 60_000 ? totalMs : Number.NaN;
}
