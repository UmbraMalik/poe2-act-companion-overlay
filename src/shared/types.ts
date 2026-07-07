export type ChecklistItemType =
  | 'route_task'
  | 'boss'
  | 'reward'
  | 'permanent_reward'
  | 'passive'
  | 'resistance'
  | 'spirit'
  | 'life'
  | 'mana'
  | 'crafting'
  | 'currency';

export type ChecklistAutoCompleteMode =
  | 'log_or_manual'
  | 'manual_or_zone_leave_infer'
  | 'manual'
  | 'none'
  | 'never'
  | 'linked_reward'
  | 'inferred_zone_leave';

export type ChecklistItemState =
  | 'pending'
  | 'current'
  | 'likely_done'
  | 'done'
  | 'missed';

export type ChecklistDetectedBy = 'log' | 'manual' | 'zone_leave' | 'linked_reward' | 'inferred_zone_leave';

export interface ChecklistItemDefinition {
  id: string;
  text: string;
  type: ChecklistItemType;
  required: boolean;
  autoCompleteKeywords: string[];
  autoCompleteMode?: ChecklistAutoCompleteMode;
  linkedChecklistItemIds?: string[];
  displayInOverlay?: boolean;
}

export interface ChecklistViewItem extends ChecklistItemDefinition {
  displayState: ChecklistItemState;
  detectedBy: ChecklistDetectedBy | null;
  timestamp: string | null;
  originalIndex: number;
}

export type OverlayDensity = 'compact' | 'normal' | 'detailed';
export type OverlayScale = 70 | 80 | 90 | 100 | 110 | 120;
export type OverlayTextSize = 0 | 1 | 2 | 3;
export type VisualFxIntensity = 'off' | 'subtle' | 'normal' | 'rich';
export type OverlayMode = 'full' | 'timer_only';
export type AppLanguage = 'ru' | 'en';
export type AppTheme = 'classic' | 'dark_fantasy';

export interface OverlayVisibleSections {
  /** Compact reminder cards above the current-zone content. */
  nearby: boolean;
  /** Main "What is in this zone" card with checklist/no-guide text. */
  zoneInfo: boolean;
  /** Campaign bonus card for the current zone. */
  zoneBonuses: boolean;
  /** Guaranteed league reward card for the current zone. */
  league: boolean;
  /** Next-zone card. */
  next: boolean;
  /** Optional skip notes card. */
  skip: boolean;
  /** Speedrun/navigation notes card. */
  speedrun: boolean;
  /** "Important now" card. */
  important: boolean;
  // Legacy per-line toggles kept for older user configs and future fine tuning.
  rewards: boolean;
  boss_tips: boolean;
  xp_notes: boolean;
  crafting_tips: boolean;
  after: boolean;
}

export interface GuideDetails {
  route?: string[];
  rewards?: string[];
  skip?: string[];
  important?: string[];
  after?: string[];
  boss_tips?: string[];
  xp_notes?: string[];
  crafting_tips?: string[];
  overlay_speedrun?: string[];
  [key: string]: unknown;
}

export interface GuideEntry {
  id: string;
  act: number | 'interlude';
  zone_en: string;
  zone_ru: string;
  recommended_level: number | null;
  recommended_level_label: string;
  is_good_xp_zone: boolean;
  priority: string[];
  rewards: string[];
  skip: string[];
  important: string[];
  after: string[];
  boss_tips?: string[];
  xp_notes?: string[];
  crafting_tips?: string[];
  details?: GuideDetails | string[] | null;
  next_zone_ru: string;
  keywords_done: string[];
  checklist?: ChecklistItemDefinition[];
  aliases?: string[];
  aliases_en?: string[];
  zone_aliases?: string[];
  area_ids?: string[];
  areaIds?: string[];
  campaign_bonus_ids?: string[];
  campaignBonusIds?: string[];
}

export interface ChecklistItemProgress {
  state: ChecklistItemState;
  timestamp: string;
  detectedBy: ChecklistDetectedBy;
  originalText: string;
}

export interface GuideZoneProgress {
  itemStates: Record<string, ChecklistItemProgress>;
  likelyDoneKeywords: string[];
  lastVisitedAt: string | null;
}

export interface OverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelReminder {
  id: string;
  level: number;
  type: string;
  title: string;
  items: string[];
}

export interface PowerSpike {
  id: string;
  level: number;
  title: string;
  items: string[];
}

export interface GuideGlobalReminders {
  vendor_checkpoints: LevelReminder[];
}

export interface GuideDataFile {
  zones: GuideEntry[];
  global_reminders?: GuideGlobalReminders;
}

export type CampaignBonusCategory =
  | 'passive'
  | 'weapon_set_passive'
  | 'resistance'
  | 'spirit'
  | 'life'
  | 'mana'
  | 'choice'
  | 'utility'
  | 'item';

export type CampaignBonusRewardType =
  | 'passive_points'
  | 'weapon_set_passive_points'
  | 'cold_resistance'
  | 'fire_resistance'
  | 'lightning_resistance'
  | 'all_elemental_resistance'
  | 'spirit'
  | 'flat_life'
  | 'increased_life'
  | 'increased_mana'
  | 'choice'
  | 'utility'
  | 'item';

export interface CampaignBonusReward {
  type: CampaignBonusRewardType;
  value: number;
}

export interface CampaignBonusEventRule {
  all: string[];
  any?: string[];
  none?: string[];
  zoneIds?: string[];
  sceneNames?: string[];
}

export interface CampaignBonusDefinition {
  id: string;
  act: ZoneAct;
  zoneId?: string;
  zone_ru: string;
  title: string;
  category: CampaignBonusCategory;
  source: string;
  details: string[];
  reward: CampaignBonusReward;
  eventRules: CampaignBonusEventRule[];
  needsVerification?: boolean;
}

export interface CampaignBonusProgress {
  state: 'done';
  timestamp: string;
  detectedBy: 'log' | 'manual';
  logLine?: string;
}

export interface CampaignBonusesDataFile {
  summaryTargets: Record<string, number>;
  bonuses: CampaignBonusDefinition[];
}

export interface LevelRemindersState {
  shown: string[];
  dismissed: string[];
  activeLevelReminderId: string | null;
}

export type RunTimerStatus =
  | 'not_started'
  | 'armed'
  | 'running'
  | 'paused'
  | 'finished';

export interface RunTimerActSplit {
  act: number;
  elapsedMs: number;
  timestamp: number;
}

export type RunTimerPauseReason =
  | null
  | 'manual';

export interface RunTimerState {
  status: RunTimerStatus;
  elapsedMs: number;
  startedAt: number | null;
  resumedAt: number | null;
  pausedAt: number | null;
  finishedAt: number | null;
  lastZoneEnteredAt: number | null;
  currentZoneElapsedMs: number;
  currentZoneStartedAt: number | null;
  pauseReason: RunTimerPauseReason;
  pauseCount: number;
  actSplits: RunTimerActSplit[];
}

export interface TownVisitEntry {
  townName: string;
  enteredAt: number;
  leftAt: number | null;
  elapsedMs: number;
}

export interface TownTimerState {
  isInTown: boolean;
  currentTownName: string | null;
  townEnteredAt: number | null;
  currentTownElapsedMs: number;
  totalTownElapsedMs: number;
  townVisits: TownVisitEntry[];
}

export type ZoneAct = number | 'interlude';

export interface VisitedZoneEntry {
  zoneId: string;
  zone_ru: string;
  act: ZoneAct;
  firstEnteredAt: number;
  lastEnteredAt: number;
  visitCount: number;
}

export type RunTimerAutoStartMode =
  | 'scheduled_time'
  | 'manual';

export interface RunTimerSettings {
  autoStartMode: RunTimerAutoStartMode;
  leagueStartAt: number | null;
  leagueStartTimeLabel: string | null;
  autoStart: boolean;
  showCountdownBeforeStart: boolean;
  showZoneTimer: boolean;
  showActTimer: boolean;
}

export interface MainOverlaySettings {
  showOverlaySkip: boolean;
  showOverlayCriticalImportant: boolean;
  showOverlayBossTip: boolean;
  showOverlayVendorReminder: boolean;
  showOverlayXpStatus: boolean;
  showOverlayPowerSpike: boolean;
  overlayMode: OverlayMode;
  overlayTimerOnlyMode: boolean;
}


export interface HotkeySettings {
  markChecklistDone: string;
  undoChecklistMark: string;
  toggleTimerPause: string;
  openCompanion: string;
  toggleOverlayMode: string;
}

export interface ZoneTimeEntry {
  zoneId: string;
  zone_ru: string;
  act: ZoneAct;
  elapsedMs: number;
  enteredAt: number;
  leftAt: number;
}

export interface BestRunSummary {
  totalElapsedMs: number;
  finishedAt: number;
  actSplits: RunTimerActSplit[];
}

export interface RunSummary {
  totalElapsedMs: number;
  finishedAt: number;
  actSplits: RunTimerActSplit[];
  missedRequiredRewards: string[];
  skippedRequiredItems: string[];
  unfinishedChecklistItems: string[];
  pauseCount: number;
  longestZones: ZoneTimeEntry[];
  townTimeTotalMs: number;
  isNewPb: boolean;
}


export interface SavedRunHistoryEntry {
  id: string;
  label: string;
  savedAt: number;
  totalElapsedMs: number;
  currentAct: ZoneAct | null;
  status: RunTimerStatus;
  actSplits: RunTimerActSplit[];
  longestZones: ZoneTimeEntry[];
  zoneTimeHistory: ZoneTimeEntry[];
  runTimer: RunTimerState;
}

export interface AppConfig {
  appLanguage: AppLanguage;
  logFilePath: string | null;
  logFileSelectionMode: 'auto' | 'manual' | null;
  lastZoneName: string | null;
  ignoreExistingLogOnNextStart: boolean;
  currentLevel: number | null;
  overlayBounds: OverlayBounds | null;
  overlayCompactBounds: OverlayBounds | null;
  overlayTimerOnlyBounds: OverlayBounds | null;
  overlayOpacity: number;
  overlayMovementLocked: boolean;
  realtimePriorityEnabled: boolean;
  overlayScale: OverlayScale;
  overlayTextSize: OverlayTextSize;
  overlayDensity: OverlayDensity;
  visualFxIntensity: VisualFxIntensity;
  overlayEffectsEnabled: boolean;
  theme: AppTheme;
  themePreferencePrompted: boolean;
  overlayDebugLayoutEnabled: boolean;
  overlayVisibleSections: OverlayVisibleSections;
  mainOverlaySettings: MainOverlaySettings;
  devPanelEnabled: boolean;
  manualHotkeysEnabled: boolean;
  hotkeys: HotkeySettings;
  companionBounds: OverlayBounds | null;
  companionAlwaysOnTop: boolean;
  zoneProgress: Record<string, GuideZoneProgress>;
  visitedZones: VisitedZoneEntry[];
  zoneTimeHistory: ZoneTimeEntry[];
  bestRun: BestRunSummary | null;
  lastRunSummary: RunSummary | null;
  runHistory: SavedRunHistoryEntry[];
  levelRemindersState: LevelRemindersState;
  runTimer: RunTimerState;
  townTimer: TownTimerState;
  runTimerSettings: RunTimerSettings;
  campaignBonusProgress: Record<string, CampaignBonusProgress>;
}

export type ZoneSource = 'log' | 'simulation' | 'config' | null;
export type ZoneMatcherReason = 'zone_ru' | 'zone_en' | 'alias' | 'internal_area' | 'none';
export type SceneKind = 'gameplay' | 'town' | 'login' | 'inactive' | 'unknown';

export interface CurrentZoneState {
  rawZoneName: string | null;
  guide: GuideEntry | null;
  sceneKind: SceneKind;
  actHint: ZoneAct | null;
}

export type LogWatcherStatus = 'idle' | 'ready' | 'missing' | 'error';

export interface LogWatcherRuntimeState {
  watchedLogPath: string | null;
  currentOffset: number;
  lastFileSize: number | null;
  lastAppendedLine: string | null;
  lastMatchedZone: string | null;
  lastUpdateTimestamp: string | null;
  lastReadAt: string | null;
  lastMatchedAt: string | null;
  lastMatcherReason: ZoneMatcherReason;
}

export interface EndgameT15CompletionNotice {
  completedAt: string;
  totalElapsedMs: number;
  savedLabel: string;
}

export interface RuntimeState {
  timerNowMs: number;
  guideLoadedAt: string | null;
  lastLogLine: string | null;
  lastRawZoneName: string | null;
  lastMatchedZoneEn: string | null;
  lastMatchedZoneRu: string | null;
  lastMatchedGuideId: string | null;
  lastZoneSource: ZoneSource;
  logWatcherStatus: LogWatcherStatus;
  logWatcherMessage: string;
  logFileExists: boolean;
  logFileSize: number | null;
  watchedLogPath: string | null;
  currentLogOffset: number;
  lastAppendedLine: string | null;
  watcherLastMatchedZone: string | null;
  lastWatcherUpdateAt: string | null;
  lastReadAt: string | null;
  lastMatchedAt: string | null;
  lastMatcherReason: ZoneMatcherReason;
  lastLevelUpDetectedAt: string | null;
  lastLogLineAt: string | null;
  lastValidGameplayZoneAt: string | null;
  lastGameplayGuideId: string | null;
  lastGameplayZoneRu: string | null;
  lastGameplayAct: number | null;
  lastSceneSource: string | null;
  lastSceneSourceAt: string | null;
  overlayMode: OverlayMode;
  missedWarningZoneRu: string | null;
  missedWarningItems: string[];
  endgameT15CompletionNotice: EndgameT15CompletionNotice | null;
}

export interface AppSnapshot {
  config: AppConfig;
  currentZone: CurrentZoneState;
  currentGuideEntry: GuideEntry | null;
  currentZoneProgress: GuideZoneProgress | null;
  currentChecklist: ChecklistViewItem[];
  guideEntries: GuideEntry[];
  vendorCheckpoints: LevelReminder[];
  powerSpikes: PowerSpike[];
  campaignBonuses: CampaignBonusDefinition[];
  activeLevelReminder: LevelReminder | null;
  runtime: RuntimeState;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseUrl: string;
  downloadUrl: string;
  body: string;
  publishedAt?: string;
  assetName?: string;
}

export interface UpdateCheckResult {
  status: 'available' | 'none' | 'error';
  currentVersion: string;
  latestVersion?: string;
  update?: UpdateInfo;
  message?: string;
}


export interface AutoUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface AutoUpdateState {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not_available'
    | 'downloading'
    | 'downloaded'
    | 'error';
  currentVersion: string;
  latestVersion?: string;
  releaseName?: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloadProgress?: AutoUpdateProgress;
  errorMessage?: string;
}

export interface SettingsPatch {
  appLanguage?: AppLanguage;
  overlayOpacity?: number;
  overlayMovementLocked?: boolean;
  realtimePriorityEnabled?: boolean;
  overlayScale?: OverlayScale;
  overlayTextSize?: OverlayTextSize;
  overlayDensity?: OverlayDensity;
  visualFxIntensity?: VisualFxIntensity;
  overlayEffectsEnabled?: boolean;
  theme?: AppTheme;
  themePreferencePrompted?: boolean;
  overlayDebugLayoutEnabled?: boolean;
  overlayVisibleSections?: Partial<OverlayVisibleSections>;
  mainOverlaySettings?: Partial<MainOverlaySettings>;
  devPanelEnabled?: boolean;
  manualHotkeysEnabled?: boolean;
  hotkeys?: Partial<HotkeySettings>;
  companionAlwaysOnTop?: boolean;
  runTimerSettings?: Partial<RunTimerSettings>;
}


export interface TimerVisualTickPayload {
  now: number;
}

export type TimerDiagnosticsEvent =
  | 'timer-diagnostics-enabled'
  | 'timer-visual-diagnostics-ready'
  | 'timer-arm'
  | 'timer-start'
  | 'timer-pause'
  | 'timer-resume'
  | 'timer-reset'
  | 'timer-finish'
  | 'timer-act-change'
  | 'timer-zone-change'
  | 'timer-tick-delay'
  | 'timer-display-jump'
  | 'timer-visual-update-delay'
  | 'timer-visual-display-jump'
  | 'timer-visual-elapsed-backwards'
  | 'timer-unexpected-state'
  | 'timer-renderer-mount'
  | 'timer-renderer-unmount'
  | 'overlay-render-scheduler-ready'
  | 'overlay-render-commit-delay'
  | 'overlay-render-frequency'
  | 'overlay-direct-composition-compat-enabled';

export interface TimerDiagnosticsPayload {
  event: TimerDiagnosticsEvent;
  source: string;
  overlayMode?: OverlayMode | string | null;
  zoneName?: string | null;
  act?: ZoneAct | null;
  isRunning?: boolean | null;
  isPaused?: boolean | null;
  totalElapsedMs?: number | null;
  actElapsedMs?: number | null;
  expectedTickMs?: number | null;
  actualTickMs?: number | null;
  tickDelayMs?: number | null;
  lastRenderedElapsedMs?: number | null;
  currentElapsedMs?: number | null;
  displayDeltaMs?: number | null;
  wallClockDeltaMs?: number | null;
  previousDisplayedText?: string | null;
  nextDisplayedText?: string | null;
  previousDisplayedElapsedMs?: number | null;
  nextDisplayedElapsedMs?: number | null;
  timerStatus?: RunTimerStatus | 'unknown' | null;
  previousStatus?: RunTimerStatus | 'unknown' | null;
  nextStatus?: RunTimerStatus | 'unknown' | null;
  note?: string | null;
  component?: string | null;
  renderSource?: string | null;
  renderReason?: string | null;
  renderDelayMs?: number | null;
  snapshotAgeMs?: number | null;
  snapshotReceivedCount?: number | null;
  snapshotCommitCount?: number | null;
  renderCommitCount?: number | null;
  rendererVisualTickCount?: number | null;
  lastSnapshotReceivedAtMs?: number | null;
  lastSnapshotCommittedAtMs?: number | null;
  lastRenderCommittedAtMs?: number | null;
  documentHidden?: boolean | null;
  visibilityState?: DocumentVisibilityState | 'unknown' | null;
}

export interface ElectronApi {
  getSnapshot: () => Promise<AppSnapshot>;
  getOverlaySnapshot: () => Promise<AppSnapshot>;
  getAppVersion: () => Promise<string>;
  getCachedUpdateCheckResult: () => Promise<UpdateCheckResult | null>;
  getStartupUpdateInfo: () => Promise<UpdateInfo | null>;
  checkForUpdates: () => Promise<UpdateCheckResult>;
  getAutoUpdateState: () => Promise<AutoUpdateState>;
  checkAutoUpdate: () => Promise<AutoUpdateState>;
  downloadAutoUpdate: () => Promise<AutoUpdateState>;
  installAutoUpdate: () => Promise<boolean>;
  chooseLogFile: () => Promise<string | null>;
  updateSettings: (patch: SettingsPatch) => Promise<AppSnapshot>;
  simulateZone: (zoneSelector: string) => Promise<AppSnapshot>;
  reloadGuide: () => Promise<AppSnapshot>;
  resetProgress: () => Promise<AppSnapshot>;
  resetLevelReminders: () => Promise<AppSnapshot>;
  setCampaignBonusDone: (bonusId: string, done: boolean) => Promise<AppSnapshot>;
  resetCampaignBonuses: () => Promise<AppSnapshot>;
  dismissActiveLevelReminder: () => Promise<AppSnapshot>;
  appendDevLogLine: (line: string) => Promise<AppSnapshot>;
  markCurrentChecklistItemDone: () => Promise<AppSnapshot>;
  undoLastChecklistMark: () => Promise<AppSnapshot>;
  armRunTimer: () => Promise<AppSnapshot>;
  startRunTimer: () => Promise<AppSnapshot>;
  pauseRunTimer: () => Promise<AppSnapshot>;
  resumeRunTimer: () => Promise<AppSnapshot>;
  resetRunTimer: () => Promise<AppSnapshot>;
  saveCurrentRunToHistory: (label?: string) => Promise<AppSnapshot>;
  restoreSavedRun: (runId: string) => Promise<AppSnapshot>;
  deleteSavedRun: (runId: string) => Promise<AppSnapshot>;
  finishRunTimer: () => Promise<AppSnapshot>;
  getRunTimerState: () => Promise<RunTimerState>;
  isTimerDiagnosticsEnabled: () => Promise<boolean>;
  sendTimerDiagnostics: (payload: TimerDiagnosticsPayload) => Promise<boolean>;
  getOverlayBounds: () => Promise<OverlayBounds | null>;
  resizeOverlay: (width: number, height: number) => Promise<AppSnapshot>;
  resizeOverlayHeight: (height: number, options?: { force?: boolean; allowBelowMinimum?: boolean }) => Promise<AppSnapshot>;
  setOverlayAutoResizeSuspended: (suspended: boolean) => Promise<boolean>;
  setOverlayDragActive: (active: boolean) => Promise<boolean>;
  setOverlayPosition: (x: number, y: number) => Promise<boolean>;
  setOverlayMode: (mode: OverlayMode) => Promise<AppSnapshot>;
  toggleOverlayMode: () => Promise<AppSnapshot>;
  closeOverlay: () => Promise<boolean>;
  openCompanionPanel: () => Promise<AppSnapshot>;
  requestRunResetConfirmation: () => Promise<AppSnapshot>;
  toggleCompanionPanel: () => Promise<AppSnapshot>;
  openSettings: () => Promise<AppSnapshot>;
  toggleSettings: () => Promise<AppSnapshot>;
  openInfo: () => Promise<AppSnapshot>;
  openCommunity: () => Promise<AppSnapshot>;
  openSupport: () => Promise<AppSnapshot>;
  openReportIssue: () => Promise<AppSnapshot>;
  openUpdateDownload: (url: string) => Promise<boolean>;
  openReleasePage: (url: string) => Promise<boolean>;
  openExternal: (url: string) => Promise<boolean>;
  cancelCloseConfirm: () => Promise<boolean>;
  confirmCloseAndSave: () => Promise<boolean>;
  onAutoUpdateChanged: (callback: (state: AutoUpdateState) => void) => () => void;
  onRunTimerChanged: (callback: (runTimer: RunTimerState) => void) => () => void;
  onRunResetConfirmationRequested: (callback: () => void) => () => void;
  onTimerVisualTick: (callback: (payload: TimerVisualTickPayload) => void) => () => void;
  onStateChanged: (callback: (snapshot: AppSnapshot) => void) => () => void;
}
