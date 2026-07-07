import {
  buildChecklistViewItems,
  shouldItemBeMissed
} from '../shared/checklist';
import {
  getRunTimerDisplayElapsed
} from '../shared/timers';
import { getGuideView, getPowerSpikeView } from '../i18n/data';
import { translate } from '../i18n/translations';
import type {
  AppLanguage,
  AppSnapshot,
  ChecklistViewItem,
  GuideEntry,
  GuideProfile,
  LevelReminder,
  PowerSpike,
  RunTimerActSplit,
  RunTimerState,
  RunTimerStatus,
  ZoneAct,
  ZoneTimeEntry
} from '../shared/types';

export interface XpStatus {
  shortLabel: string;
  longLabel: string;
  variant: 'ok' | 'low' | 'farm' | 'unknown';
}

export interface RouteZoneStatus {
  guide: GuideEntry;
  status: 'current' | 'missed' | 'completed' | 'visited' | 'pending';
  rewardItems: ChecklistViewItem[];
  missedItems: ChecklistViewItem[];
}

export interface RouteActGroup {
  key: string;
  label: string;
  act: ZoneAct;
  zones: RouteZoneStatus[];
}

export interface RouteProgressState {
  total: number;
  currentCount: number;
  percent: number;
  currentIndex: number;
}

export interface ActTimeRow {
  act: number;
  elapsedMs: number;
  totalElapsedMs: number;
  timestamp: number | null;
  status: 'finished' | 'current';
}

function supportsProfile(
  profiles: GuideProfile[] | undefined,
  activeProfile: GuideProfile
): boolean {
  return !profiles || profiles.length === 0 || profiles.includes(activeProfile);
}

export function getRunElapsedMs(runTimer: RunTimerState, now: number): number {
  return getRunTimerDisplayElapsed(runTimer, now);
}

export function getCurrentActElapsedMsForAct(
  runTimer: RunTimerState,
  currentAct: number | null | undefined,
  now: number
): number | null {
  if (typeof currentAct !== 'number') {
    return null;
  }

  const currentRow = getActTimeRowsFromSplits(runTimer.actSplits, getRunElapsedMs(runTimer, now), {
    currentAct,
    includeCurrentAct: runTimer.status === 'running' || runTimer.status === 'paused',
    currentStatus: runTimer.status
  })
    .reverse()
    .find((row) => row.act === currentAct);

  return currentRow?.elapsedMs ?? null;
}

export function getCurrentActElapsedMs(
  runTimer: RunTimerState,
  guide: GuideEntry | null,
  now: number
): number | null {
  return getCurrentActElapsedMsForAct(
    runTimer,
    guide && typeof guide.act === 'number' ? guide.act : null,
    now
  );
}

function getSortedActSplits(actSplits: RunTimerActSplit[]): RunTimerActSplit[] {
  return [...actSplits]
    .filter(
      (split) =>
        Number.isFinite(split.act) &&
        Number.isFinite(split.elapsedMs) &&
        Number.isFinite(split.timestamp)
    )
    .sort((left, right) => left.act - right.act || left.timestamp - right.timestamp);
}

export function getActTimeRowsFromSplits(
  actSplits: RunTimerActSplit[],
  totalElapsedMs: number,
  options: {
    currentAct?: number | null;
    includeCurrentAct?: boolean;
    currentStatus?: RunTimerStatus;
  } = {}
): ActTimeRow[] {
  const sortedSplits = getSortedActSplits(actSplits);
  const rows: ActTimeRow[] = [];
  let previousTotalElapsedMs = 0;

  for (const split of sortedSplits) {
    const safeTotalElapsedMs = Math.max(previousTotalElapsedMs, split.elapsedMs);
    rows.push({
      act: split.act,
      elapsedMs: Math.max(0, safeTotalElapsedMs - previousTotalElapsedMs),
      totalElapsedMs: safeTotalElapsedMs,
      timestamp: split.timestamp,
      status: 'finished'
    });
    previousTotalElapsedMs = safeTotalElapsedMs;
  }

  const currentAct = options.currentAct ?? null;
  const includeCurrentAct = options.includeCurrentAct ?? false;
  const highestRecordedAct = sortedSplits[sortedSplits.length - 1]?.act ?? 0;

  if (
    includeCurrentAct &&
    currentAct !== null &&
    currentAct > highestRecordedAct &&
    !sortedSplits.some((split) => split.act === currentAct)
  ) {
    const safeTotalElapsedMs = Math.max(previousTotalElapsedMs, totalElapsedMs);
    rows.push({
      act: currentAct,
      elapsedMs: Math.max(0, safeTotalElapsedMs - previousTotalElapsedMs),
      totalElapsedMs: safeTotalElapsedMs,
      timestamp: null,
      status: options.currentStatus === 'finished' ? 'finished' : 'current'
    });
  }

  return rows;
}

export function getXpStatus(
  snapshot: AppSnapshot,
  language: AppLanguage = 'ru'
): XpStatus {
  const currentLevel = snapshot.config.currentLevel;
  const guide = snapshot.currentGuideEntry;
  const recommended = guide?.recommended_level ?? null;

  if (!guide || currentLevel === null || recommended === null) {
    return {
      shortLabel: translate(language, 'xp.unknownShort'),
      longLabel: translate(language, 'xp.unknownLong'),
      variant: 'unknown'
    };
  }

  if (guide.is_good_xp_zone && currentLevel < recommended) {
    return {
      shortLabel: translate(language, 'xp.farmShort'),
      longLabel: translate(language, 'xp.farmLong'),
      variant: 'farm'
    };
  }

  if (currentLevel < recommended) {
    return {
      shortLabel: translate(language, 'xp.lowShort'),
      longLabel: translate(language, 'xp.lowLong'),
      variant: 'low'
    };
  }

  if (guide.is_good_xp_zone) {
    return {
      shortLabel: translate(language, 'xp.farmShort'),
      longLabel: translate(language, 'xp.farmLong'),
      variant: 'farm'
    };
  }

  return {
    shortLabel: translate(language, 'xp.okShort'),
    longLabel: translate(language, 'xp.okLong'),
    variant: 'ok'
  };
}

export function getNearestPowerSpike(
  powerSpikes: PowerSpike[],
  currentLevel: number | null,
  profile: GuideProfile,
  maxDelta = 2
): PowerSpike | null {
  if (currentLevel === null) {
    return null;
  }

  return (
    [...powerSpikes]
      .filter((entry) => supportsProfile(entry.profiles, profile))
      .filter((entry) => entry.level >= currentLevel && entry.level - currentLevel <= maxDelta)
      .sort((left, right) => left.level - right.level)[0] ?? null
  );
}

export function getUpcomingVendorReminders(
  reminders: LevelReminder[],
  currentLevel: number | null
): LevelReminder[] {
  if (currentLevel === null) {
    return [...reminders].sort((left, right) => left.level - right.level);
  }

  return reminders
    .filter((entry) => entry.level >= currentLevel)
    .sort((left, right) => left.level - right.level);
}

export function getDismissedReminderHistory(
  reminders: LevelReminder[],
  dismissedIds: string[]
): LevelReminder[] {
  const dismissedSet = new Set(dismissedIds);
  return reminders.filter((entry) => dismissedSet.has(entry.id));
}

export function getSceneDisplayName(
  snapshot: AppSnapshot,
  language: AppLanguage = 'ru'
): string {
  const currentGuideView = getGuideView(snapshot.currentGuideEntry, language);
  const zoneGuideView = getGuideView(snapshot.currentZone.guide, language);

  if (snapshot.currentZone.sceneKind === 'gameplay') {
    return (
      currentGuideView?.zoneName ??
      zoneGuideView?.zoneName ??
      snapshot.currentZone.rawZoneName ??
      translate(language, 'scene.unknownZone')
    );
  }

  return (
    snapshot.currentZone.rawZoneName ??
    currentGuideView?.zoneName ??
    translate(language, 'scene.unknownZone')
  );
}

function getRouteRewardItems(guide: GuideEntry, snapshot: AppSnapshot): ChecklistViewItem[] {
  const zoneProgress = snapshot.config.zoneProgress[guide.id];
  const checklist = buildChecklistViewItems(guide, zoneProgress).map((item) => {
    const storedProgress = zoneProgress?.itemStates[item.id] ?? null;

    if (storedProgress?.state === 'missed' && shouldItemBeMissed(item)) {
      return {
        ...item,
        displayState: 'missed' as const,
        detectedBy: storedProgress.detectedBy,
        timestamp: storedProgress.timestamp
      };
    }

    return item;
  });

  return checklist.filter(
    (item) =>
      item.required ||
      item.type === 'boss' ||
      item.autoCompleteMode === 'linked_reward' ||
      item.displayState === 'missed'
  );
}

function isRouteRewardItemDone(item: ChecklistViewItem): boolean {
  return item.displayState === 'done' || item.displayState === 'likely_done';
}

function getRouteZoneStatus(guide: GuideEntry, snapshot: AppSnapshot): RouteZoneStatus {
  const rewardItems = getRouteRewardItems(guide, snapshot);
  const missedItems = rewardItems.filter((item) => item.displayState === 'missed');
  const completed = rewardItems.length > 0 && rewardItems.every(isRouteRewardItemDone);
  const visited = snapshot.config.visitedZones.some((entry) => entry.zoneId === guide.id);

  const status: RouteZoneStatus['status'] =
    snapshot.currentGuideEntry?.id === guide.id
      ? 'current'
      : missedItems.length > 0
        ? 'missed'
        : completed
          ? 'completed'
          : visited
            ? 'visited'
            : 'pending';

  return {
    guide,
    status,
    rewardItems,
    missedItems
  };
}


export function getRouteActs(
  snapshot: AppSnapshot,
  language: AppLanguage = 'ru'
): RouteActGroup[] {
  const grouped = new Map<string, RouteActGroup>();

  for (const guide of snapshot.guideEntries) {
    const key = guide.act === 'interlude' ? 'interlude' : `act-${guide.act}`;
    const label = guide.act === 'interlude'
      ? translate(language, 'route.interludes')
      : translate(language, 'route.act', { act: guide.act });

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label,
        act: guide.act,
        zones: []
      });
    }

    grouped.get(key)!.zones.push(getRouteZoneStatus(guide, snapshot));
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.act === 'interlude' && right.act === 'interlude') {
      return 0;
    }

    if (left.act === 'interlude') {
      return 1;
    }

    if (right.act === 'interlude') {
      return -1;
    }

    return left.act - right.act;
  });
}

export function getRouteOverviewForAct(
  snapshot: AppSnapshot,
  act: ZoneAct | null,
  language: AppLanguage = 'ru'
): RouteZoneStatus[] {
  if (act === null) {
    return [];
  }

  return getRouteActs(snapshot, language).find((entry) => entry.act === act)?.zones ?? [];
}

export function getRouteProgressState(
  routeZones: RouteZoneStatus[],
  options: {
    isSelectedRouteActCurrent: boolean;
    isSelectedRouteActBeforeCurrent: boolean;
  }
): RouteProgressState {
  const total = routeZones.length;
  const currentIndex = options.isSelectedRouteActCurrent
    ? routeZones.findIndex((entry) => entry.status === 'current')
    : -1;
  const completedCount = options.isSelectedRouteActCurrent
    ? routeZones.filter((entry, index) => (
      entry.status === 'completed' ||
      entry.status === 'visited' ||
      (currentIndex >= 0 && index < currentIndex)
    )).length
    : 0;
  const currentCount = options.isSelectedRouteActBeforeCurrent
    ? total
    : currentIndex >= 0
      ? currentIndex + 1
      : completedCount;
  const percent = total === 0
    ? 0
    : Math.min(100, Math.max(0, (currentCount / total) * 100));

  return {
    total,
    currentCount,
    percent,
    currentIndex
  };
}

export function getCurrentRouteAct(snapshot: AppSnapshot): ZoneAct | null {
  return snapshot.currentGuideEntry?.act ?? snapshot.currentZone.actHint ?? null;
}

export function getRequiredRewardLabelsForZone(
  guide: GuideEntry,
  snapshot: AppSnapshot,
  language: AppLanguage = 'ru'
): string[] {
  const guideView = getGuideView(guide, language);
  const translatedChecklist = new Map(
    (guideView?.checklist ?? []).map((item) => [item.id, item.text])
  );

  return getRouteRewardItems(guide, snapshot).map((item) => {
    const marker = item.displayState === 'current' ? '▶' : '○';
    return `${marker} ${translatedChecklist.get(item.id) ?? item.text}`;
  });
}


export function getLongestZones(zoneTimeHistory: ZoneTimeEntry[]): ZoneTimeEntry[] {
  return [...zoneTimeHistory].sort((left, right) => right.elapsedMs - left.elapsedMs).slice(0, 5);
}
