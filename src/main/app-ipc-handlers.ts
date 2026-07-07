import { appendFile } from 'node:fs/promises';
import {
  app,
  dialog,
  ipcMain,
  screen,
  shell
} from 'electron';
import type { OpenDialogOptions } from 'electron';

import {
  areOverlayBoundsEqual,
  shouldIgnoreOverlayAutoHeight
} from './overlay-window-bounds';
import { isTimerDiagnosticsEnabled } from './timer-diagnostics-log';
import type { OverlayMode, SettingsPatch, TimerDiagnosticsPayload } from '../shared/types';
import {
  DEV_SAMPLE_ZONE_LINE,
  clampOpacity,
  isDev,
  isSafeExternalUrl
} from './app-environment';

const MAX_DEV_LOG_LINE_LENGTH = 4000;
const MAX_TIMER_DIAGNOSTICS_SOURCE_LENGTH = 160;
const MAX_TIMER_DIAGNOSTICS_STRING_LENGTH = 1000;
const TIMER_DIAGNOSTICS_EVENTS = new Set<TimerDiagnosticsPayload['event']>([
    'timer-diagnostics-enabled',
    'timer-visual-diagnostics-ready',
    'timer-arm',
    'timer-start',
    'timer-pause',
    'timer-resume',
    'timer-reset',
    'timer-finish',
    'timer-act-change',
    'timer-zone-change',
    'timer-tick-delay',
    'timer-display-jump',
    'timer-visual-update-delay',
    'timer-visual-display-jump',
    'timer-visual-elapsed-backwards',
    'timer-unexpected-state',
    'timer-renderer-mount',
    'timer-renderer-unmount',
    'overlay-render-scheduler-ready',
    'overlay-render-commit-delay',
    'overlay-render-frequency',
    'overlay-direct-composition-compat-enabled'
]);
const TIMER_DIAGNOSTICS_STRING_FIELDS = [
    'overlayMode',
    'zoneName',
    'previousDisplayedText',
    'nextDisplayedText',
    'timerStatus',
    'previousStatus',
    'nextStatus',
    'note',
    'component',
    'renderSource',
    'renderReason',
    'visibilityState'
] as const;
const TIMER_DIAGNOSTICS_NUMBER_FIELDS = [
    'totalElapsedMs',
    'actElapsedMs',
    'expectedTickMs',
    'actualTickMs',
    'tickDelayMs',
    'lastRenderedElapsedMs',
    'currentElapsedMs',
    'displayDeltaMs',
    'wallClockDeltaMs',
    'previousDisplayedElapsedMs',
    'nextDisplayedElapsedMs',
    'renderDelayMs',
    'snapshotAgeMs',
    'snapshotReceivedCount',
    'snapshotCommitCount',
    'renderCommitCount',
    'rendererVisualTickCount',
    'lastSnapshotReceivedAtMs',
    'lastSnapshotCommittedAtMs',
    'lastRenderCommittedAtMs'
] as const;
const TIMER_DIAGNOSTICS_BOOLEAN_FIELDS = [
    'isRunning',
    'isPaused',
    'documentHidden'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTimerDiagnosticsString(value: unknown, maxLength: number): string | null {
    return typeof value === 'string'
        ? value.slice(0, maxLength)
        : null;
}

function normalizeTimerDiagnosticsPayload(value: unknown): TimerDiagnosticsPayload | null {
    if (!isRecord(value)) {
        return null;
    }

    const event = value.event;
    const source = normalizeTimerDiagnosticsString(value.source, MAX_TIMER_DIAGNOSTICS_SOURCE_LENGTH);
    if (typeof event !== 'string' || !TIMER_DIAGNOSTICS_EVENTS.has(event as TimerDiagnosticsPayload['event']) || source === null) {
        return null;
    }

    const payload: Record<string, unknown> & Pick<TimerDiagnosticsPayload, 'event' | 'source'> = {
        event: event as TimerDiagnosticsPayload['event'],
        source
    };

    for (const field of TIMER_DIAGNOSTICS_STRING_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue === undefined) {
            continue;
        }
        if (fieldValue === null) {
            payload[field] = null;
            continue;
        }
        const normalizedValue = normalizeTimerDiagnosticsString(fieldValue, MAX_TIMER_DIAGNOSTICS_STRING_LENGTH);
        if (normalizedValue === null) {
            return null;
        }
        payload[field] = normalizedValue;
    }

    for (const field of TIMER_DIAGNOSTICS_NUMBER_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue === undefined) {
            continue;
        }
        if (fieldValue === null) {
            payload[field] = null;
            continue;
        }
        if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) {
            return null;
        }
        payload[field] = fieldValue;
    }

    for (const field of TIMER_DIAGNOSTICS_BOOLEAN_FIELDS) {
        const fieldValue = value[field];
        if (fieldValue === undefined) {
            continue;
        }
        if (fieldValue === null || typeof fieldValue === 'boolean') {
            payload[field] = fieldValue;
            continue;
        }
        return null;
    }

    const act = value.act;
    if (act !== undefined) {
        if (act === null || act === 'interlude' || (typeof act === 'number' && Number.isFinite(act))) {
            payload.act = act;
        }
        else {
            return null;
        }
    }

    return payload as TimerDiagnosticsPayload;
}

function normalizeSettingsPatchInput(value: unknown): SettingsPatch {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as SettingsPatch
        : {};
}

function isOverlayMode(value: unknown): value is OverlayMode {
    return value === 'full' || value === 'timer_only';
}

function normalizeOverlayModeSettingsPatch(patch: SettingsPatch): SettingsPatch {
    const overlayMode = patch.mainOverlaySettings?.overlayMode;
    if (!patch.mainOverlaySettings || overlayMode === undefined || isOverlayMode(overlayMode)) {
        return patch;
    }

    const { overlayMode: _invalidOverlayMode, ...mainOverlaySettings } = patch.mainOverlaySettings;
    return {
        ...patch,
        mainOverlaySettings
    };
}

function finiteRoundedNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? Math.round(numberValue)
    : fallback;
}

function normalizeDevLogLine(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    return value.slice(0, MAX_DEV_LOG_LINE_LENGTH).trim() || DEV_SAMPLE_ZONE_LINE;
}

export function runRegisterIpc(this: any) {
        ipcMain.handle('app:get-snapshot', async () => this.getSnapshot());
        ipcMain.handle('app:get-overlay-snapshot', async () => this.getOverlaySnapshot());
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
            patch = normalizeSettingsPatchInput(patch);
            patch = normalizeOverlayModeSettingsPatch(patch);
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
                const currentPositionBounds = previousOverlayBounds ?? this.overlayWindow.getBounds();
                const targetModeBounds = this.getOverlayBoundsForMode(this.overlayMode, this.config.overlayDensity);
                const nextBounds = this.normalizeOverlayBoundsForMode({
                    ...targetModeBounds,
                    x: currentPositionBounds.x,
                    y: currentPositionBounds.y
                }, this.overlayMode, this.config.overlayDensity);
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
            this.runtime.endgameT15CompletionNotice = null;
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
            if (!isDev && !this.config.devPanelEnabled) {
                return this.getSnapshot();
            }
            const line = normalizeDevLogLine(rawLine);
            if (line === null) {
                return this.getSnapshot();
            }
            const targetPath = this.config.logFilePath ?? this.runtime.watchedLogPath;
            if (!targetPath) {
                return this.getSnapshot();
            }
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
            const normalizedPayload = normalizeTimerDiagnosticsPayload(payload);
            if (!normalizedPayload) {
                return false;
            }
            return await this.timerDiagnosticsLog.write(this.buildTimerDiagnosticsRecord(normalizedPayload));
        });
        ipcMain.handle('app:resize-overlay', async (_event: any, width: any, height: any) => {
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return false;
            }
            const currentBounds = targetWindow.getBounds();
            const nextBounds = this.normalizeOverlayBoundsForMode({
                x: currentBounds.x,
                y: currentBounds.y,
                width: Math.round(Number(width) || currentBounds.width),
                height: Math.round(Number(height) || currentBounds.height)
            }, this.overlayMode, this.config.overlayDensity);
            if (areOverlayBoundsEqual(currentBounds, nextBounds)) {
                return false;
            }
            this.applyOverlayWindowBounds('manualResize', nextBounds);
            const changed = this.persistOverlayBoundsForCurrentState(targetWindow.getBounds());
            if (changed) {
                this.broadcastState();
            }
            return true;
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
        ipcMain.handle('app:resize-overlay-height', async (_event: any, height: any, options: any = {}) => {
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return false;
            }
            const forceAutoHeight = Boolean(options?.force);
            const allowBelowMinimum = Boolean(options?.allowBelowMinimum);
            const currentBounds = targetWindow.getBounds();
            const requestedHeight = Math.round(Number(height) || currentBounds.height);
            const ignoreBecauseDragIsActive = this.overlayDragInProgress;
            const ignoreBecauseSuspended = !forceAutoHeight && shouldIgnoreOverlayAutoHeight({
                dragInProgress: false,
                suspendedUntil: this.overlayAutoResizeSuspendedUntil
            });
            if (ignoreBecauseDragIsActive || ignoreBecauseSuspended) {
                this.logOverlayBoundsEvent('info', {
                    phase: 'auto-height-ignored',
                    source: 'autoHeight',
                    reason: ignoreBecauseDragIsActive ? 'dragActive' : 'suspended',
                    requestedHeight,
                    bounds: targetWindow.getBounds()
                });
                return false;
            }
            let nextBounds = this.normalizeOverlayBoundsForMode({
                ...currentBounds,
                height: requestedHeight
            }, this.overlayMode, this.config.overlayDensity);
            const minimumSize = this.getOverlayMinimumSize(this.overlayMode, this.config.overlayDensity, this.config.overlayScale);
            if (
                allowBelowMinimum &&
                this.overlayMode !== 'timer_only' &&
                requestedHeight < minimumSize.height
            ) {
                const display = screen.getDisplayMatching(currentBounds);
                const virtualArea = this.getOverlayVirtualWorkArea();
                const collapsedHeight = Math.min(
                    Math.max(44, requestedHeight),
                    Math.max(44, display.workArea.height - 16)
                );
                const minVisibleHeight = this.getOverlayMinimumVisibleHeight(collapsedHeight);
                const minY = virtualArea.y;
                const maxY = virtualArea.y + virtualArea.height - minVisibleHeight;
                nextBounds = {
                    ...nextBounds,
                    y: Math.min(Math.max(nextBounds.y, minY), Math.max(minY, maxY)),
                    height: collapsedHeight
                };
            }
            if (areOverlayBoundsEqual(currentBounds, nextBounds)) {
                return false;
            }
            this.applyOverlayWindowBounds('autoHeight', nextBounds);
            const changed = this.persistOverlayBoundsForCurrentState(targetWindow.getBounds());
            if (changed) {
                this.broadcastState();
            }
            return true;
        });
        ipcMain.handle('app:set-overlay-position', async (_event: any, x: any, y: any) => {
            this.overlayAutoResizeSuspendedUntil = Math.max(this.overlayAutoResizeSuspendedUntil, Date.now() + 800);
            const targetWindow = this.overlayWindow;
            if (!targetWindow || targetWindow.isDestroyed()) {
                return false;
            }
            const currentBounds = targetWindow.getBounds();
            const nextX = finiteRoundedNumber(x, currentBounds.x);
            const nextY = finiteRoundedNumber(y, currentBounds.y);
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
            if (!isOverlayMode(mode)) {
                return this.getSnapshot();
            }
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
