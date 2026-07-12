import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  Tray
} from 'electron';

import { ConfigStore } from './services/config-store';
import { GuideService } from './services/guide-service';
import { ZoneMatchExtractor } from './services/zone-match-extractor';
import { LogWatcher } from './services/log-watcher';
import { AutoUpdateService } from './services/auto-update-service';
import { TimerDiagnosticsLog } from './timer-diagnostics-log';
import { translate } from '../i18n/translations';
import { DIRECT_COMPOSITION_COMPAT_ENABLED, configureElectronStartup } from './electron-startup';
import campaignBonusesData from '../data/campaign-bonuses.json';
import type {
  AppConfig,
  AppSnapshot,
  CampaignBonusDefinition,
  CurrentZoneState,
  OverlayBounds,
  OverlayMode,
  SavedRunHistoryEntry,
  UpdateCheckResult,
  UpdateInfo,
} from '../shared/types';

import { DEFAULT_LOG_STATUS_MESSAGE } from './app-environment';
export { inferActHintFromInternalAreaId } from './app-environment';

import {
  runGetUpdateWindowOwner as runGetUpdateWindowOwnerMethod,
  runBroadcastAutoUpdateState as runBroadcastAutoUpdateStateMethod,
  runScheduleStartupUpdateCheck as runScheduleStartupUpdateCheckMethod,
  runRunStartupUpdateCheck as runRunStartupUpdateCheckMethod,
  runCheckForUpdates as runCheckForUpdatesMethod,
  runOpenUpdateWindow as runOpenUpdateWindowMethod,
  runInstallAutoUpdate as runInstallAutoUpdateMethod
} from './app-update-controller';
import {
  runSettleCloseConfirm as runSettleCloseConfirmMethod,
  runShowCustomQuitConfirmation as runShowCustomQuitConfirmationMethod,
  runShowNativeQuitConfirmation as runShowNativeQuitConfirmationMethod,
  runBuildManualPausedRunTimer as runBuildManualPausedRunTimerMethod,
  runPauseRunTimerForQuit as runPauseRunTimerForQuitMethod,
  runConfirmQuitWhileRunTimerIsRunning as runConfirmQuitWhileRunTimerIsRunningMethod,
  runRequestCloseOverlayWindow as runRequestCloseOverlayWindowMethod,
  runQuitApplicationFromOverlayClose as runQuitApplicationFromOverlayCloseMethod,
  runCloseOverlayWindow as runCloseOverlayWindowMethod
} from './app-close-confirmation';
import {
  runRegisterIpc as runRegisterIpcMethod
} from './app-ipc-handlers';
import {
  runLogOverlayBoundsEvent as runLogOverlayBoundsEventMethod,
  runGetOverlayBoundsSourceHint as runGetOverlayBoundsSourceHintMethod,
  runSetOverlayBoundsSourceHint as runSetOverlayBoundsSourceHintMethod,
  runApplyOverlayWindowBounds as runApplyOverlayWindowBoundsMethod,
  runHandleOverlayWindowBoundsEvent as runHandleOverlayWindowBoundsEventMethod,
  runGetOverlayMinimumSize as runGetOverlayMinimumSizeMethod,
  runGetOverlayMaximumOffscreenX as runGetOverlayMaximumOffscreenXMethod,
  runGetOverlayMinimumVisibleWidth as runGetOverlayMinimumVisibleWidthMethod,
  runGetOverlayMinimumVisibleHeight as runGetOverlayMinimumVisibleHeightMethod,
  runGetOverlayScaledDefaultBounds as runGetOverlayScaledDefaultBoundsMethod,
  runGetOverlayVirtualWorkArea as runGetOverlayVirtualWorkAreaMethod,
  runNormalizeOverlayBoundsForMode as runNormalizeOverlayBoundsForModeMethod,
  runIsBoundsVisible as runIsBoundsVisibleMethod,
  runGetFullOverlayFallbackBounds as runGetFullOverlayFallbackBoundsMethod,
  runGetTimerOnlyOverlayFallbackBounds as runGetTimerOnlyOverlayFallbackBoundsMethod,
  runGetCompactOverlayFallbackBounds as runGetCompactOverlayFallbackBoundsMethod,
  runGetSavedOverlayBoundsForState as runGetSavedOverlayBoundsForStateMethod,
  runGetFallbackOverlayBoundsForState as runGetFallbackOverlayBoundsForStateMethod,
  runGetOverlayBoundsForMode as runGetOverlayBoundsForModeMethod,
  runGetCompanionBounds as runGetCompanionBoundsMethod,
  runPersistOverlayBoundsForState as runPersistOverlayBoundsForStateMethod,
  runPersistOverlayBoundsForCurrentState as runPersistOverlayBoundsForCurrentStateMethod,
  runPersistOverlayBoundsImmediately as runPersistOverlayBoundsImmediatelyMethod,
  runPersistOverlayBounds as runPersistOverlayBoundsMethod,
  runPersistCompanionBoundsImmediately as runPersistCompanionBoundsImmediatelyMethod,
  runPersistCompanionBounds as runPersistCompanionBoundsMethod
} from './app-overlay-bounds-controller';
import {
  runCreateOverlayWindow as runCreateOverlayWindowMethod,
  runGetConfiguredHotkeys as runGetConfiguredHotkeysMethod,
  runRegisterGlobalHotkeys as runRegisterGlobalHotkeysMethod,
  runGetLocalInputAccelerator as runGetLocalInputAcceleratorMethod,
  runAttachManualHotkeys as runAttachManualHotkeysMethod,
  runToggleSettingsWindow as runToggleSettingsWindowMethod,
  runOpenSettingsWindow as runOpenSettingsWindowMethod,
  runToggleCompanionWindow as runToggleCompanionWindowMethod,
  runOpenCompanionWindow as runOpenCompanionWindowMethod,
  runOpenInfoWindow as runOpenInfoWindowMethod,
  runOpenCommunityWindow as runOpenCommunityWindowMethod,
  runOpenSupportWindow as runOpenSupportWindowMethod,
  runOpenReportIssueWindow as runOpenReportIssueWindowMethod,
  runCreateTray as runCreateTrayMethod,
  runGetHotkeyTrayLabel as runGetHotkeyTrayLabelMethod,
  runRefreshTrayMenu as runRefreshTrayMenuMethod,
  runAppendDevSampleLine as runAppendDevSampleLineMethod,
  runShowOverlayInactive as runShowOverlayInactiveMethod,
  runShowOverlay as runShowOverlayMethod,
  runSetOverlayMode as runSetOverlayModeMethod,
  runToggleOverlayMode as runToggleOverlayModeMethod,
  runLoadWindowPage as runLoadWindowPageMethod,
  runGetStartupOverlayMode as runGetStartupOverlayModeMethod
} from './app-window-controller';
import {
  runLoadGuide as runLoadGuideMethod,
  runRestoreLastZoneFromConfig as runRestoreLastZoneFromConfigMethod,
  runRebindCurrentZoneAfterGuideReload as runRebindCurrentZoneAfterGuideReloadMethod,
  runEnsureLogFile as runEnsureLogFileMethod,
  runFindAutoLogFile as runFindAutoLogFileMethod,
  runIsReadable as runIsReadableMethod,
  runClearLogFileInfoRefreshTimer as runClearLogFileInfoRefreshTimerMethod,
  runScheduleLogFileInfoRefresh as runScheduleLogFileInfoRefreshMethod,
  runRefreshLogFileInfo as runRefreshLogFileInfoMethod,
  runStartLogWatcher as runStartLogWatcherMethod,
  runSetCurrentZone as runSetCurrentZoneMethod,
  runHandleZoneLeave as runHandleZoneLeaveMethod,
  runSetSceneWithoutGuide as runSetSceneWithoutGuideMethod,
  runSetTownScene as runSetTownSceneMethod,
  runRecordVisitedZone as runRecordVisitedZoneMethod,
  runOpenTownVisit as runOpenTownVisitMethod,
  runCloseTownVisit as runCloseTownVisitMethod,
  runHandleRunTimerAfterTownEntered as runHandleRunTimerAfterTownEnteredMethod,
  runRecordZoneTimeEntry as runRecordZoneTimeEntryMethod,
  runCollectVisitedGuides as runCollectVisitedGuidesMethod,
  runBuildRunSummary as runBuildRunSummaryMethod,
  runGetActiveLevelReminder as runGetActiveLevelReminderMethod,
  runNormalizeSceneSource as runNormalizeSceneSourceMethod,
  runGetZoneMatchActHint as runGetZoneMatchActHintMethod,
  runGetFallbackActHintForScene as runGetFallbackActHintForSceneMethod,
  runIsUnknownOrNullScene as runIsUnknownOrNullSceneMethod,
  runIsActLabelScene as runIsActLabelSceneMethod,
  runIsLoginLikeScene as runIsLoginLikeSceneMethod,
  runIsTownScene as runIsTownSceneMethod,
  runIsTownSceneWithGuide as runIsTownSceneWithGuideMethod,
  runIsValidGameplaySceneSource as runIsValidGameplaySceneSourceMethod,
  runGetIgnoredZoneEventReason as runGetIgnoredZoneEventReasonMethod,
  runLogZoneEventDecision as runLogZoneEventDecisionMethod,
  runExtractZoneMatchFromLogLine as runExtractZoneMatchFromLogLineMethod
} from './app-guide-log-controller';
import {
  runGetRunTimerDisplayElapsedMs as runGetRunTimerDisplayElapsedMsMethod,
  runGetCurrentZoneElapsedMs as runGetCurrentZoneElapsedMsMethod,
  runGetCurrentTownElapsedMs as runGetCurrentTownElapsedMsMethod,
  runGetTotalTownElapsedMs as runGetTotalTownElapsedMsMethod,
  runGetCurrentTimerAct as runGetCurrentTimerActMethod,
  runGetCurrentActElapsedForDiagnostics as runGetCurrentActElapsedForDiagnosticsMethod,
  runBuildTimerDiagnosticsRecord as runBuildTimerDiagnosticsRecordMethod,
  runLogTimerDiagnostics as runLogTimerDiagnosticsMethod,
  runProcessRunTimerActivityFromLogLine as runProcessRunTimerActivityFromLogLineMethod,
  runIsEndgameT15CompletionLogLine as runIsEndgameT15CompletionLogLineMethod,
  runCompleteEndgameT15Run as runCompleteEndgameT15RunMethod,
  runClearRunTimerStartTimer as runClearRunTimerStartTimerMethod,
  runPersistRunTimer as runPersistRunTimerMethod,
  runScheduleRunTimerAutoStart as runScheduleRunTimerAutoStartMethod,
  runReconcileRunTimerState as runReconcileRunTimerStateMethod,
  runArmRunTimer as runArmRunTimerMethod,
  runStartRunTimerFromAnchor as runStartRunTimerFromAnchorMethod,
  runStartRunTimerNow as runStartRunTimerNowMethod,
  runPauseRunTimer as runPauseRunTimerMethod,
  runResumeRunTimer as runResumeRunTimerMethod,
  runResetRunTimer as runResetRunTimerMethod,
  runFinishRunTimer as runFinishRunTimerMethod,
  runFinalizeCurrentActSplit as runFinalizeCurrentActSplitMethod,
  runTryRecordActSplitByAct as runTryRecordActSplitByActMethod,
  runRecordActTransitionByHint as runRecordActTransitionByHintMethod,
  runTryRecordActSplit as runTryRecordActSplitMethod,
  runHandleRunTimerAfterZoneEntered as runHandleRunTimerAfterZoneEnteredMethod,
  runProcessLevelUpFromLogLine as runProcessLevelUpFromLogLineMethod,
  runStartTimerVisualHeartbeat as runStartTimerVisualHeartbeatMethod,
  runStopTimerVisualHeartbeat as runStopTimerVisualHeartbeatMethod,
  runEmitRunTimerState as runEmitRunTimerStateMethod
} from './app-timer-controller';
import {
  runNormalizeCampaignBonusSceneName as runNormalizeCampaignBonusSceneNameMethod,
  runGetCampaignBonusContextGuideIds as runGetCampaignBonusContextGuideIdsMethod,
  runCampaignBonusRuleMatches as runCampaignBonusRuleMatchesMethod,
  runSetCampaignBonusDone as runSetCampaignBonusDoneMethod,
  runCampaignBonusMatchesChecklistItem as runCampaignBonusMatchesChecklistItemMethod,
  runSyncCampaignBonusWithChecklist as runSyncCampaignBonusWithChecklistMethod,
  runCampaignBonusTextIncludesAny as runCampaignBonusTextIncludesAnyMethod,
  runCampaignBonusTextIncludesAll as runCampaignBonusTextIncludesAllMethod,
  runCampaignBonusRewardMatchesParsedReward as runCampaignBonusRewardMatchesParsedRewardMethod,
  runGetCampaignBonusRewardFallbackScore as runGetCampaignBonusRewardFallbackScoreMethod,
  runGetCampaignBonusRewardFallbackMinScore as runGetCampaignBonusRewardFallbackMinScoreMethod,
  runFindCampaignBonusFromParsedReward as runFindCampaignBonusFromParsedRewardMethod,
  runGetCampaignBonusLogLineDedupeKey as runGetCampaignBonusLogLineDedupeKeyMethod,
  runRememberCampaignBonusLogLineKey as runRememberCampaignBonusLogLineKeyMethod,
  runApplyCampaignBonusMatchesFromLogLine as runApplyCampaignBonusMatchesFromLogLineMethod
} from './app-campaign-bonus-controller';
import {
  runClearMissedWarning as runClearMissedWarningMethod,
  runSyncRuntimeZoneFields as runSyncRuntimeZoneFieldsMethod,
  runUpdateZoneProgress as runUpdateZoneProgressMethod,
  runGetZoneProgress as runGetZoneProgressMethod,
  runMergeLikelyDoneKeywords as runMergeLikelyDoneKeywordsMethod,
  runMarkCurrentChecklistItemDone as runMarkCurrentChecklistItemDoneMethod,
  runUndoLastChecklistMark as runUndoLastChecklistMarkMethod,
  runSetLogStatus as runSetLogStatusMethod,
  runGetSnapshot as runGetSnapshotMethod,
  runGetOverlaySnapshot as runGetOverlaySnapshotMethod,
  runGetUiPreferencesSnapshot as runGetUiPreferencesSnapshotMethod,
  runClearBroadcastTimer as runClearBroadcastTimerMethod,
  runFlushBroadcastState as runFlushBroadcastStateMethod,
  runBroadcastState as runBroadcastStateMethod
} from './app-state-controller';
import {
  runApplyRealtimePrioritySetting as runApplyRealtimePrioritySettingMethod,
  runClearPerformancePriorityTimers as runClearPerformancePriorityTimersMethod,
  runScheduleRealtimePriorityApply as runScheduleRealtimePriorityApplyMethod
} from './app-performance-priority';

configureElectronStartup();
export class PoeOverlayApp {
    private configStore: ConfigStore;
    private guideService: GuideService;
    readonly zoneMatchExtractor: ZoneMatchExtractor;
    private campaignBonuses: CampaignBonusDefinition[];
    private logWatcher: LogWatcher;
    private overlayWindow: BrowserWindow | null;
    private settingsWindow: BrowserWindow | null;
    private companionWindow: BrowserWindow | null;
    private infoWindow: BrowserWindow | null;
    private communityWindow: BrowserWindow | null;
    private supportWindow: BrowserWindow | null;
    private reportWindow: BrowserWindow | null;
    private closeConfirmWindow: BrowserWindow | null;
    private updateWindow: BrowserWindow | null;
    private tray: Tray | null;
    private processedCampaignRewardLogLineKeys: Set<string>;
    private processedCampaignRewardLogLineOrder: string[];
    private cachedUpdateCheckResult: UpdateCheckResult | null;
    private startupUpdateInfo: UpdateInfo | null;
    private autoUpdateService: AutoUpdateService;
    private timerDiagnosticsLog: TimerDiagnosticsLog;
    private config: AppConfig;
    private overlayMode: OverlayMode;
    private currentZone: CurrentZoneState;
    private runtime: AppSnapshot['runtime'];
    private isQuitting: boolean;
    private isClosingOverlayWindow: boolean;
    private isQuittingConfirmed: boolean;
    private isQuitConfirmationInFlight: boolean;
    private isOverlayCloseConfirmationInFlight: boolean;
    private pendingCloseConfirmResult: Promise<any> | any | null;
    private resolveCloseConfirmResult: ((value: any) => void) | null;
    private logInfoRefreshTimer: ReturnType<typeof setTimeout> | null;
    private checklistHistory: Array<{ zoneId: string; itemId: string }>;
    private broadcastTimer: ReturnType<typeof setTimeout> | null;
    private pendingSnapshot: AppSnapshot | null;
    private overlayBoundsTimer: ReturnType<typeof setTimeout> | null;
    private overlayAutoResizeSuspendedUntil: number;
    private overlayDragInProgress: boolean;
    private overlayDragBounds: OverlayBounds | null;
    private lastOverlayKnownBounds: OverlayBounds | null;
    private overlayBoundsSourceHint: { source: string; applyMode: string; expiresAt: number } | null;
    private companionBoundsTimer: ReturnType<typeof setTimeout> | null;
    private runTimerStartTimer: ReturnType<typeof setTimeout> | null;
    private timerVisualHeartbeat: ReturnType<typeof setInterval> | null;
    private lastTimerVisualHeartbeatSentAtMs: number | null;
    private updateCheckTimer: ReturnType<typeof setTimeout> | null;
    private isAutoUpdateCheckInFlight: boolean;
    private globalHotkeysRegistered: boolean;
    private registeredGlobalHotkeys: Set<string>;
    private performancePriorityTimers: ReturnType<typeof setTimeout>[];
    constructor() {
        this.configStore = new ConfigStore(join(app.getPath('userData'), 'config.json'));
        this.guideService = new GuideService();
        this.zoneMatchExtractor = new ZoneMatchExtractor(this.guideService);
        this.campaignBonuses = campaignBonusesData.bonuses as CampaignBonusDefinition[];
        this.logWatcher = new LogWatcher(this.guideService, {
            onLine: (line: any, source: any) => {
                this.runtime.lastLogLineAt = new Date().toISOString();
                this.runtime.lastLogLine = line;
                this.processRunTimerActivityFromLogLine(line, source);
                this.processLevelUpFromLogLine(line, source);
                this.applyCampaignBonusMatchesFromLogLine(line, source);
                // Do not broadcast the full app snapshot for every log line. Zone changes,
                // level ups and reward callbacks broadcast only when they actually
                // change user-visible state. This keeps the overlay renderer from being
                // flooded while the game writes many log lines during combat/area loads.
            },
            onAppendLine: (line: any) => {
                this.runtime.lastAppendedLine = line;
            },
            onZoneDetected: (zoneMatch: any) => {
                this.runtime.lastMatcherReason = zoneMatch.matcherReason;
                this.runtime.lastMatchedAt = new Date().toISOString();
            },
            onStatusChange: (status: any, message: any) => {
                this.setLogStatus(status, message);
            },
            onRuntimeStateChange: (state: any) => {
                const shouldBroadcast = this.runtime.watchedLogPath !== state.watchedLogPath ||
                    this.runtime.logFileExists !== state.fileExists ||
                    this.runtime.watcherLastMatchedZone !== state.lastMatchedZone;
                this.runtime.watchedLogPath = state.watchedLogPath;
                this.runtime.currentLogOffset = state.currentOffset;
                this.runtime.logFileExists = state.fileExists;
                this.runtime.logFileSize = state.lastFileSize;
                this.runtime.lastAppendedLine = state.lastAppendedLine;
                this.runtime.watcherLastMatchedZone = state.lastMatchedZone;
                this.runtime.lastWatcherUpdateAt = state.lastUpdateTimestamp;
                this.runtime.lastReadAt = state.lastReadAt;
                this.runtime.lastMatchedAt = state.lastMatchedAt;
                this.runtime.lastMatcherReason = state.lastMatcherReason;
                if (shouldBroadcast) {
                    this.broadcastState();
                }
            }
        });
        this.overlayWindow = null;
        this.settingsWindow = null;
        this.companionWindow = null;
        this.infoWindow = null;
        this.communityWindow = null;
        this.supportWindow = null;
        this.reportWindow = null;
        this.closeConfirmWindow = null;
        this.updateWindow = null;
        this.tray = null;
        this.processedCampaignRewardLogLineKeys = new Set();
        this.processedCampaignRewardLogLineOrder = [];
        this.cachedUpdateCheckResult = null;
        this.startupUpdateInfo = null;
        this.autoUpdateService = new AutoUpdateService();
        this.autoUpdateService.onStateChanged((state: any) => this.broadcastAutoUpdateState(state));
        this.timerDiagnosticsLog = new TimerDiagnosticsLog();
        this.config = this.configStore.load();
        this.overlayMode = 'full';
        this.currentZone = {
            rawZoneName: null,
            guide: null,
            sceneKind: 'unknown',
            actHint: null
        };
        this.runtime = {
            timerNowMs: Date.now(),
            guideLoadedAt: null,
            lastLogLine: null,
            lastRawZoneName: null,
            lastMatchedZoneEn: null,
            lastMatchedZoneRu: null,
            lastMatchedGuideId: null,
            lastZoneSource: null,
            logWatcherStatus: 'idle',
            logWatcherMessage: DEFAULT_LOG_STATUS_MESSAGE,
            logFileExists: false,
            logFileSize: null,
            watchedLogPath: null,
            currentLogOffset: 0,
            lastAppendedLine: null,
            watcherLastMatchedZone: null,
            lastWatcherUpdateAt: null,
            lastReadAt: null,
            lastMatchedAt: null,
            lastMatcherReason: 'none',
            lastLevelUpDetectedAt: null,
            lastLogLineAt: null,
            lastValidGameplayZoneAt: null,
            lastGameplayGuideId: null,
            lastGameplayZoneRu: null,
            lastGameplayAct: null,
            lastSceneSource: null,
            lastSceneSourceAt: null,
            overlayMode: 'full',
            missedWarningZoneRu: null,
            missedWarningItems: [],
            endgameT15CompletionNotice: null
        };
        this.isQuitting = false;
        this.isClosingOverlayWindow = false;
        this.isQuittingConfirmed = false;
        this.isQuitConfirmationInFlight = false;
        this.isOverlayCloseConfirmationInFlight = false;
        this.pendingCloseConfirmResult = null;
        this.resolveCloseConfirmResult = null;
        this.logInfoRefreshTimer = null;
        this.checklistHistory = [];
        this.broadcastTimer = null;
        this.pendingSnapshot = null;
        this.overlayBoundsTimer = null;
        this.overlayAutoResizeSuspendedUntil = 0;
        this.overlayDragInProgress = false;
        this.overlayDragBounds = null;
        this.lastOverlayKnownBounds = null;
        this.overlayBoundsSourceHint = null;
        this.companionBoundsTimer = null;
        this.runTimerStartTimer = null;
        this.timerVisualHeartbeat = null;
        this.lastTimerVisualHeartbeatSentAtMs = null;
        this.updateCheckTimer = null;
        this.isAutoUpdateCheckInFlight = false;
        this.globalHotkeysRegistered = false;
        this.registeredGlobalHotkeys = new Set();
        this.performancePriorityTimers = [];
    }
    async bootstrap() {
        this.overlayMode = this.getStartupOverlayMode();
        this.runtime.overlayMode = this.overlayMode;
        this.loadGuide();
        this.restoreLastZoneFromConfig();
        this.reconcileRunTimerState();
        await this.ensureLogFile();
        this.registerGlobalHotkeys();
        this.registerIpc();
        this.logTimerDiagnostics('timer-diagnostics-enabled', {
            source: 'main',
            note: 'env-flag-detected-at-bootstrap'
        });
        if (DIRECT_COMPOSITION_COMPAT_ENABLED) {
            this.logTimerDiagnostics('overlay-direct-composition-compat-enabled', {
                source: 'main.command-line',
                note: 'Windows compatibility mode: Chromium DirectComposition disabled for smoother inactive overlay rendering over games'
            });
        }
        this.createOverlayWindow();
        this.scheduleRealtimePriorityApply(this.config.realtimePriorityEnabled);
        this.startTimerVisualHeartbeat();
        this.createTray();
        this.bindAppEvents();
        this.scheduleStartupUpdateCheck();
        if (!this.config.logFilePath) {
            this.openSettingsWindow();
        }
        else {
            await this.startLogWatcher(this.config.logFilePath, this.config.ignoreExistingLogOnNextStart);
        }
        this.broadcastState();
    }
    bindAppEvents() {
        app.on('before-quit', (event: any) => {
            if (this.isQuittingConfirmed) {
                this.prepareForQuit();
                return;
            }
            if (this.isQuitConfirmationInFlight) {
                event.preventDefault();
                this.closeConfirmWindow?.show();
                this.closeConfirmWindow?.focus();
                return;
            }
            if (this.config.runTimer.status !== 'running') {
                this.isQuittingConfirmed = true;
                this.prepareForQuit();
                return;
            }
            event.preventDefault();
            void this.confirmQuitWhileRunTimerIsRunning();
        });
        app.on('window-all-closed', () => {
            // Keep the tray app alive when the overlay window itself is closed.
            // Explicit app.quit() still works through the tray/menu and goes through before-quit above.
        });
    }
    prepareForQuit() {
        if (this.isQuitting) {
            return;
        }
        this.isQuitting = true;
        this.stopTimerVisualHeartbeat();
        this.clearPerformancePriorityTimers();
        if (this.closeConfirmWindow && !this.closeConfirmWindow.isDestroyed()) {
            this.closeConfirmWindow.destroy();
        }
        this.closeConfirmWindow = null;
        if (this.communityWindow && !this.communityWindow.isDestroyed()) {
            this.communityWindow.destroy();
        }
        this.communityWindow = null;
        if (this.supportWindow && !this.supportWindow.isDestroyed()) {
            this.supportWindow.destroy();
        }
        this.supportWindow = null;
        if (this.reportWindow && !this.reportWindow.isDestroyed()) {
            this.reportWindow.destroy();
        }
        this.reportWindow = null;
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
            this.updateWindow.destroy();
        }
        this.updateWindow = null;
        this.pendingCloseConfirmResult = null;
        this.resolveCloseConfirmResult = null;
        if (this.updateCheckTimer) {
            clearTimeout(this.updateCheckTimer);
            this.updateCheckTimer = null;
        }
        this.clearLogFileInfoRefreshTimer();
        this.clearBroadcastTimer();
        this.persistOverlayBoundsImmediately();
        this.persistCompanionBoundsImmediately();
        if (this.overlayBoundsTimer) {
            clearTimeout(this.overlayBoundsTimer);
            this.overlayBoundsTimer = null;
        }
        if (this.companionBoundsTimer) {
            clearTimeout(this.companionBoundsTimer);
            this.companionBoundsTimer = null;
        }
        this.clearRunTimerStartTimer();
        globalShortcut.unregisterAll();
        this.registeredGlobalHotkeys.clear();
        this.globalHotkeysRegistered = false;
        this.logWatcher.stop();
    }
    getQuitDialogOwnerWindow() {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow && !focusedWindow.isDestroyed()) {
            return focusedWindow;
        }
        return [this.overlayWindow, this.settingsWindow, this.companionWindow, this.infoWindow, this.communityWindow, this.supportWindow, this.reportWindow].find((win: any) => Boolean(win && !win.isDestroyed() && win.isVisible()));
    }
    async showMessageBoxSafe(options: any) {
        const owner = this.getQuitDialogOwnerWindow();
        return owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options);
    }
    getCurrentLanguage() {
        return this.config?.appLanguage === 'en' ? 'en' : 'ru';
    }
    t(key: string, params?: Record<string, string | number | null | undefined>) {
        return translate(this.getCurrentLanguage(), key, params);
    }
    getUpdateWindowOwner() {
        return runGetUpdateWindowOwnerMethod.apply(this, arguments as any);
    }
    broadcastAutoUpdateState(state: any) {
        return runBroadcastAutoUpdateStateMethod.apply(this, arguments as any);
    }

    scheduleStartupUpdateCheck() {
        return runScheduleStartupUpdateCheckMethod.apply(this, arguments as any);
    }
    async runStartupUpdateCheck() {
        return runRunStartupUpdateCheckMethod.apply(this, arguments as any);
    }
    async checkForUpdates(showErrors: any = true) {
        return runCheckForUpdatesMethod.apply(this, arguments as any);
    }
    openUpdateWindow(updateInfo: any = null) {
        return runOpenUpdateWindowMethod.apply(this, arguments as any);
    }
    settleCloseConfirm(result: any) {
        return runSettleCloseConfirmMethod.apply(this, arguments as any);
    }
    async showCustomQuitConfirmation() {
        return runShowCustomQuitConfirmationMethod.apply(this, arguments as any);
    }
    async showNativeQuitConfirmation() {
        return runShowNativeQuitConfirmationMethod.apply(this, arguments as any);
    }
    buildManualPausedRunTimer(now: any) {
        return runBuildManualPausedRunTimerMethod.apply(this, arguments as any);
    }
    pauseRunTimerForQuit(now: any = Date.now()) {
        return runPauseRunTimerForQuitMethod.apply(this, arguments as any);
    }
    async confirmQuitWhileRunTimerIsRunning() {
        return runConfirmQuitWhileRunTimerIsRunningMethod.apply(this, arguments as any);
    }
    async installAutoUpdate() {
        return runInstallAutoUpdateMethod.apply(this, arguments as any);
    }

    registerIpc() {
        return runRegisterIpcMethod.apply(this, arguments as any);
    }
    applyRealtimePrioritySetting(enabled: any = this.config.realtimePriorityEnabled) {
        return runApplyRealtimePrioritySettingMethod.apply(this, arguments as any);
    }
    scheduleRealtimePriorityApply(enabled: any = this.config.realtimePriorityEnabled) {
        return runScheduleRealtimePriorityApplyMethod.apply(this, arguments as any);
    }
    clearPerformancePriorityTimers() {
        return runClearPerformancePriorityTimersMethod.apply(this, arguments as any);
    }
    logOverlayBoundsEvent(level: any, payload: any) {
        return runLogOverlayBoundsEventMethod.apply(this, arguments as any);
    }
    getOverlayBoundsSourceHint() {
        return runGetOverlayBoundsSourceHintMethod.apply(this, arguments as any);
    }
    setOverlayBoundsSourceHint(source: any, applyMode: any) {
        return runSetOverlayBoundsSourceHintMethod.apply(this, arguments as any);
    }
    applyOverlayWindowBounds(source: any, requestedBounds: any, options: any = {}) {
        return runApplyOverlayWindowBoundsMethod.apply(this, arguments as any);
    }
    handleOverlayWindowBoundsEvent(eventName: any) {
        return runHandleOverlayWindowBoundsEventMethod.apply(this, arguments as any);
    }
    createOverlayWindow() {
        return runCreateOverlayWindowMethod.apply(this, arguments as any);
    }
    getConfiguredHotkeys() {
        return runGetConfiguredHotkeysMethod.apply(this, arguments as any);
    }
    registerGlobalHotkeys() {
        return runRegisterGlobalHotkeysMethod.apply(this, arguments as any);
    }
    getLocalInputAccelerator(input: any) {
        return runGetLocalInputAcceleratorMethod.apply(this, arguments as any);
    }
    attachManualHotkeys(window: any) {
        return runAttachManualHotkeysMethod.apply(this, arguments as any);
    }
    toggleSettingsWindow() {
        return runToggleSettingsWindowMethod.apply(this, arguments as any);
    }
    openSettingsWindow() {
        return runOpenSettingsWindowMethod.apply(this, arguments as any);
    }
    toggleCompanionWindow() {
        return runToggleCompanionWindowMethod.apply(this, arguments as any);
    }
    openCompanionWindow() {
        return runOpenCompanionWindowMethod.apply(this, arguments as any);
    }
    openInfoWindow() {
        return runOpenInfoWindowMethod.apply(this, arguments as any);
    }
    openCommunityWindow() {
        return runOpenCommunityWindowMethod.apply(this, arguments as any);
    }
    openSupportWindow() {
        return runOpenSupportWindowMethod.apply(this, arguments as any);
    }
    openReportIssueWindow() {
        return runOpenReportIssueWindowMethod.apply(this, arguments as any);
    }
    createTray() {
        return runCreateTrayMethod.apply(this, arguments as any);
    }
    getHotkeyTrayLabel() {
        return runGetHotkeyTrayLabelMethod.apply(this, arguments as any);
    }
    refreshTrayMenu() {
        return runRefreshTrayMenuMethod.apply(this, arguments as any);
    }
    async appendDevSampleLine() {
        return runAppendDevSampleLineMethod.apply(this, arguments as any);
    }
    async requestCloseOverlayWindow() {
        return runRequestCloseOverlayWindowMethod.apply(this, arguments as any);
    }
    quitApplicationFromOverlayClose() {
        return runQuitApplicationFromOverlayCloseMethod.apply(this, arguments as any);
    }
    closeOverlayWindow() {
        return runCloseOverlayWindowMethod.apply(this, arguments as any);
    }
    showOverlayInactive() {
        return runShowOverlayInactiveMethod.apply(this, arguments as any);
    }
    showOverlay() {
        return runShowOverlayMethod.apply(this, arguments as any);
    }
    setOverlayMode(mode: any) {
        return runSetOverlayModeMethod.apply(this, arguments as any);
    }
    toggleOverlayMode() {
        return runToggleOverlayModeMethod.apply(this, arguments as any);
    }
    async loadWindowPage(window: any, page: any) {
        return runLoadWindowPageMethod.apply(this, arguments as any);
    }
    getStartupOverlayMode() {
        return runGetStartupOverlayModeMethod.apply(this, arguments as any);
    }
    getOverlayMinimumSize(mode: any, density: any = this.config.overlayDensity, scale: any = this.config.overlayScale) {
        return runGetOverlayMinimumSizeMethod.apply(this, arguments as any);
    }
    getOverlayMaximumOffscreenX(width: any) {
        return runGetOverlayMaximumOffscreenXMethod.apply(this, arguments as any);
    }
    getOverlayMinimumVisibleWidth(width: any) {
        return runGetOverlayMinimumVisibleWidthMethod.apply(this, arguments as any);
    }
    getOverlayMinimumVisibleHeight(height: any) {
        return runGetOverlayMinimumVisibleHeightMethod.apply(this, arguments as any);
    }
    getOverlayScaledDefaultBounds(mode: any, density: any = this.config.overlayDensity) {
        return runGetOverlayScaledDefaultBoundsMethod.apply(this, arguments as any);
    }
    getOverlayVirtualWorkArea() {
        return runGetOverlayVirtualWorkAreaMethod.apply(this, arguments as any);
    }
    normalizeOverlayBoundsForMode(bounds: any, mode: any, density: any = this.config.overlayDensity) {
        return runNormalizeOverlayBoundsForModeMethod.apply(this, arguments as any);
    }
    isBoundsVisible(bounds: any) {
        return runIsBoundsVisibleMethod.apply(this, arguments as any);
    }
    getFullOverlayFallbackBounds() {
        return runGetFullOverlayFallbackBoundsMethod.apply(this, arguments as any);
    }
    getTimerOnlyOverlayFallbackBounds() {
        return runGetTimerOnlyOverlayFallbackBoundsMethod.apply(this, arguments as any);
    }
    getCompactOverlayFallbackBounds() {
        return runGetCompactOverlayFallbackBoundsMethod.apply(this, arguments as any);
    }
    getSavedOverlayBoundsForState(mode: any, density: any = this.config.overlayDensity) {
        return runGetSavedOverlayBoundsForStateMethod.apply(this, arguments as any);
    }
    getFallbackOverlayBoundsForState(mode: any, density: any = this.config.overlayDensity) {
        return runGetFallbackOverlayBoundsForStateMethod.apply(this, arguments as any);
    }
    getOverlayBoundsForMode(mode: any, density: any = this.config.overlayDensity) {
        return runGetOverlayBoundsForModeMethod.apply(this, arguments as any);
    }
    getCompanionBounds() {
        return runGetCompanionBoundsMethod.apply(this, arguments as any);
    }
    persistOverlayBoundsForState(mode: any, density: any, bounds: any) {
        return runPersistOverlayBoundsForStateMethod.apply(this, arguments as any);
    }
    persistOverlayBoundsForCurrentState(bounds: any) {
        return runPersistOverlayBoundsForCurrentStateMethod.apply(this, arguments as any);
    }
    persistOverlayBoundsImmediately() {
        return runPersistOverlayBoundsImmediatelyMethod.apply(this, arguments as any);
    }
    persistOverlayBounds() {
        return runPersistOverlayBoundsMethod.apply(this, arguments as any);
    }
    persistCompanionBoundsImmediately() {
        return runPersistCompanionBoundsImmediatelyMethod.apply(this, arguments as any);
    }
    persistCompanionBounds() {
        return runPersistCompanionBoundsMethod.apply(this, arguments as any);
    }
    loadGuide() {
        return runLoadGuideMethod.apply(this, arguments as any);
    }
    restoreLastZoneFromConfig() {
        return runRestoreLastZoneFromConfigMethod.apply(this, arguments as any);
    }
    rebindCurrentZoneAfterGuideReload() {
        return runRebindCurrentZoneAfterGuideReloadMethod.apply(this, arguments as any);
    }
    async ensureLogFile() {
        return runEnsureLogFileMethod.apply(this, arguments as any);
    }
    async findAutoLogFile() {
        return runFindAutoLogFileMethod.apply(this, arguments as any);
    }
    async isReadable(filePath: any) {
        return runIsReadableMethod.apply(this, arguments as any);
    }
    clearLogFileInfoRefreshTimer() {
        return runClearLogFileInfoRefreshTimerMethod.apply(this, arguments as any);
    }
    scheduleLogFileInfoRefresh() {
        return runScheduleLogFileInfoRefreshMethod.apply(this, arguments as any);
    }
    async refreshLogFileInfo(filePath: any = this.config.logFilePath) {
        return runRefreshLogFileInfoMethod.apply(this, arguments as any);
    }
    async startLogWatcher(filePath: any, skipBootstrap: any = false) {
        return runStartLogWatcherMethod.apply(this, arguments as any);
    }
    setCurrentZone(rawZoneName: any, source: any, guide: any = this.guideService.findByZoneName(rawZoneName), actHint: any = null) {
        return runSetCurrentZoneMethod.apply(this, arguments as any);
    }
    handleZoneLeave(_previousGuide: any) {
        return runHandleZoneLeaveMethod.apply(this, arguments as any);
    }
    getRunTimerDisplayElapsedMs(now: any = Date.now()) {
        return runGetRunTimerDisplayElapsedMsMethod.apply(this, arguments as any);
    }
    getCurrentZoneElapsedMs(now: any = Date.now()) {
        return runGetCurrentZoneElapsedMsMethod.apply(this, arguments as any);
    }
    getCurrentTownElapsedMs(_now: any = Date.now()) {
        return runGetCurrentTownElapsedMsMethod.apply(this, arguments as any);
    }
    getTotalTownElapsedMs(_now: any = Date.now()) {
        return runGetTotalTownElapsedMsMethod.apply(this, arguments as any);
    }
    getCurrentTimerAct() {
        return runGetCurrentTimerActMethod.apply(this, arguments as any);
    }
    getCurrentActElapsedForDiagnostics(now: any = Date.now(), currentAct: any = this.getCurrentTimerAct()) {
        return runGetCurrentActElapsedForDiagnosticsMethod.apply(this, arguments as any);
    }
    buildTimerDiagnosticsRecord(payload: any) {
        return runBuildTimerDiagnosticsRecordMethod.apply(this, arguments as any);
    }
    logTimerDiagnostics(event: any, payload: any = {}) {
        return runLogTimerDiagnosticsMethod.apply(this, arguments as any);
    }
    setSceneWithoutGuide(rawZoneName: any, source: any, sceneKind: any, actHint: any = null) {
        return runSetSceneWithoutGuideMethod.apply(this, arguments as any);
    }
    isEndgameT15CompletionLogLine(line: any) {
        return runIsEndgameT15CompletionLogLineMethod.apply(this, arguments as any);
    }
    completeEndgameT15Run(line: any) {
        return runCompleteEndgameT15RunMethod.apply(this, arguments as any);
    }
    setTownScene(rawZoneName: any, source: any) {
        return runSetTownSceneMethod.apply(this, arguments as any);
    }
    recordVisitedZone(guide: any, enteredAt: any) {
        return runRecordVisitedZoneMethod.apply(this, arguments as any);
    }
    openTownVisit(_townName: any, _now: any) {
        return runOpenTownVisitMethod.apply(this, arguments as any);
    }
    closeTownVisit(_now: any) {
        return runCloseTownVisitMethod.apply(this, arguments as any);
    }
    handleRunTimerAfterTownEntered(_now: any) {
        return runHandleRunTimerAfterTownEnteredMethod.apply(this, arguments as any);
    }
    recordZoneTimeEntry(guide: any, now: any) {
        return runRecordZoneTimeEntryMethod.apply(this, arguments as any);
    }
    collectVisitedGuides() {
        return runCollectVisitedGuidesMethod.apply(this, arguments as any);
    }
    buildRunSummary(runTimer: any, totalElapsedMs: any, finishedAt: any) {
        return runBuildRunSummaryMethod.apply(this, arguments as any);
    }
    getActiveLevelReminder() {
        return runGetActiveLevelReminderMethod.apply(this, arguments as any);
    }
    normalizeSceneSource(rawSceneSource: any) {
        return runNormalizeSceneSourceMethod.apply(this, arguments as any);
    }
    getZoneMatchActHint(zoneMatch: any) {
        return runGetZoneMatchActHintMethod.apply(this, arguments as any);
    }
    getFallbackActHintForScene(sceneKind: any, explicitActHint: any = null) {
        return runGetFallbackActHintForSceneMethod.apply(this, arguments as any);
    }
    isUnknownOrNullScene(rawSceneSource: any) {
        return runIsUnknownOrNullSceneMethod.apply(this, arguments as any);
    }
    isActLabelScene(rawSceneSource: any) {
        return runIsActLabelSceneMethod.apply(this, arguments as any);
    }
    isLoginLikeScene(rawSceneSource: any) {
        return runIsLoginLikeSceneMethod.apply(this, arguments as any);
    }
    isTownScene(rawSceneSource: any) {
        return runIsTownSceneMethod.apply(this, arguments as any);
    }
    isTownSceneWithGuide(rawSceneSource: any, guide: any) {
        return runIsTownSceneWithGuideMethod.apply(this, arguments as any);
    }
    isValidGameplaySceneSource(rawSceneSource: any, guide: any = rawSceneSource ? this.guideService.findByZoneName(rawSceneSource) : null) {
        return runIsValidGameplaySceneSourceMethod.apply(this, arguments as any);
    }
    getIgnoredZoneEventReason(zoneMatch: any) {
        return runGetIgnoredZoneEventReasonMethod.apply(this, arguments as any);
    }
    logZoneEventDecision(zoneMatch: any, action: any, reason: any = null) {
        return runLogZoneEventDecisionMethod.apply(this, arguments as any);
    }
    extractZoneMatchFromLogLine(line: any) {
        return runExtractZoneMatchFromLogLineMethod.apply(this, arguments as any);
    }
    processRunTimerActivityFromLogLine(line: any, source: any) {
        return runProcessRunTimerActivityFromLogLineMethod.apply(this, arguments as any);
    }
    clearRunTimerStartTimer() {
        return runClearRunTimerStartTimerMethod.apply(this, arguments as any);
    }
    persistRunTimer(nextRunTimer: any, diagnosticsPayload: any = null) {
        return runPersistRunTimerMethod.apply(this, arguments as any);
    }
    scheduleRunTimerAutoStart() {
        return runScheduleRunTimerAutoStartMethod.apply(this, arguments as any);
    }
    reconcileRunTimerState() {
        return runReconcileRunTimerStateMethod.apply(this, arguments as any);
    }
    armRunTimer(shouldBroadcast: any = true) {
        return runArmRunTimerMethod.apply(this, arguments as any);
    }
    startRunTimerFromAnchor(startedAt: any, source: any = 'main.start-run-timer') {
        return runStartRunTimerFromAnchorMethod.apply(this, arguments as any);
    }
    startRunTimerNow() {
        return runStartRunTimerNowMethod.apply(this, arguments as any);
    }
    pauseRunTimer() {
        return runPauseRunTimerMethod.apply(this, arguments as any);
    }
    resumeRunTimer() {
        return runResumeRunTimerMethod.apply(this, arguments as any);
    }
    resetRunTimer() {
        return runResetRunTimerMethod.apply(this, arguments as any);
    }
    saveCurrentRunToHistory(label: string | null = null) {
        const now = Date.now();
        const runTimer = this.config.runTimer;
        const totalElapsedMs = this.getRunTimerDisplayElapsedMs(now);
        const hasAnyRunData = totalElapsedMs > 0 || runTimer.actSplits.length > 0 || this.config.zoneTimeHistory.length > 0;
        if (!hasAnyRunData) {
            return;
        }

        const currentAct = this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        const longestZones = [...this.config.zoneTimeHistory]
            .sort((left: any, right: any) => right.elapsedMs - left.elapsedMs)
            .slice(0, 5);
        const safeLabel = typeof label === 'string' && label.trim().length > 0
            ? label.trim().slice(0, 80)
            : null;
        const runLabelLocale = this.config.appLanguage === 'en' ? 'en-US' : 'ru-RU';
        const defaultRunLabel = `${this.t('companion.savedRunFallback')} · ${new Date(now).toLocaleString(runLabelLocale)}`;
        const entry: SavedRunHistoryEntry = {
            id: `run-${now}-${Math.random().toString(36).slice(2, 8)}`,
            label: safeLabel ?? defaultRunLabel,
            savedAt: now,
            totalElapsedMs,
            currentAct,
            status: runTimer.status,
            actSplits: [...runTimer.actSplits],
            longestZones,
            zoneTimeHistory: [...this.config.zoneTimeHistory],
            runTimer: {
                ...runTimer,
                status: runTimer.status === 'running' ? 'paused' : runTimer.status,
                elapsedMs: totalElapsedMs,
                resumedAt: null,
                pausedAt: now,
                currentZoneElapsedMs: this.getCurrentZoneElapsedMs(now),
                lastZoneEnteredAt: null,
                pauseReason: runTimer.status === 'running' ? 'manual' : runTimer.pauseReason
            }
        };

        this.config = this.configStore.update({
            runHistory: [entry, ...this.config.runHistory.filter((item: SavedRunHistoryEntry) => item.id !== entry.id)].slice(0, 20)
        });
        this.broadcastState();
    }
    restoreSavedRun(runId: string) {
        const entry = this.config.runHistory.find((item: SavedRunHistoryEntry) => item.id === runId);
        if (!entry) {
            return;
        }
        const now = Date.now();
        this.clearRunTimerStartTimer();
        if (typeof entry.currentAct === 'number') {
            this.runtime.lastGameplayAct = entry.currentAct;
            this.currentZone = {
                ...this.currentZone,
                actHint: entry.currentAct
            };
        }
        this.config = this.configStore.update({
            ignoreExistingLogOnNextStart: true,
            runTimer: {
                ...entry.runTimer,
                status: 'paused',
                elapsedMs: entry.totalElapsedMs,
                resumedAt: null,
                pausedAt: now,
                finishedAt: null,
                lastZoneEnteredAt: null,
                pauseReason: 'manual'
            },
            zoneTimeHistory: [...entry.zoneTimeHistory],
            lastRunSummary: null
        });
        this.emitRunTimerState();
        this.refreshTrayMenu();
        this.broadcastState();
    }
    deleteSavedRun(runId: string) {
        this.config = this.configStore.update({
            runHistory: this.config.runHistory.filter((item: SavedRunHistoryEntry) => item.id !== runId)
        });
        this.broadcastState();
    }
    finishRunTimer() {
        return runFinishRunTimerMethod.apply(this, arguments as any);
    }
    finalizeCurrentActSplit(runTimer: any, now: any) {
        return runFinalizeCurrentActSplitMethod.apply(this, arguments as any);
    }
    tryRecordActSplitByAct(previousAct: any, nextAct: any, now: any) {
        return runTryRecordActSplitByActMethod.apply(this, arguments as any);
    }
    recordActTransitionByHint(previousAct: any, nextAct: any, now: any) {
        return runRecordActTransitionByHintMethod.apply(this, arguments as any);
    }
    tryRecordActSplit(previousGuide: any, nextGuide: any, now: any) {
        return runTryRecordActSplitMethod.apply(this, arguments as any);
    }
    handleRunTimerAfterZoneEntered(previousGuide: any, nextGuide: any, now: any) {
        return runHandleRunTimerAfterZoneEnteredMethod.apply(this, arguments as any);
    }
    processLevelUpFromLogLine(line: any, source: any) {
        return runProcessLevelUpFromLogLineMethod.apply(this, arguments as any);
    }
    normalizeCampaignBonusSceneName(value: any) {
        return runNormalizeCampaignBonusSceneNameMethod.apply(this, arguments as any);
    }
    getCampaignBonusContextGuideIds() {
        return runGetCampaignBonusContextGuideIdsMethod.apply(this, arguments as any);
    }
    campaignBonusRuleMatches(rule: any, line: any) {
        return runCampaignBonusRuleMatchesMethod.apply(this, arguments as any);
    }
    setCampaignBonusDone(bonusId: any, detectedBy: any, line: any = null) {
        return runSetCampaignBonusDoneMethod.apply(this, arguments as any);
    }
    campaignBonusMatchesChecklistItem(bonus: any, item: any, normalizedLine: any) {
        return runCampaignBonusMatchesChecklistItemMethod.apply(this, arguments as any);
    }
    syncCampaignBonusWithChecklist(bonus: any, detectedBy: any, line: any) {
        return runSyncCampaignBonusWithChecklistMethod.apply(this, arguments as any);
    }
    campaignBonusTextIncludesAny(bonus: any, keywords: any) {
        return runCampaignBonusTextIncludesAnyMethod.apply(this, arguments as any);
    }
    campaignBonusTextIncludesAll(bonus: any, keywords: any) {
        return runCampaignBonusTextIncludesAllMethod.apply(this, arguments as any);
    }
    campaignBonusRewardMatchesParsedReward(bonus: any, reward: any) {
        return runCampaignBonusRewardMatchesParsedRewardMethod.apply(this, arguments as any);
    }
    getCampaignBonusRewardFallbackScore(bonus: any) {
        return runGetCampaignBonusRewardFallbackScoreMethod.apply(this, arguments as any);
    }
    getCampaignBonusRewardFallbackMinScore(parsedReward: any) {
        return runGetCampaignBonusRewardFallbackMinScoreMethod.apply(this, arguments as any);
    }
    findCampaignBonusFromParsedReward(line: any, parsedReward: any) {
        return runFindCampaignBonusFromParsedRewardMethod.apply(this, arguments as any);
    }
    getCampaignBonusLogLineDedupeKey(line: any, parsedReward: any) {
        return runGetCampaignBonusLogLineDedupeKeyMethod.apply(this, arguments as any);
    }
    rememberCampaignBonusLogLineKey(key: any) {
        return runRememberCampaignBonusLogLineKeyMethod.apply(this, arguments as any);
    }
    applyCampaignBonusMatchesFromLogLine(line: any, source: any) {
        return runApplyCampaignBonusMatchesFromLogLineMethod.apply(this, arguments as any);
    }
    clearMissedWarning() {
        return runClearMissedWarningMethod.apply(this, arguments as any);
    }
    syncRuntimeZoneFields(rawZoneName: any, guide: any) {
        return runSyncRuntimeZoneFieldsMethod.apply(this, arguments as any);
    }
    updateZoneProgress(guide: any) {
        return runUpdateZoneProgressMethod.apply(this, arguments as any);
    }
    getZoneProgress(zoneId: any) {
        return runGetZoneProgressMethod.apply(this, arguments as any);
    }
    mergeLikelyDoneKeywords(guide: any, matchedKeywords: any) {
        return runMergeLikelyDoneKeywordsMethod.apply(this, arguments as any);
    }
    markCurrentChecklistItemDone() {
        return runMarkCurrentChecklistItemDoneMethod.apply(this, arguments as any);
    }
    undoLastChecklistMark() {
        return runUndoLastChecklistMarkMethod.apply(this, arguments as any);
    }
    setLogStatus(status: any, message: any) {
        return runSetLogStatusMethod.apply(this, arguments as any);
    }
    startTimerVisualHeartbeat() {
        return runStartTimerVisualHeartbeatMethod.apply(this, arguments as any);
    }
    stopTimerVisualHeartbeat() {
        return runStopTimerVisualHeartbeatMethod.apply(this, arguments as any);
    }
    emitRunTimerState() {
        return runEmitRunTimerStateMethod.apply(this, arguments as any);
    }
    getSnapshot() {
        return runGetSnapshotMethod.apply(this, arguments as any);
    }
    getOverlaySnapshot() {
        return runGetOverlaySnapshotMethod.apply(this, arguments as any);
    }
    getUiPreferencesSnapshot() {
        return runGetUiPreferencesSnapshotMethod.apply(this, arguments as any);
    }
    clearBroadcastTimer() {
        return runClearBroadcastTimerMethod.apply(this, arguments as any);
    }
    flushBroadcastState() {
        return runFlushBroadcastStateMethod.apply(this, arguments as any);
    }
    broadcastState() {
        return runBroadcastStateMethod.apply(this, arguments as any);
    }
}
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
    app.quit();
}
else {
    app.whenReady().then(async () => {
        const poeOverlayApp = new PoeOverlayApp();
        await poeOverlayApp.bootstrap();
    });
}
