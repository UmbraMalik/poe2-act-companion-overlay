import { access, appendFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  screen,
  shell,
  Tray
} from 'electron';
import type { OpenDialogOptions } from 'electron';

import { ConfigStore } from './services/config-store';
import { GuideService } from './services/guide-service';
import {
  extractGeneratedAreaId,
  extractNamedZoneFromLine,
  normalizeText,
  parseLevelUp,
  parsePermanentReward
} from './services/log-parser';
import { LogWatcher } from './services/log-watcher';
import { resolveRuntimePath } from './services/runtime-paths';
import { checkForUpdates } from './services/update-service';
import { AutoUpdateService } from './services/auto-update-service';
import {
  DEFAULT_COMPACT_OVERLAY_BOUNDS,
  DEFAULT_COMPANION_BOUNDS,
  DEFAULT_HOTKEYS,
  DEFAULT_OVERLAY_BOUNDS,
  DEFAULT_RUN_TIMER,
  DEFAULT_TIMER_ONLY_OVERLAY_BOUNDS,
  DEFAULT_TOWN_TIMER
} from '../shared/defaults';
import { buildChecklistDefinition, buildChecklistViewItems } from '../shared/checklist';
import { getRunTimerDisplayElapsed, getZoneTimerDisplayElapsed } from '../shared/timers';
import { getOverlayMinimumSize } from '../shared/overlay-layout';
import {
  areOverlayBoundsEqual,
  areOverlayBoundsSizeEqual,
  canSourceChangeOverlaySize,
  planOverlayBoundsChange,
  shouldIgnoreOverlayAutoHeight
} from './overlay-window-bounds';
import { TimerDiagnosticsLog, isTimerDiagnosticsEnabled } from './timer-diagnostics-log';
import { translate } from '../i18n/translations';
import { DIRECT_COMPOSITION_COMPAT_ENABLED, configureElectronStartup } from './electron-startup';
import { createAppIcon } from './app-icons';
import {
  HOTKEY_ACTION_LABELS,
  formatConfiguredHotkey,
  normalizeHotkeyAccelerator
} from './hotkey-utils';
import {
  inferActHintFromInternalAreaId as inferActHintFromInternalAreaIdFromScene,
  isActLabelScene,
  isLoginLikeScene,
  isTownSceneWithGuide,
  isUnknownOrNullScene,
  isValidGameplaySceneSource,
  normalizeSceneText,
  shouldKeepPendingZoneAreaId
} from './scene-classifier';
import campaignBonusesData from '../data/campaign-bonuses.json';
import type {
  AppConfig,
  AppLanguage,
  AppSnapshot,
  AutoUpdateState,
  CampaignBonusDefinition,
  CurrentZoneState,
  GuideEntry,
  GuideZoneProgress,
  LogWatcherStatus,
  OverlayBounds,
  OverlayMode,
  RunSummary,
  RunTimerState,
  SettingsPatch,
  TimerDiagnosticsPayload,
  UpdateCheckResult,
  UpdateInfo,
  ZoneAct,
  ZoneSource
} from '../shared/types';
import {
  BROADCAST_THROTTLE_MS,
  DEV_SAMPLE_ZONE_LINE,
  TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS,
  TIMER_VISUAL_HEARTBEAT_MS,
  UPDATE_CHECK_DELAY_MS,
  clampOpacity,
  devServerUrl,
  isDev,
  isSafeExternalUrl
} from './app-environment';


export function runRegisterIpc(this: any) {
        ipcMain.handle('app:get-snapshot', async () => this.getSnapshot());
        ipcMain.handle('app:get-version', async () => app.getVersion());
        ipcMain.handle('app:get-cached-update-check-result', async () => this.cachedUpdateCheckResult);
        ipcMain.handle('app:get-startup-update-info', async () => this.startupUpdateInfo);
        ipcMain.handle('app:check-for-updates', async () => this.checkForUpdates(true));
        ipcMain.handle('app:auto-update-get-state', async () => this.autoUpdateService.getState());
        ipcMain.handle('app:auto-update-check', async () => this.autoUpdateService.checkForUpdates());
        ipcMain.handle('app:auto-update-download', async () => this.autoUpdateService.downloadUpdate());
        ipcMain.handle('app:auto-update-install', async () => this.installAutoUpdate());
        ipcMain.handle('timer:get-state', async () => this.config.runTimer);
        ipcMain.handle('app:get-overlay-bounds', async () => {
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return null;
            }
            return targetWindow.getBounds();
        });
        ipcMain.handle('close-confirm:stay', async () => {
            this.settleCloseConfirm('stay');
            return true;
        });
        ipcMain.handle('close-confirm:close-and-save', async () => {
            this.settleCloseConfirm('close_and_save');
            return true;
        });
        ipcMain.handle('app:choose-log-file', async () => {
            const owner = this.settingsWindow ?? this.overlayWindow;
            const dialogOptions: OpenDialogOptions = {
                title: this.t('main.chooseLogFileTitle'),
                properties: ['openFile'],
                filters: [
                    { name: this.t('main.logFileFilter'), extensions: ['txt'] },
                    { name: this.t('main.allFilesFilter'), extensions: ['*'] }
                ]
            };
            const result = owner
                ? await dialog.showOpenDialog(owner, dialogOptions)
                : await dialog.showOpenDialog(dialogOptions);
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            const selectedPath = result.filePaths[0] ?? null;
            if (selectedPath) {
                this.config = this.configStore.update({
                    logFilePath: selectedPath,
                    logFileSelectionMode: 'manual'
                });
                await this.startLogWatcher(selectedPath);
                this.broadcastState();
            }
            return selectedPath;
        });
        ipcMain.handle('app:update-settings', async (_event: any, patch: any) => {
            const previousOverlayMode = this.overlayMode;
            const previousOverlayDensity = this.config.overlayDensity;
            const previousOverlayScale = this.config.overlayScale;
            const previousRealtimePriorityEnabled = this.config.realtimePriorityEnabled;
            const nextOverlayMode = patch.mainOverlaySettings?.overlayMode ?? previousOverlayMode;
            const nextOverlayDensity = patch.overlayDensity ?? previousOverlayDensity;
            const nextOverlayScale = patch.overlayScale ?? previousOverlayScale;
            const overlayLayoutChanged = nextOverlayMode !== previousOverlayMode || nextOverlayDensity !== previousOverlayDensity;
            const overlayConstraintsChanged = overlayLayoutChanged || nextOverlayScale !== previousOverlayScale;
            const previousOverlayBounds = overlayConstraintsChanged && this.overlayWindow && !this.overlayWindow.isDestroyed()
                ? this.overlayWindow.getBounds()
                : null;
            if (overlayLayoutChanged && previousOverlayBounds) {
                if (this.overlayBoundsTimer) {
                    clearTimeout(this.overlayBoundsTimer);
                    this.overlayBoundsTimer = null;
                }
                this.persistOverlayBoundsForState(previousOverlayMode, previousOverlayDensity, previousOverlayBounds);
            }
            this.config = this.configStore.updateSettings({
                ...patch,
                ...(patch.overlayOpacity !== undefined
                    ? { overlayOpacity: clampOpacity(patch.overlayOpacity) }
                    : {})
            });
            if (patch.overlayOpacity !== undefined) {
                this.overlayWindow?.setOpacity(this.config.overlayOpacity);
            }
            if (patch.companionAlwaysOnTop !== undefined) {
                this.companionWindow?.setAlwaysOnTop(this.config.companionAlwaysOnTop);
            }
            if (patch.runTimerSettings !== undefined) {
                this.reconcileRunTimerState();
            }
            if (patch.realtimePriorityEnabled !== undefined &&
                this.config.realtimePriorityEnabled !== previousRealtimePriorityEnabled) {
                this.scheduleRealtimePriorityApply(this.config.realtimePriorityEnabled);
            }
            if (patch.hotkeys !== undefined || patch.manualHotkeysEnabled !== undefined) {
                this.registerGlobalHotkeys();
            }
            if (patch.mainOverlaySettings?.overlayMode) {
                this.overlayMode = patch.mainOverlaySettings.overlayMode;
                this.runtime.overlayMode = this.overlayMode;
            }
            if (overlayConstraintsChanged && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                const minimumSize = this.getOverlayMinimumSize(this.overlayMode, this.config.overlayDensity, this.config.overlayScale);
                const nextBounds = overlayLayoutChanged
                    ? this.getOverlayBoundsForMode(this.overlayMode, this.config.overlayDensity)
                    : this.normalizeOverlayBoundsForMode(previousOverlayBounds ?? this.overlayWindow.getBounds(), this.overlayMode, this.config.overlayDensity);
                this.applyOverlayWindowBounds('modeSwitch', nextBounds, { minimumSize });
            }
            this.refreshTrayMenu();
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:simulate-zone', async (_event: any, zoneSelector: any) => {
            const guide = this.guideService.findById(zoneSelector) ??
                this.guideService.findByZoneName(zoneSelector);
            if (guide) {
                this.setCurrentZone(guide.zone_ru, 'simulation', guide);
            }
            return this.getSnapshot();
        });
        ipcMain.handle('app:reload-guide', async () => {
            this.loadGuide();
            this.rebindCurrentZoneAfterGuideReload();
            await this.logWatcher.seekToEnd();
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:reset-progress', async () => {
            this.clearRunTimerStartTimer();
            this.config = this.configStore.resetProgress();
            this.checklistHistory.length = 0;
            this.currentZone = {
                rawZoneName: null,
                guide: null,
                sceneKind: 'unknown',
                actHint: null
            };
            this.runtime.lastRawZoneName = null;
            this.runtime.lastMatchedZoneEn = null;
            this.runtime.lastMatchedZoneRu = null;
            this.runtime.lastMatchedGuideId = null;
            this.runtime.lastGameplayGuideId = null;
            this.runtime.lastGameplayZoneRu = null;
            this.runtime.lastGameplayAct = null;
            this.runtime.lastZoneSource = null;
            this.runtime.lastLevelUpDetectedAt = null;
            this.runtime.missedWarningZoneRu = null;
            this.runtime.missedWarningItems = [];
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:reset-level-reminders', async () => {
            this.config = this.configStore.update({
                levelRemindersState: {
                    shown: [],
                    dismissed: [],
                    activeLevelReminderId: null
                }
            });
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:set-campaign-bonus-done', async (_event: any, bonusId: any, done: any) => {
            this.setCampaignBonusDone(bonusId, done ? 'manual' : null, null);
            return this.getSnapshot();
        });
        ipcMain.handle('app:reset-campaign-bonuses', async () => {
            this.config = this.configStore.update({
                campaignBonusProgress: {}
            });
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:dismiss-active-level-reminder', async () => {
            const state = this.config.levelRemindersState ?? {
                shown: [],
                dismissed: [],
                activeLevelReminderId: null
            };
            const activeId = state.activeLevelReminderId;
            this.config = this.configStore.update({
                levelRemindersState: {
                    shown: state.shown ?? [],
                    dismissed: activeId
                        ? Array.from(new Set([...(state.dismissed ?? []), activeId]))
                        : state.dismissed ?? [],
                    activeLevelReminderId: null
                }
            });
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:append-dev-log-line', async (_event: any, rawLine: any) => {
            const targetPath = this.config.logFilePath ?? this.runtime.watchedLogPath;
            if (!targetPath) {
                return this.getSnapshot();
            }
            const line = rawLine.trim() || DEV_SAMPLE_ZONE_LINE;
            const payload = line.endsWith('\n') ? line : `${line}\r\n`;
            await appendFile(targetPath, payload, 'utf8');
            await this.refreshLogFileInfo(targetPath);
            await this.logWatcher.checkNow();
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:mark-current-checklist-item-done', async () => {
            this.markCurrentChecklistItemDone();
            return this.getSnapshot();
        });
        ipcMain.handle('app:undo-last-checklist-mark', async () => {
            this.undoLastChecklistMark();
            return this.getSnapshot();
        });
        ipcMain.handle('app:arm-run-timer', async () => {
            this.armRunTimer();
            return this.getSnapshot();
        });
        ipcMain.handle('app:start-run-timer', async () => {
            this.startRunTimerNow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:pause-run-timer', async () => {
            this.pauseRunTimer();
            return this.getSnapshot();
        });
        ipcMain.handle('app:resume-run-timer', async () => {
            this.resumeRunTimer();
            return this.getSnapshot();
        });
        ipcMain.handle('app:reset-run-timer', async () => {
            this.resetRunTimer();
            return this.getSnapshot();
        });
        ipcMain.handle('app:save-current-run', async (_event: any, label: any) => {
            this.saveCurrentRunToHistory(typeof label === 'string' ? label : null);
            return this.getSnapshot();
        });
        ipcMain.handle('app:restore-saved-run', async (_event: any, runId: any) => {
            this.restoreSavedRun(String(runId ?? ''));
            return this.getSnapshot();
        });
        ipcMain.handle('app:delete-saved-run', async (_event: any, runId: any) => {
            this.deleteSavedRun(String(runId ?? ''));
            return this.getSnapshot();
        });
        ipcMain.handle('app:finish-run-timer', async () => {
            this.finishRunTimer();
            return this.getSnapshot();
        });
        ipcMain.handle('app:timer-diagnostics', async (_event: any, payload: any) => {
            if (!isTimerDiagnosticsEnabled()) {
                return false;
            }
            if (!payload || typeof payload.event !== 'string' || typeof payload.source !== 'string') {
                return false;
            }
            return await this.timerDiagnosticsLog.write(this.buildTimerDiagnosticsRecord(payload));
        });
        ipcMain.handle('app:resize-overlay', async (_event: any, width: any, height: any) => {
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return this.getSnapshot();
            }
            const currentBounds = targetWindow.getBounds();
            const nextBounds = this.normalizeOverlayBoundsForMode({
                x: currentBounds.x,
                y: currentBounds.y,
                width: Math.round(Number(width) || currentBounds.width),
                height: Math.round(Number(height) || currentBounds.height)
            }, this.overlayMode, this.config.overlayDensity);
            this.applyOverlayWindowBounds('manualResize', nextBounds);
            this.persistOverlayBoundsForCurrentState(targetWindow.getBounds());
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:set-overlay-auto-resize-suspended', async (_event: any, suspended: any) => {
            this.overlayAutoResizeSuspendedUntil = suspended
                ? Date.now() + 2500
                : Math.max(this.overlayAutoResizeSuspendedUntil, Date.now() + 500);
            return true;
        });
        ipcMain.handle('app:set-overlay-drag-active', async (_event: any, active: any) => {
            const dragActive = Boolean(active);
            this.overlayDragInProgress = dragActive;
            if (dragActive && this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.overlayDragBounds = this.overlayWindow.getBounds();
                this.lastOverlayKnownBounds = this.overlayDragBounds;
                this.overlayAutoResizeSuspendedUntil = Math.max(this.overlayAutoResizeSuspendedUntil, Date.now() + 1500);
                this.logOverlayBoundsEvent('info', {
                    phase: 'drag-state',
                    source: 'dragMove',
                    active: true,
                    bounds: this.overlayDragBounds
                });
                return true;
            }
            const finalBounds = this.overlayWindow && !this.overlayWindow.isDestroyed()
                ? this.overlayWindow.getBounds()
                : this.overlayDragBounds;
            this.overlayDragBounds = null;
            this.overlayAutoResizeSuspendedUntil = Math.max(this.overlayAutoResizeSuspendedUntil, Date.now() + 500);
            this.logOverlayBoundsEvent('info', {
                phase: 'drag-state',
                source: 'dragMove',
                active: false,
                bounds: finalBounds ?? null
            });
            if (finalBounds) {
                this.lastOverlayKnownBounds = finalBounds;
            }
            return true;
        });
        ipcMain.handle('app:resize-overlay-height', async (_event: any, height: any) => {
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return this.getSnapshot();
            }
            if (shouldIgnoreOverlayAutoHeight({
                dragInProgress: this.overlayDragInProgress,
                suspendedUntil: this.overlayAutoResizeSuspendedUntil
            })) {
                this.logOverlayBoundsEvent('info', {
                    phase: 'auto-height-ignored',
                    source: 'autoHeight',
                    reason: this.overlayDragInProgress ? 'dragActive' : 'suspended',
                    requestedHeight: Math.round(Number(height) || targetWindow.getBounds().height),
                    bounds: targetWindow.getBounds()
                });
                return this.getSnapshot();
            }
            const currentBounds = targetWindow.getBounds();
            const nextBounds = this.normalizeOverlayBoundsForMode({
                ...currentBounds,
                height: Math.round(Number(height) || currentBounds.height)
            }, this.overlayMode, this.config.overlayDensity);
            this.applyOverlayWindowBounds('autoHeight', nextBounds);
            this.persistOverlayBoundsForCurrentState(targetWindow.getBounds());
            this.broadcastState();
            return this.getSnapshot();
        });
        ipcMain.handle('app:set-overlay-position', async (_event: any, x: any, y: any) => {
            this.overlayAutoResizeSuspendedUntil = Math.max(this.overlayAutoResizeSuspendedUntil, Date.now() + 800);
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return false;
            }
            const currentBounds = targetWindow.getBounds();
            const nextX = Math.round(Number(x) || currentBounds.x);
            const nextY = Math.round(Number(y) || currentBounds.y);
            if (nextX === currentBounds.x && nextY === currentBounds.y) {
                return true;
            }
            this.applyOverlayWindowBounds('dragMove', {
                ...currentBounds,
                x: nextX,
                y: nextY
            });
            return true;
        });
        ipcMain.handle('app:set-overlay-mode', async (_event: any, mode: any) => {
            this.setOverlayMode(mode);
            return this.getSnapshot();
        });
        ipcMain.handle('app:toggle-overlay-mode', async () => {
            this.toggleOverlayMode();
            return this.getSnapshot();
        });
        ipcMain.handle('app:close-overlay', async () => this.requestCloseOverlayWindow());
        ipcMain.handle('app:open-companion-panel', async () => {
            this.openCompanionWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:request-run-reset-confirmation', async () => {
            this.openCompanionWindow();
            const sendResetRequest = () => {
                if (!this.companionWindow || this.companionWindow.isDestroyed()) {
                    return;
                }
                this.companionWindow.show();
                this.companionWindow.focus();
                this.companionWindow.webContents.send('app:request-run-reset-confirmation');
            };
            if (this.companionWindow?.webContents.isLoading()) {
                this.companionWindow.webContents.once('did-finish-load', () => {
                    setTimeout(sendResetRequest, 50);
                });
            }
            else {
                setTimeout(sendResetRequest, 50);
            }
            return this.getSnapshot();
        });
        ipcMain.handle('app:toggle-companion-panel', async () => {
            this.toggleCompanionWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-settings', async () => {
            this.openSettingsWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:toggle-settings', async () => {
            this.toggleSettingsWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-info', async () => {
            this.openInfoWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-community', async () => {
            this.openCommunityWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-support', async () => {
            this.openSupportWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-report-issue', async () => {
            this.openReportIssueWindow();
            return this.getSnapshot();
        });
        ipcMain.handle('app:open-update-download', async (_event: any, url: any) => {
            if (!isSafeExternalUrl(url)) {
                return false;
            }
            await shell.openExternal(url);
            return true;
        });
        ipcMain.handle('app:open-release-page', async (_event: any, url: any) => {
            if (!isSafeExternalUrl(url)) {
                return false;
            }
            await shell.openExternal(url);
            return true;
        });
        ipcMain.handle('app:open-external', async (_event: any, url: any) => {
            if (!isSafeExternalUrl(url)) {
                return false;
            }
            await shell.openExternal(url);
            return true;
        });
    }
