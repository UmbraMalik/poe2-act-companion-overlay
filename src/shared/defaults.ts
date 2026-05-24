import type {
  AppConfig,
  RunTimerSettings,
  RunTimerState,
  TownTimerState,
  HotkeySettings
} from './types';

export const DEFAULT_OVERLAY_BOUNDS = {
  width: 500,
  height: 650
};

export const DEFAULT_TIMER_ONLY_OVERLAY_BOUNDS = {
  width: 360,
  height: 238
};

export const DEFAULT_COMPACT_OVERLAY_BOUNDS = {
  width: 350,
  height: 470
};

export const DEFAULT_COMPANION_BOUNDS = {
  width: 900,
  height: 760
};

export const DEFAULT_RUN_TIMER: RunTimerState = {
  status: 'not_started',
  elapsedMs: 0,
  startedAt: null,
  resumedAt: null,
  pausedAt: null,
  finishedAt: null,
  lastZoneEnteredAt: null,
  currentZoneElapsedMs: 0,
  currentZoneStartedAt: null,
  pauseReason: null,
  pauseCount: 0,
  actSplits: []
};

export const DEFAULT_TOWN_TIMER: TownTimerState = {
  isInTown: false,
  currentTownName: null,
  townEnteredAt: null,
  currentTownElapsedMs: 0,
  totalTownElapsedMs: 0,
  townVisits: []
};

export const DEFAULT_HOTKEYS: HotkeySettings = {
  markChecklistDone: 'F6',
  undoChecklistMark: 'F7',
  toggleTimerPause: 'F8',
  openCompanion: 'F9',
  toggleOverlayMode: 'F10'
};

export const DEFAULT_RUN_TIMER_SETTINGS: RunTimerSettings = {
  autoStartMode: 'scheduled_time',
  leagueStartAt: null,
  leagueStartTimeLabel: null,
  autoStart: true,
  showCountdownBeforeStart: true,
  showZoneTimer: true,
  showActTimer: true
};

export const DEFAULT_CONFIG: AppConfig = {
  appLanguage: 'ru',
  logFilePath: null,
  logFileSelectionMode: null,
  lastZoneName: null,
  ignoreExistingLogOnNextStart: false,
  currentLevel: null,
  overlayBounds: null,
  overlayCompactBounds: null,
  overlayTimerOnlyBounds: null,
  overlayOpacity: 0.96,
  overlayMovementLocked: false,
  realtimePriorityEnabled: false,
  overlayScale: 90,
  overlayTextSize: 0,
  overlayDensity: 'normal',
  overlayVisibleSections: {
    nearby: true,
    zoneInfo: true,
    zoneBonuses: true,
    league: true,
    next: true,
    skip: true,
    speedrun: true,
    important: true,
    rewards: true,
    boss_tips: true,
    xp_notes: true,
    crafting_tips: true,
    after: false
  },
  mainOverlaySettings: {
    showOverlaySkip: true,
    showOverlayCriticalImportant: true,
    showOverlayBossTip: true,
    showOverlayVendorReminder: true,
    showOverlayXpStatus: true,
    showOverlayPowerSpike: true,
    overlayMode: 'full',
    overlayTimerOnlyMode: false
  },
  devPanelEnabled: false,
  manualHotkeysEnabled: false,
  hotkeys: {
    ...DEFAULT_HOTKEYS
  },
  companionBounds: null,
  companionAlwaysOnTop: false,
  guideProfile: 'universal',
  trainingModeEnabled: false,
  trainingTargetActTimes: {
    act1: null,
    act2: null,
    act3: null,
    act4: null
  },
  zoneProgress: {},
  visitedZones: [],
  zoneTimeHistory: [],
  bestRun: null,
  lastRunSummary: null,
  runHistory: [],
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
    ...DEFAULT_RUN_TIMER_SETTINGS
  },
  campaignBonusProgress: {}
};
