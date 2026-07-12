import { getActTimeRowsFromSplits, type ActTimeRow } from './companion-helpers';
import { formatDuration } from '../shared/timers';
import type { SavedRunHistoryEntry, ZoneTimeEntry } from '../shared/types';

const MAX_ZONE_HISTORY_DETAIL_SOURCE_ROWS = 240;

export interface RunHistoryActDetailRow extends ActTimeRow {
  previousDeltaMs: number | null;
  bestDeltaMs: number | null;
}

export interface RunHistoryZoneDetailRow extends ZoneTimeEntry {
  previousDeltaMs: number | null;
  bestDeltaMs: number | null;
}

export interface RunHistoryDetailModel {
  history: SavedRunHistoryEntry[];
  selectedRun: SavedRunHistoryEntry | null;
  previousRun: SavedRunHistoryEntry | null;
  bestRun: SavedRunHistoryEntry | null;
  startedAt: number | null;
  finishedAt: number | null;
  actRows: RunHistoryActDetailRow[];
  zoneRows: RunHistoryZoneDetailRow[];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getRunHistoryActRows(entry: SavedRunHistoryEntry | null): ActTimeRow[] {
  if (!entry) {
    return [];
  }

  return getActTimeRowsFromSplits(
    Array.isArray(entry.actSplits) ? entry.actSplits : [],
    isFiniteNumber(entry.totalElapsedMs) ? entry.totalElapsedMs : 0,
    {
      currentAct: typeof entry.currentAct === 'number' ? entry.currentAct : null,
      includeCurrentAct: entry.status !== 'finished',
      currentStatus: entry.status
    }
  );
}

function pushUniqueZoneRows(target: ZoneTimeEntry[], rows: ZoneTimeEntry[]): void {
  const seen = new Set(target.map((zone) => `${zone.zoneId}:${zone.enteredAt}:${zone.leftAt}`));

  for (const zone of rows) {
    const key = `${zone.zoneId}:${zone.enteredAt}:${zone.leftAt}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    target.push(zone);
  }
}

function getBoundedZoneSourceRows(entry: SavedRunHistoryEntry | null): ZoneTimeEntry[] {
  if (!entry) {
    return [];
  }

  const fullHistory = Array.isArray(entry.zoneTimeHistory) ? entry.zoneTimeHistory : [];
  const longestZones = Array.isArray(entry.longestZones) ? entry.longestZones : [];
  if (fullHistory.length === 0) {
    return longestZones;
  }

  const boundedRows = fullHistory.slice(-MAX_ZONE_HISTORY_DETAIL_SOURCE_ROWS);
  pushUniqueZoneRows(boundedRows, longestZones);
  return boundedRows;
}

function pushTopZoneRow(topRows: ZoneTimeEntry[], zone: ZoneTimeEntry, maxRows: number): void {
  const insertIndex = topRows.findIndex((candidate) => zone.elapsedMs > candidate.elapsedMs);
  const nextIndex = insertIndex === -1 ? topRows.length : insertIndex;

  if (nextIndex >= maxRows) {
    return;
  }

  topRows.splice(nextIndex, 0, zone);
  if (topRows.length > maxRows) {
    topRows.length = maxRows;
  }
}

function getTopZoneRows(entry: SavedRunHistoryEntry | null, maxRows: number): ZoneTimeEntry[] {
  const topRows: ZoneTimeEntry[] = [];

  for (const zone of getBoundedZoneSourceRows(entry)) {
    if (!isFiniteNumber(zone.elapsedMs) || zone.elapsedMs <= 0) {
      continue;
    }

    pushTopZoneRow(topRows, zone, maxRows);
  }

  return topRows;
}

function getBestZoneById(entry: SavedRunHistoryEntry | null): Map<string, ZoneTimeEntry> {
  const zonesById = new Map<string, ZoneTimeEntry>();

  for (const zone of getBoundedZoneSourceRows(entry)) {
    if (!isFiniteNumber(zone.elapsedMs) || zone.elapsedMs <= 0) {
      continue;
    }

    const current = zonesById.get(zone.zoneId);
    if (!current || zone.elapsedMs < current.elapsedMs) {
      zonesById.set(zone.zoneId, zone);
    }
  }

  return zonesById;
}

export function getBestRunFromHistory(history: SavedRunHistoryEntry[]): SavedRunHistoryEntry | null {
  let bestRun: SavedRunHistoryEntry | null = null;

  for (const entry of history) {
    if (!isFiniteNumber(entry.totalElapsedMs) || entry.totalElapsedMs <= 0) {
      continue;
    }

    if (!bestRun || entry.totalElapsedMs < bestRun.totalElapsedMs) {
      bestRun = entry;
    }
  }

  return bestRun;
}

export function getRunHistorySignature(history: SavedRunHistoryEntry[]): string {
  return history
    .map((entry) => {
      const actSplits = Array.isArray(entry.actSplits) ? entry.actSplits : [];
      const lastActSplit = actSplits[actSplits.length - 1] ?? null;
      const longestZones = Array.isArray(entry.longestZones) ? entry.longestZones : [];
      const firstLongestZone = longestZones[0] ?? null;
      const zoneTimeHistory = Array.isArray(entry.zoneTimeHistory) ? entry.zoneTimeHistory : [];
      const lastZone = zoneTimeHistory[zoneTimeHistory.length - 1] ?? null;

      return [
        entry.id,
        entry.label,
        entry.savedAt,
        entry.totalElapsedMs,
        entry.currentAct,
        entry.status,
        actSplits.length,
        lastActSplit?.act ?? '',
        lastActSplit?.elapsedMs ?? '',
        lastActSplit?.timestamp ?? '',
        longestZones.length,
        firstLongestZone?.zoneId ?? '',
        firstLongestZone?.elapsedMs ?? '',
        zoneTimeHistory.length,
        lastZone?.zoneId ?? '',
        lastZone?.elapsedMs ?? ''
      ].join(':');
    })
    .join('|');
}

export function formatRunHistoryDelta(deltaMs: number | null): string {
  if (deltaMs === null) {
    return '—';
  }

  if (deltaMs === 0) {
    return '±00:00';
  }

  return `${deltaMs > 0 ? '+' : '-'}${formatDuration(Math.abs(deltaMs))}`;
}

export function getRunHistoryDeltaClass(deltaMs: number | null): string {
  if (deltaMs === null) {
    return '';
  }

  return deltaMs <= 0 ? 'delta-good' : 'delta-bad';
}

export function buildRunHistoryDetailModel(
  history: SavedRunHistoryEntry[],
  selectedRunId: string | null = null,
  maxZoneRows = 8
): RunHistoryDetailModel {
  const sortedHistory = [...history].sort((left, right) => right.savedAt - left.savedAt);
  const selectedRun = selectedRunId
    ? sortedHistory.find((entry) => entry.id === selectedRunId) ?? sortedHistory[0] ?? null
    : sortedHistory[0] ?? null;
  const selectedIndex = selectedRun ? sortedHistory.findIndex((entry) => entry.id === selectedRun.id) : -1;
  const previousRun = selectedIndex >= 0 ? sortedHistory[selectedIndex + 1] ?? null : null;
  const bestRun = getBestRunFromHistory(sortedHistory);
  const previousRowsByAct = new Map(getRunHistoryActRows(previousRun).map((row) => [row.act, row]));
  const bestRowsByAct = new Map(getRunHistoryActRows(bestRun).map((row) => [row.act, row]));
  const previousZonesById = getBestZoneById(previousRun);
  const bestZonesById = getBestZoneById(bestRun);

  const actRows = getRunHistoryActRows(selectedRun).map((row) => {
    const previousRow = previousRowsByAct.get(row.act);
    const bestRow = bestRowsByAct.get(row.act);
    return {
      ...row,
      previousDeltaMs: previousRow ? row.elapsedMs - previousRow.elapsedMs : null,
      bestDeltaMs: bestRow ? row.elapsedMs - bestRow.elapsedMs : null
    };
  });

  const zoneRows = getTopZoneRows(selectedRun, maxZoneRows)
    .map((zone) => {
      const previousZone = previousZonesById.get(zone.zoneId);
      const bestZone = bestZonesById.get(zone.zoneId);
      return {
        ...zone,
        previousDeltaMs: previousZone ? zone.elapsedMs - previousZone.elapsedMs : null,
        bestDeltaMs: bestZone ? zone.elapsedMs - bestZone.elapsedMs : null
      };
    });

  return {
    history: sortedHistory,
    selectedRun,
    previousRun,
    bestRun,
    startedAt: selectedRun && isFiniteNumber(selectedRun.runTimer?.startedAt) ? selectedRun.runTimer.startedAt : null,
    finishedAt: selectedRun && isFiniteNumber(selectedRun.runTimer?.finishedAt) ? selectedRun.runTimer.finishedAt : null,
    actRows,
    zoneRows
  };
}
