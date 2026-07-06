import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_CONFIG,
  DEFAULT_RUN_TIMER,
  DEFAULT_TOWN_TIMER,
  DEFAULT_RUN_TIMER_SETTINGS,
  DEFAULT_HOTKEYS
} from '../../shared/defaults';
import type {
  AppConfig,
  CampaignBonusProgress,
  ChecklistDetectedBy,
  ChecklistItemProgress,
  ChecklistItemState,
  HotkeySettings,
  MainOverlaySettings,
  OverlayBounds,
  OverlayDensity,
  OverlayScale,
  OverlayTextSize,
  OverlayVisibleSections,
  RunTimerActSplit,
  RunTimerState,
  RunTimerStatus,
  SavedRunHistoryEntry,
  SettingsPatch,
  TownTimerState,
  TownVisitEntry,
  TrainingTargetActTimes,
  VisualFxIntensity,
  VisitedZoneEntry,
  ZoneTimeEntry
} from '../../shared/types';
import { normalizeHotkeyAccelerator } from '../hotkey-utils';

const OVERLAY_SCALES: OverlayScale[] = [70, 80, 90, 100, 110, 120];
const OVERLAY_TEXT_SIZES: OverlayTextSize[] = [0, 1, 2, 3];
const OVERLAY_DENSITIES: OverlayDensity[] = ['compact', 'normal', 'detailed'];
const VISUAL_FX_INTENSITIES: VisualFxIntensity[] = ['off', 'subtle', 'normal', 'rich'];
const RUN_TIMER_STATUSES: RunTimerStatus[] = ['not_started', 'armed', 'running', 'paused', 'finished'];
const CHECKLIST_ITEM_STATES: ChecklistItemState[] = ['pending', 'current', 'likely_done', 'done', 'missed'];
const CHECKLIST_DETECTED_BY: ChecklistDetectedBy[] = ['log', 'manual', 'zone_leave', 'linked_reward', 'inferred_zone_leave'];
const HOTKEY_KEYS: Array<keyof HotkeySettings> = [
  'markChecklistDone',
  'undoChecklistMark',
  'toggleTimerPause',
  'openCompanion',
  'toggleOverlayMode'
];

const OVERLAY_BOUNDS_LIMITS = {
  minWidth: 160,
  minHeight: 90,
  maxWidth: 2400,
  maxHeight: 1800,
  minPosition: -10000,
  maxPosition: 10000
};

const COMPANION_BOUNDS_LIMITS = {
  minWidth: 420,
  minHeight: 320,
  maxWidth: 3200,
  maxHeight: 2200,
  minPosition: -10000,
  maxPosition: 10000
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finiteInteger(value: unknown, min: number, max: number): number | null {
  const numberValue = finiteNumber(value);
  if (numberValue === null) {
    return null;
  }
  return Math.round(clamp(numberValue, min, max));
}

function finiteTimestamp(value: unknown): number | null {
  const numberValue = finiteNumber(value);
  if (numberValue === null || numberValue < 0) {
    return null;
  }
  // Keep timestamps sane enough to prevent broken configs from exploding timer math,
  // but do not reject future league-start values.
  return Math.round(clamp(numberValue, 0, 4_102_444_800_000));
}

function nonNegativeMs(value: unknown): number {
  const numberValue = finiteNumber(value);
  if (numberValue === null || numberValue < 0) {
    return 0;
  }
  return Math.round(clamp(numberValue, 0, 315_360_000_000));
}

function safeString(value: unknown, fallback: string | null = null): string | null {
  return typeof value === 'string' ? value : fallback;
}

function safeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeOverlayScale(value: unknown): OverlayScale {
  const numberValue = finiteNumber(value);
  if (numberValue === null) {
    return DEFAULT_CONFIG.overlayScale;
  }

  const clamped = clamp(numberValue, OVERLAY_SCALES[0], OVERLAY_SCALES[OVERLAY_SCALES.length - 1]);
  return OVERLAY_SCALES.reduce((closest, candidate) =>
    Math.abs(candidate - clamped) < Math.abs(closest - clamped) ? candidate : closest
  );
}

function normalizeOverlayTextSize(value: unknown): OverlayTextSize {
  const normalized = finiteInteger(value, OVERLAY_TEXT_SIZES[0], OVERLAY_TEXT_SIZES[OVERLAY_TEXT_SIZES.length - 1]);
  return OVERLAY_TEXT_SIZES.includes(normalized as OverlayTextSize)
    ? (normalized as OverlayTextSize)
    : DEFAULT_CONFIG.overlayTextSize;
}

function normalizeOverlayDensity(value: unknown): OverlayDensity {
  return normalizeEnum(value, OVERLAY_DENSITIES, DEFAULT_CONFIG.overlayDensity);
}

function normalizeVisualFxIntensity(value: unknown): VisualFxIntensity {
  return normalizeEnum(value, VISUAL_FX_INTENSITIES, DEFAULT_CONFIG.visualFxIntensity);
}

function normalizeOverlayOpacity(value: unknown): number {
  const numberValue = finiteNumber(value);
  if (numberValue === null) {
    return DEFAULT_CONFIG.overlayOpacity;
  }
  return Math.round(clamp(numberValue, 0.35, 1) * 100) / 100;
}

function normalizeCurrentLevel(value: unknown): number | null {
  if (value === null || value === undefined) {
    return DEFAULT_CONFIG.currentLevel;
  }

  const numberValue = finiteNumber(value);
  if (numberValue === null || numberValue < 1 || numberValue > 100) {
    return DEFAULT_CONFIG.currentLevel;
  }

  return Math.round(numberValue);
}

function normalizeBounds(value: unknown, limits = OVERLAY_BOUNDS_LIMITS): OverlayBounds | null {
  if (!isRecord(value)) {
    return null;
  }

  const x = finiteNumber(value.x);
  const y = finiteNumber(value.y);
  const width = finiteNumber(value.width);
  const height = finiteNumber(value.height);

  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  return {
    x: Math.round(clamp(x, limits.minPosition, limits.maxPosition)),
    y: Math.round(clamp(y, limits.minPosition, limits.maxPosition)),
    width: Math.round(clamp(width, limits.minWidth, limits.maxWidth)),
    height: Math.round(clamp(height, limits.minHeight, limits.maxHeight))
  };
}

function normalizeOverlayVisibleSections(value: unknown): OverlayVisibleSections {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_CONFIG.overlayVisibleSections).map(([key, fallback]) => [
      key,
      safeBoolean(source[key], fallback)
    ])
  ) as unknown as OverlayVisibleSections;
}

function normalizeMainOverlaySettings(value: unknown): MainOverlaySettings {
  const source = isRecord(value) ? value : {};
  return {
    showOverlaySkip: safeBoolean(source.showOverlaySkip, DEFAULT_CONFIG.mainOverlaySettings.showOverlaySkip),
    showOverlayCriticalImportant: safeBoolean(
      source.showOverlayCriticalImportant,
      DEFAULT_CONFIG.mainOverlaySettings.showOverlayCriticalImportant
    ),
    showOverlayBossTip: safeBoolean(source.showOverlayBossTip, DEFAULT_CONFIG.mainOverlaySettings.showOverlayBossTip),
    showOverlayVendorReminder: safeBoolean(
      source.showOverlayVendorReminder,
      DEFAULT_CONFIG.mainOverlaySettings.showOverlayVendorReminder
    ),
    showOverlayXpStatus: safeBoolean(source.showOverlayXpStatus, DEFAULT_CONFIG.mainOverlaySettings.showOverlayXpStatus),
    showOverlayPowerSpike: safeBoolean(
      source.showOverlayPowerSpike,
      DEFAULT_CONFIG.mainOverlaySettings.showOverlayPowerSpike
    ),
    overlayMode: source.overlayMode === 'timer_only' ? 'timer_only' : DEFAULT_CONFIG.mainOverlaySettings.overlayMode,
    overlayTimerOnlyMode: safeBoolean(
      source.overlayTimerOnlyMode,
      DEFAULT_CONFIG.mainOverlaySettings.overlayTimerOnlyMode
    )
  };
}

function normalizeHotkeys(value: unknown): HotkeySettings {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    HOTKEY_KEYS.map((key) => {
      const raw = source[key];
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      return [key, trimmed && normalizeHotkeyAccelerator(trimmed) ? trimmed : DEFAULT_HOTKEYS[key]];
    })
  ) as unknown as HotkeySettings;
}

function normalizeTrainingTargetActTimes(value: unknown): TrainingTargetActTimes {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    Object.keys(DEFAULT_CONFIG.trainingTargetActTimes).map((key) => {
      const raw = source[key];
      const numberValue = finiteNumber(raw);
      return [key, numberValue === null || numberValue < 0 ? null : Math.round(clamp(numberValue, 0, 24 * 60 * 60 * 1000))];
    })
  ) as unknown as TrainingTargetActTimes;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeChecklistItemState(value: unknown): ChecklistItemState | null {
  return typeof value === 'string' && CHECKLIST_ITEM_STATES.includes(value as ChecklistItemState)
    ? value as ChecklistItemState
    : null;
}

function normalizeChecklistDetectedBy(value: unknown): ChecklistDetectedBy | null {
  return typeof value === 'string' && CHECKLIST_DETECTED_BY.includes(value as ChecklistDetectedBy)
    ? value as ChecklistDetectedBy
    : null;
}

function normalizeChecklistItemProgress(value: unknown): ChecklistItemProgress | null {
  if (!isRecord(value)) {
    return null;
  }

  const state = normalizeChecklistItemState(value.state);
  const detectedBy = normalizeChecklistDetectedBy(value.detectedBy);
  const timestamp = safeString(value.timestamp, null);

  if (!state || !detectedBy || !timestamp) {
    return null;
  }

  return {
    state,
    timestamp,
    detectedBy,
    originalText: safeString(value.originalText, '') ?? ''
  };
}

function normalizeChecklistItemStates(value: unknown): Record<string, ChecklistItemProgress> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([itemId, progress]) => {
      const normalized = normalizeChecklistItemProgress(progress);
      return normalized ? [[itemId, normalized]] : [];
    })
  );
}

function normalizeCampaignBonusProgressEntry(value: unknown): CampaignBonusProgress | null {
  if (!isRecord(value) || value.state !== 'done') {
    return null;
  }

  const detectedBy = value.detectedBy === 'log' || value.detectedBy === 'manual'
    ? value.detectedBy
    : null;
  const timestamp = safeString(value.timestamp, null);

  if (!detectedBy || !timestamp) {
    return null;
  }

  return {
    state: 'done',
    timestamp,
    detectedBy,
    ...(typeof value.logLine === 'string' ? { logLine: value.logLine } : {})
  };
}

function normalizeCampaignBonusProgress(value: unknown): Record<string, CampaignBonusProgress> {
  if (!isRecord(value)) {
    return { ...DEFAULT_CONFIG.campaignBonusProgress };
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([bonusId, progress]) => {
      const normalized = normalizeCampaignBonusProgressEntry(progress);
      return normalized ? [[bonusId, normalized]] : [];
    })
  );
}

function normalizeLevelRemindersState(value: unknown): AppConfig['levelRemindersState'] {
  const source = isRecord(value) ? value : {};
  return {
    shown: normalizeStringArray(source.shown),
    dismissed: normalizeStringArray(source.dismissed),
    activeLevelReminderId: safeString(source.activeLevelReminderId, DEFAULT_CONFIG.levelRemindersState.activeLevelReminderId)
  };
}

function normalizeRunTimerActSplit(value: unknown): RunTimerActSplit | null {
  if (!isRecord(value)) {
    return null;
  }

  const act = finiteInteger(value.act, 1, 10);
  const timestamp = finiteTimestamp(value.timestamp);
  if (act === null || timestamp === null) {
    return null;
  }

  return {
    act,
    elapsedMs: nonNegativeMs(value.elapsedMs),
    timestamp
  };
}

function normalizeRunTimer(value: unknown): RunTimerState {
  const source = isRecord(value) ? value : {};
  return {
    ...DEFAULT_RUN_TIMER,
    status: normalizeEnum(source.status, RUN_TIMER_STATUSES, DEFAULT_RUN_TIMER.status),
    elapsedMs: nonNegativeMs(source.elapsedMs),
    startedAt: finiteTimestamp(source.startedAt),
    resumedAt: finiteTimestamp(source.resumedAt),
    pausedAt: finiteTimestamp(source.pausedAt),
    finishedAt: finiteTimestamp(source.finishedAt),
    lastZoneEnteredAt: finiteTimestamp(source.lastZoneEnteredAt),
    currentZoneElapsedMs: nonNegativeMs(source.currentZoneElapsedMs),
    currentZoneStartedAt: finiteTimestamp(source.currentZoneStartedAt),
    pauseReason: source.pauseReason === 'manual' ? 'manual' : null,
    pauseCount: finiteInteger(source.pauseCount, 0, 100000) ?? DEFAULT_RUN_TIMER.pauseCount,
    actSplits: Array.isArray(source.actSplits)
      ? source.actSplits.map(normalizeRunTimerActSplit).filter((split): split is RunTimerActSplit => split !== null)
      : [...DEFAULT_RUN_TIMER.actSplits]
  };
}

function normalizeTownVisit(value: unknown): TownVisitEntry | null {
  if (!isRecord(value) || typeof value.townName !== 'string') {
    return null;
  }

  const enteredAt = finiteTimestamp(value.enteredAt);
  if (enteredAt === null) {
    return null;
  }

  return {
    townName: value.townName,
    enteredAt,
    leftAt: finiteTimestamp(value.leftAt),
    elapsedMs: nonNegativeMs(value.elapsedMs)
  };
}

function normalizeTownTimer(value: unknown): TownTimerState {
  const source = isRecord(value) ? value : {};
  return {
    ...DEFAULT_TOWN_TIMER,
    isInTown: safeBoolean(source.isInTown, DEFAULT_TOWN_TIMER.isInTown),
    currentTownName: safeString(source.currentTownName, DEFAULT_TOWN_TIMER.currentTownName),
    townEnteredAt: finiteTimestamp(source.townEnteredAt),
    currentTownElapsedMs: nonNegativeMs(source.currentTownElapsedMs),
    totalTownElapsedMs: nonNegativeMs(source.totalTownElapsedMs),
    townVisits: Array.isArray(source.townVisits)
      ? source.townVisits.map(normalizeTownVisit).filter((visit): visit is TownVisitEntry => visit !== null)
      : [...DEFAULT_TOWN_TIMER.townVisits]
  };
}

function normalizeRunTimerSettings(value: unknown): AppConfig['runTimerSettings'] {
  const source = isRecord(value) ? value : {};
  return {
    ...DEFAULT_RUN_TIMER_SETTINGS,
    autoStartMode: source.autoStartMode === 'manual' ? 'manual' : 'scheduled_time',
    leagueStartAt: finiteTimestamp(source.leagueStartAt),
    leagueStartTimeLabel: safeString(source.leagueStartTimeLabel, DEFAULT_RUN_TIMER_SETTINGS.leagueStartTimeLabel),
    autoStart: safeBoolean(source.autoStart, DEFAULT_RUN_TIMER_SETTINGS.autoStart),
    showCountdownBeforeStart: safeBoolean(
      source.showCountdownBeforeStart,
      DEFAULT_RUN_TIMER_SETTINGS.showCountdownBeforeStart
    ),
    showZoneTimer: safeBoolean(source.showZoneTimer, DEFAULT_RUN_TIMER_SETTINGS.showZoneTimer),
    showActTimer: safeBoolean(source.showActTimer, DEFAULT_RUN_TIMER_SETTINGS.showActTimer)
  };
}

function normalizeVisitedZones(value: unknown): VisitedZoneEntry[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CONFIG.visitedZones];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.zoneId !== 'string' || typeof entry.zone_ru !== 'string') {
      return [];
    }

    const firstEnteredAt = finiteTimestamp(entry.firstEnteredAt);
    const lastEnteredAt = finiteTimestamp(entry.lastEnteredAt);
    const visitCount = finiteInteger(entry.visitCount, 1, 100000);
    if (firstEnteredAt === null || lastEnteredAt === null || visitCount === null) {
      return [];
    }

    const act = typeof entry.act === 'number' || entry.act === 'interlude' ? entry.act : 'interlude';
    return [{
      zoneId: entry.zoneId,
      zone_ru: entry.zone_ru,
      act,
      firstEnteredAt,
      lastEnteredAt,
      visitCount
    }];
  });
}

function normalizeZoneTimeHistory(value: unknown): ZoneTimeEntry[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CONFIG.zoneTimeHistory];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.zoneId !== 'string' || typeof entry.zone_ru !== 'string') {
      return [];
    }

    const enteredAt = finiteTimestamp(entry.enteredAt);
    const leftAt = finiteTimestamp(entry.leftAt);
    if (enteredAt === null || leftAt === null) {
      return [];
    }

    const act = typeof entry.act === 'number' || entry.act === 'interlude' ? entry.act : 'interlude';
    return [{
      zoneId: entry.zoneId,
      zone_ru: entry.zone_ru,
      act,
      elapsedMs: nonNegativeMs(entry.elapsedMs),
      enteredAt,
      leftAt
    }];
  });
}

export 
function normalizeSavedRunHistoryEntry(value: unknown): SavedRunHistoryEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = safeString(value.id, null);
  const savedAt = finiteTimestamp(value.savedAt);
  if (!id || savedAt === null) {
    return null;
  }

  const currentAct = typeof value.currentAct === 'number' || value.currentAct === 'interlude'
    ? value.currentAct
    : null;
  const runTimer = normalizeRunTimer(value.runTimer);
  const totalElapsedMs = nonNegativeMs(value.totalElapsedMs);

  return {
    id,
    label: safeString(value.label, '') ?? '',
    savedAt,
    totalElapsedMs,
    currentAct,
    status: normalizeEnum(value.status, RUN_TIMER_STATUSES, runTimer.status),
    actSplits: Array.isArray(value.actSplits)
      ? value.actSplits.map(normalizeRunTimerActSplit).filter((split): split is RunTimerActSplit => split !== null)
      : [...runTimer.actSplits],
    longestZones: normalizeZoneTimeHistory(value.longestZones),
    zoneTimeHistory: normalizeZoneTimeHistory(value.zoneTimeHistory),
    runTimer: {
      ...runTimer,
      elapsedMs: runTimer.elapsedMs > 0 ? runTimer.elapsedMs : totalElapsedMs
    }
  };
}

export function normalizeAppConfig(config: Partial<AppConfig> = {}): AppConfig {
  const rawConfig = isRecord(config) ? config : {};
  const rawZoneProgress = isRecord(rawConfig.zoneProgress) ? rawConfig.zoneProgress : DEFAULT_CONFIG.zoneProgress;
  const mergedZoneProgress = Object.fromEntries(
    Object.entries(rawZoneProgress).flatMap(([zoneId, zoneProgress]) => {
      if (!isRecord(zoneProgress)) {
        return [];
      }
      return [[
        zoneId,
        {
          itemStates: normalizeChecklistItemStates(zoneProgress.itemStates),
          likelyDoneKeywords: normalizeStringArray(zoneProgress.likelyDoneKeywords),
          lastVisitedAt: safeString(zoneProgress.lastVisitedAt, null)
        }
      ]];
    })
  );

  const bestRun = isRecord(rawConfig.bestRun)
    ? {
        totalElapsedMs: nonNegativeMs(rawConfig.bestRun.totalElapsedMs),
        finishedAt: finiteTimestamp(rawConfig.bestRun.finishedAt) ?? 0,
        actSplits: Array.isArray(rawConfig.bestRun.actSplits)
          ? rawConfig.bestRun.actSplits.map(normalizeRunTimerActSplit).filter((split): split is RunTimerActSplit => split !== null)
          : []
      }
    : DEFAULT_CONFIG.bestRun;

  const lastRunSummary = isRecord(rawConfig.lastRunSummary)
    ? {
        totalElapsedMs: nonNegativeMs(rawConfig.lastRunSummary.totalElapsedMs),
        finishedAt: finiteTimestamp(rawConfig.lastRunSummary.finishedAt) ?? 0,
        actSplits: Array.isArray(rawConfig.lastRunSummary.actSplits)
          ? rawConfig.lastRunSummary.actSplits.map(normalizeRunTimerActSplit).filter((split): split is RunTimerActSplit => split !== null)
          : [],
        missedRequiredRewards: normalizeStringArray(rawConfig.lastRunSummary.missedRequiredRewards),
        skippedRequiredItems: normalizeStringArray(rawConfig.lastRunSummary.skippedRequiredItems),
        unfinishedChecklistItems: normalizeStringArray(rawConfig.lastRunSummary.unfinishedChecklistItems),
        pauseCount: finiteInteger(rawConfig.lastRunSummary.pauseCount, 0, 100000) ?? 0,
        longestZones: normalizeZoneTimeHistory(rawConfig.lastRunSummary.longestZones),
        townTimeTotalMs: nonNegativeMs(rawConfig.lastRunSummary.townTimeTotalMs),
        isNewPb: safeBoolean(rawConfig.lastRunSummary.isNewPb, false)
      }
    : DEFAULT_CONFIG.lastRunSummary;

  const runHistory = Array.isArray(rawConfig.runHistory)
    ? rawConfig.runHistory
        .map(normalizeSavedRunHistoryEntry)
        .filter((entry): entry is SavedRunHistoryEntry => entry !== null)
        .slice(0, 20)
    : [...DEFAULT_CONFIG.runHistory];

  return {
    ...DEFAULT_CONFIG,
    appLanguage: rawConfig.appLanguage === 'en' ? 'en' : DEFAULT_CONFIG.appLanguage,
    logFilePath: safeString(rawConfig.logFilePath, DEFAULT_CONFIG.logFilePath),
    logFileSelectionMode:
      rawConfig.logFileSelectionMode === 'auto' || rawConfig.logFileSelectionMode === 'manual'
        ? rawConfig.logFileSelectionMode
        : DEFAULT_CONFIG.logFileSelectionMode,
    lastZoneName: safeString(rawConfig.lastZoneName, DEFAULT_CONFIG.lastZoneName),
    ignoreExistingLogOnNextStart: safeBoolean(
      rawConfig.ignoreExistingLogOnNextStart,
      DEFAULT_CONFIG.ignoreExistingLogOnNextStart
    ),
    currentLevel: normalizeCurrentLevel(rawConfig.currentLevel),
    overlayBounds: normalizeBounds(rawConfig.overlayBounds),
    overlayCompactBounds: normalizeBounds(rawConfig.overlayCompactBounds),
    overlayTimerOnlyBounds: normalizeBounds(rawConfig.overlayTimerOnlyBounds),
    overlayOpacity: normalizeOverlayOpacity(rawConfig.overlayOpacity),
    overlayMovementLocked: safeBoolean(rawConfig.overlayMovementLocked, DEFAULT_CONFIG.overlayMovementLocked),
    realtimePriorityEnabled: safeBoolean(rawConfig.realtimePriorityEnabled, DEFAULT_CONFIG.realtimePriorityEnabled),
    overlayScale: normalizeOverlayScale(rawConfig.overlayScale),
    overlayTextSize: normalizeOverlayTextSize(rawConfig.overlayTextSize),
    overlayDensity: normalizeOverlayDensity(rawConfig.overlayDensity),
    visualFxIntensity: normalizeVisualFxIntensity(rawConfig.visualFxIntensity),
    overlayEffectsEnabled: safeBoolean(rawConfig.overlayEffectsEnabled, DEFAULT_CONFIG.overlayEffectsEnabled),
    overlayDebugLayoutEnabled: safeBoolean(
      rawConfig.overlayDebugLayoutEnabled,
      DEFAULT_CONFIG.overlayDebugLayoutEnabled
    ),
    overlayVisibleSections: normalizeOverlayVisibleSections(rawConfig.overlayVisibleSections),
    mainOverlaySettings: normalizeMainOverlaySettings(rawConfig.mainOverlaySettings),
    devPanelEnabled: safeBoolean(rawConfig.devPanelEnabled, DEFAULT_CONFIG.devPanelEnabled),
    manualHotkeysEnabled: safeBoolean(rawConfig.manualHotkeysEnabled, DEFAULT_CONFIG.manualHotkeysEnabled),
    hotkeys: normalizeHotkeys(rawConfig.hotkeys),
    companionBounds: normalizeBounds(rawConfig.companionBounds, COMPANION_BOUNDS_LIMITS),
    companionAlwaysOnTop: safeBoolean(rawConfig.companionAlwaysOnTop, DEFAULT_CONFIG.companionAlwaysOnTop),
    guideProfile: DEFAULT_CONFIG.guideProfile,
    trainingModeEnabled: safeBoolean(rawConfig.trainingModeEnabled, DEFAULT_CONFIG.trainingModeEnabled),
    trainingTargetActTimes: normalizeTrainingTargetActTimes(rawConfig.trainingTargetActTimes),
    zoneProgress: mergedZoneProgress,
    visitedZones: normalizeVisitedZones(rawConfig.visitedZones),
    zoneTimeHistory: normalizeZoneTimeHistory(rawConfig.zoneTimeHistory),
    bestRun,
    lastRunSummary,
    runHistory,
    levelRemindersState: normalizeLevelRemindersState(rawConfig.levelRemindersState),
    runTimer: normalizeRunTimer(rawConfig.runTimer),
    townTimer: normalizeTownTimer(rawConfig.townTimer),
    runTimerSettings: normalizeRunTimerSettings(rawConfig.runTimerSettings),
    campaignBonusProgress: normalizeCampaignBonusProgress(rawConfig.campaignBonusProgress)
  };
}

export class ConfigStore {
  private readonly configPath: string;
  private config: AppConfig = { ...DEFAULT_CONFIG };

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  load(): AppConfig {
    try {
      const raw = readFileSync(this.configPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AppConfig>;
      this.config = normalizeAppConfig(parsed);
    } catch {
      this.config = { ...DEFAULT_CONFIG };
      this.save();
    }

    return this.get();
  }

  get(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)) as AppConfig;
  }

  update(patch: Partial<AppConfig>): AppConfig {
    this.config = normalizeAppConfig({
      ...this.config,
      ...patch
    });
    this.save();
    return this.get();
  }

  updateSettings(patch: SettingsPatch): AppConfig {
    return this.update({
      ...(patch.appLanguage !== undefined
        ? { appLanguage: patch.appLanguage === 'en' ? 'en' : 'ru' }
        : {}),
      ...(patch.overlayOpacity !== undefined
        ? { overlayOpacity: patch.overlayOpacity }
        : {}),
      ...(patch.overlayMovementLocked !== undefined
        ? { overlayMovementLocked: patch.overlayMovementLocked }
        : {}),
      ...(patch.realtimePriorityEnabled !== undefined
        ? { realtimePriorityEnabled: patch.realtimePriorityEnabled }
        : {}),
      ...(patch.overlayScale !== undefined
        ? { overlayScale: patch.overlayScale }
        : {}),
      ...(patch.overlayTextSize !== undefined
        ? { overlayTextSize: patch.overlayTextSize }
        : {}),
      ...(patch.overlayDensity !== undefined
        ? { overlayDensity: patch.overlayDensity }
        : {}),
      ...(patch.visualFxIntensity !== undefined
        ? { visualFxIntensity: patch.visualFxIntensity }
        : {}),
      ...(patch.overlayEffectsEnabled !== undefined
        ? { overlayEffectsEnabled: patch.overlayEffectsEnabled }
        : {}),
      ...(patch.overlayDebugLayoutEnabled !== undefined
        ? { overlayDebugLayoutEnabled: patch.overlayDebugLayoutEnabled }
        : {}),
      ...(patch.overlayVisibleSections !== undefined
        ? {
            overlayVisibleSections: {
              ...this.config.overlayVisibleSections,
              ...patch.overlayVisibleSections
            }
          }
        : {}),
      ...(patch.mainOverlaySettings !== undefined
        ? {
            mainOverlaySettings: {
              ...this.config.mainOverlaySettings,
              ...patch.mainOverlaySettings
            }
          }
        : {}),
      ...(patch.devPanelEnabled !== undefined
        ? { devPanelEnabled: patch.devPanelEnabled }
        : {}),
      ...(patch.manualHotkeysEnabled !== undefined
        ? { manualHotkeysEnabled: patch.manualHotkeysEnabled }
        : {}),
      ...(patch.hotkeys !== undefined
        ? {
            hotkeys: {
              ...this.config.hotkeys,
              ...patch.hotkeys
            }
          }
        : {}),
      ...(patch.companionAlwaysOnTop !== undefined
        ? { companionAlwaysOnTop: patch.companionAlwaysOnTop }
        : {}),
      ...(patch.guideProfile !== undefined
        ? { guideProfile: patch.guideProfile }
        : {}),
      ...(patch.trainingModeEnabled !== undefined
        ? { trainingModeEnabled: patch.trainingModeEnabled }
        : {}),
      ...(patch.trainingTargetActTimes !== undefined
        ? {
            trainingTargetActTimes: {
              ...this.config.trainingTargetActTimes,
              ...patch.trainingTargetActTimes
            }
          }
        : {}),
      ...(patch.runTimerSettings !== undefined
        ? {
            runTimerSettings: {
              ...this.config.runTimerSettings,
              ...patch.runTimerSettings
            }
          }
        : {})
    });
  }

  setOverlayBounds(bounds: OverlayBounds): AppConfig {
    return this.update({
      overlayBounds: bounds
    });
  }

  setOverlayCompactBounds(bounds: OverlayBounds): AppConfig {
    return this.update({
      overlayCompactBounds: bounds
    });
  }

  setOverlayTimerOnlyBounds(bounds: OverlayBounds): AppConfig {
    return this.update({
      overlayTimerOnlyBounds: bounds
    });
  }

  setCompanionBounds(bounds: OverlayBounds): AppConfig {
    return this.update({
      companionBounds: bounds
    });
  }

  resetProgress(): AppConfig {
    const shouldClearPastLeagueStart =
      typeof this.config.runTimerSettings.leagueStartAt === 'number' &&
      this.config.runTimerSettings.leagueStartAt <= Date.now();

    return this.update({
      ignoreExistingLogOnNextStart: true,
      currentLevel: null,
      lastZoneName: null,
      zoneProgress: {},
      visitedZones: [],
      zoneTimeHistory: [],
      bestRun: null,
      lastRunSummary: null,
      campaignBonusProgress: {},
      levelRemindersState: {
        shown: [],
        dismissed: [],
        activeLevelReminderId: null
      },
      runTimer: {
        ...DEFAULT_RUN_TIMER
      },
      townTimer: {
        ...DEFAULT_TOWN_TIMER
      },
      runTimerSettings: {
        ...this.config.runTimerSettings,
        // Reset means "do not resurrect the old run on next launch".
        // The user can arm/start the timer again manually from Settings.
        autoStart: false,
        leagueStartAt: shouldClearPastLeagueStart
          ? null
          : this.config.runTimerSettings.leagueStartAt,
        leagueStartTimeLabel: shouldClearPastLeagueStart
          ? null
          : this.config.runTimerSettings.leagueStartTimeLabel
      }
    });
  }

  private save(): void {
    mkdirSync(dirname(this.configPath), { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }
}
