import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_CONFIG,
  DEFAULT_RUN_TIMER,
  DEFAULT_TOWN_TIMER,
  DEFAULT_RUN_TIMER_SETTINGS,
  DEFAULT_HOTKEYS
} from '../../shared/defaults';
import type { AppConfig, OverlayBounds, SettingsPatch } from '../../shared/types';

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
      this.config = this.mergeConfig(parsed);
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
    this.config = this.mergeConfig({
      ...this.config,
      ...patch
    });
    this.save();
    return this.get();
  }

  updateSettings(patch: SettingsPatch): AppConfig {
    return this.update({
      ...(patch.overlayOpacity !== undefined
        ? { overlayOpacity: patch.overlayOpacity }
        : {}),
      ...(patch.overlayMovementLocked !== undefined
        ? { overlayMovementLocked: patch.overlayMovementLocked }
        : {}),
      ...(patch.overlayScale !== undefined
        ? { overlayScale: patch.overlayScale }
        : {}),
      ...(patch.overlayDensity !== undefined
        ? { overlayDensity: patch.overlayDensity }
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
        // Reset means “do not resurrect the old run on next launch”.
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

  private mergeConfig(config: Partial<AppConfig>): AppConfig {
    const mergedZoneProgress = Object.fromEntries(
      Object.entries(config.zoneProgress ?? DEFAULT_CONFIG.zoneProgress).map(
        ([zoneId, zoneProgress]) => [
          zoneId,
          {
            itemStates: zoneProgress?.itemStates ?? {},
            likelyDoneKeywords: zoneProgress?.likelyDoneKeywords ?? [],
            lastVisitedAt: zoneProgress?.lastVisitedAt ?? null
          }
        ]
      )
    );

    return {
      ...DEFAULT_CONFIG,
      ...config,
      logFileSelectionMode: config.logFileSelectionMode ?? DEFAULT_CONFIG.logFileSelectionMode,
      overlayBounds: config.overlayBounds ?? DEFAULT_CONFIG.overlayBounds,
      overlayCompactBounds:
        config.overlayCompactBounds ?? DEFAULT_CONFIG.overlayCompactBounds,
      overlayTimerOnlyBounds:
        config.overlayTimerOnlyBounds ?? DEFAULT_CONFIG.overlayTimerOnlyBounds,
      overlayMovementLocked:
        config.overlayMovementLocked ?? DEFAULT_CONFIG.overlayMovementLocked,
      overlayScale: config.overlayScale ?? DEFAULT_CONFIG.overlayScale,
      overlayDensity: config.overlayDensity ?? DEFAULT_CONFIG.overlayDensity,
      overlayVisibleSections: {
        ...DEFAULT_CONFIG.overlayVisibleSections,
        ...(config.overlayVisibleSections ?? {})
      },
      mainOverlaySettings: {
        ...DEFAULT_CONFIG.mainOverlaySettings,
        ...(config.mainOverlaySettings ?? {})
      },
      hotkeys: {
        ...DEFAULT_HOTKEYS,
        ...(config.hotkeys ?? {})
      },
      companionBounds: config.companionBounds ?? DEFAULT_CONFIG.companionBounds,
      companionAlwaysOnTop:
        config.companionAlwaysOnTop ?? DEFAULT_CONFIG.companionAlwaysOnTop,
      guideProfile: DEFAULT_CONFIG.guideProfile,
      trainingModeEnabled:
        config.trainingModeEnabled ?? DEFAULT_CONFIG.trainingModeEnabled,
      trainingTargetActTimes: {
        ...DEFAULT_CONFIG.trainingTargetActTimes,
        ...(config.trainingTargetActTimes ?? {})
      },
      zoneProgress: mergedZoneProgress,
      visitedZones: Array.isArray(config.visitedZones)
        ? config.visitedZones.map((entry) => ({
            zoneId: entry.zoneId,
            zone_ru: entry.zone_ru,
            act: entry.act,
            firstEnteredAt: entry.firstEnteredAt,
            lastEnteredAt: entry.lastEnteredAt,
            visitCount: entry.visitCount
          }))
        : [...DEFAULT_CONFIG.visitedZones],
      zoneTimeHistory: Array.isArray(config.zoneTimeHistory)
        ? config.zoneTimeHistory.map((entry) => ({
            zoneId: entry.zoneId,
            zone_ru: entry.zone_ru,
            act: entry.act,
            elapsedMs: entry.elapsedMs,
            enteredAt: entry.enteredAt,
            leftAt: entry.leftAt
          }))
        : [...DEFAULT_CONFIG.zoneTimeHistory],
      bestRun: config.bestRun
        ? {
            totalElapsedMs: config.bestRun.totalElapsedMs,
            finishedAt: config.bestRun.finishedAt,
            actSplits: Array.isArray(config.bestRun.actSplits)
              ? config.bestRun.actSplits.map((split) => ({
                  act: split.act,
                  elapsedMs: split.elapsedMs,
                  timestamp: split.timestamp
                }))
              : []
          }
        : DEFAULT_CONFIG.bestRun,
      lastRunSummary: config.lastRunSummary
        ? {
            totalElapsedMs: config.lastRunSummary.totalElapsedMs,
            finishedAt: config.lastRunSummary.finishedAt,
            actSplits: Array.isArray(config.lastRunSummary.actSplits)
              ? config.lastRunSummary.actSplits.map((split) => ({
                  act: split.act,
                  elapsedMs: split.elapsedMs,
                  timestamp: split.timestamp
                }))
              : [],
            missedRequiredRewards: config.lastRunSummary.missedRequiredRewards ?? [],
            skippedRequiredItems: config.lastRunSummary.skippedRequiredItems ?? [],
            unfinishedChecklistItems: config.lastRunSummary.unfinishedChecklistItems ?? [],
            pauseCount: config.lastRunSummary.pauseCount ?? 0,
            longestZones: Array.isArray(config.lastRunSummary.longestZones)
              ? config.lastRunSummary.longestZones.map((entry) => ({
                  zoneId: entry.zoneId,
                  zone_ru: entry.zone_ru,
                  act: entry.act,
                  elapsedMs: entry.elapsedMs,
                  enteredAt: entry.enteredAt,
                  leftAt: entry.leftAt
                }))
              : [],
            townTimeTotalMs: config.lastRunSummary.townTimeTotalMs ?? 0,
            isNewPb: Boolean(config.lastRunSummary.isNewPb)
          }
        : DEFAULT_CONFIG.lastRunSummary,
      levelRemindersState: {
        ...DEFAULT_CONFIG.levelRemindersState,
        ...(config.levelRemindersState ?? {}),
        shown: config.levelRemindersState?.shown ?? DEFAULT_CONFIG.levelRemindersState.shown,
        dismissed:
          config.levelRemindersState?.dismissed ??
          DEFAULT_CONFIG.levelRemindersState.dismissed
      },
      runTimer: {
        ...DEFAULT_RUN_TIMER,
        ...(config.runTimer ?? {}),
        actSplits: Array.isArray(config.runTimer?.actSplits)
          ? config.runTimer?.actSplits.map((split) => ({
              act: split.act,
              elapsedMs: split.elapsedMs,
              timestamp: split.timestamp
            }))
          : [...DEFAULT_RUN_TIMER.actSplits]
      },
      townTimer: {
        ...DEFAULT_TOWN_TIMER,
        ...(config.townTimer ?? {}),
        townVisits: Array.isArray(config.townTimer?.townVisits)
          ? config.townTimer.townVisits.map((visit) => ({
              townName: visit.townName,
              enteredAt: visit.enteredAt,
              leftAt: visit.leftAt,
              elapsedMs: visit.elapsedMs
            }))
          : [...DEFAULT_TOWN_TIMER.townVisits]
      },
      runTimerSettings: {
        ...DEFAULT_RUN_TIMER_SETTINGS,
        ...(config.runTimerSettings ?? {}),
        autoStartMode:
          config.runTimerSettings?.autoStartMode === 'manual'
            ? 'manual'
            : 'scheduled_time'
      },
      campaignBonusProgress: {
        ...(config.campaignBonusProgress ?? DEFAULT_CONFIG.campaignBonusProgress)
      }
    };
  }
}
