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


export function runSettleCloseConfirm(this: any, result: any) {
        const resolve = this.resolveCloseConfirmResult;
        const window = this.closeConfirmWindow;
        this.resolveCloseConfirmResult = null;
        this.pendingCloseConfirmResult = null;
        this.closeConfirmWindow = null;
        if (window && !window.isDestroyed()) {
            window.destroy();
        }
        resolve?.(result);
    }

export async function runShowCustomQuitConfirmation(this: any) {
        if (this.pendingCloseConfirmResult) {
            this.closeConfirmWindow?.show();
            this.closeConfirmWindow?.focus();
            return this.pendingCloseConfirmResult;
        }
        try {
            const parentWindow = this.getQuitDialogOwnerWindow();
            const closeConfirmWindow = new BrowserWindow({
                width: 500,
                height: 252,
                minWidth: 460,
                minHeight: 220,
                maxWidth: 520,
                maxHeight: 320,
                resizable: false,
                minimizable: false,
                maximizable: false,
                fullscreenable: false,
                movable: true,
                show: false,
                frame: false,
                transparent: false,
                backgroundColor: '#101318',
                title: this.t('main.quitTitle'),
                skipTaskbar: true,
                alwaysOnTop: true,
                modal: Boolean(parentWindow),
                ...(parentWindow ? { parent: parentWindow } : {}),
                webPreferences: {
                    preload: join(__dirname, 'preload.js'),
                    contextIsolation: true,
                    nodeIntegration: false,
                    backgroundThrottling: false
                }
            });
            closeConfirmWindow.setMenuBarVisibility(false);
            closeConfirmWindow.removeMenu();
            closeConfirmWindow.setAlwaysOnTop(true, 'screen-saver');
            closeConfirmWindow.on('close', (event: any) => {
                if (!this.resolveCloseConfirmResult) {
                    return;
                }
                event.preventDefault();
                this.settleCloseConfirm('stay');
            });
            closeConfirmWindow.on('closed', () => {
                this.closeConfirmWindow = null;
            });
            this.closeConfirmWindow = closeConfirmWindow;
            this.pendingCloseConfirmResult = new Promise((resolve: any) => {
                this.resolveCloseConfirmResult = resolve;
            });
            closeConfirmWindow.once('ready-to-show', () => {
                closeConfirmWindow.show();
                closeConfirmWindow.focus();
            });
            await this.loadWindowPage(closeConfirmWindow, 'close-confirm');
            return this.pendingCloseConfirmResult;
        }
        catch (error) {
            console.error('[Quit] Failed to open custom quit confirmation window.', error);
            if (this.closeConfirmWindow && !this.closeConfirmWindow.isDestroyed()) {
                this.closeConfirmWindow.destroy();
            }
            this.closeConfirmWindow = null;
            this.pendingCloseConfirmResult = null;
            this.resolveCloseConfirmResult = null;
            return null;
        }
    }

export async function runShowNativeQuitConfirmation(this: any) {
        const result = await this.showMessageBoxSafe({
            type: 'warning',
            title: this.t('main.quitTitle'),
            message: this.t('main.quitMessage'),
            detail: this.t('main.quitDetail'),
            buttons: [this.t('main.stay'), this.t('main.closeAndSave')],
            defaultId: 0,
            cancelId: 0,
            noLink: true
        });
        return result.response === 1;
    }

export function runBuildManualPausedRunTimer(this: any, now: any) {
        const runTimer = this.config.runTimer;
        return {
            ...runTimer,
            status: 'paused',
            elapsedMs: this.getRunTimerDisplayElapsedMs(now),
            resumedAt: null,
            pausedAt: now,
            lastZoneEnteredAt: null,
            currentZoneElapsedMs: this.getCurrentZoneElapsedMs(now),
            pauseReason: 'manual',
            pauseCount: runTimer.pauseCount + 1
        };
    }

export function runPauseRunTimerForQuit(this: any, now: any = Date.now()) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'running') {
            return;
        }
        this.persistRunTimer(this.buildManualPausedRunTimer(now), {
            event: 'timer-pause',
            source: 'main.quit',
            note: 'pause-for-quit'
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export async function runConfirmQuitWhileRunTimerIsRunning(this: any) {
        if (this.isQuitConfirmationInFlight) {
            this.closeConfirmWindow?.show();
            this.closeConfirmWindow?.focus();
            return;
        }
        this.isQuitConfirmationInFlight = true;
        let shouldQuit = false;
        try {
            const customResult = await this.showCustomQuitConfirmation();
            if (customResult === 'close_and_save') {
                shouldQuit = true;
            }
            else if (customResult === null) {
                shouldQuit = await this.showNativeQuitConfirmation();
            }
            if (!shouldQuit) {
                return;
            }
            this.pauseRunTimerForQuit(Date.now());
        }
        catch (error) {
            console.error('[Quit] Failed to preserve running timer before exit.', error);
            await this.showMessageBoxSafe({
                type: 'error',
                title: this.t('main.saveTimerErrorTitle'),
                message: this.t('main.saveTimerErrorTitle'),
                detail: this.t('main.saveTimerErrorDetail'),
                buttons: [this.t('common.ok')],
                defaultId: 0,
                cancelId: 0,
                noLink: true
            });
        }
        finally {
            this.isQuitConfirmationInFlight = false;
        }
        if (!shouldQuit) {
            return;
        }
        this.isQuittingConfirmed = true;
        app.quit();
    }

export async function runRequestCloseOverlayWindow(this: any) {
        const targetWindow = this.overlayWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return false;
        }
        // The overlay X is treated as a real app close action, not "hide to tray".
        // If the timer is running, ask first; if the user stays, keep the overlay visible.
        if (this.config.runTimer.status !== 'running') {
            return this.quitApplicationFromOverlayClose();
        }
        if (this.isOverlayCloseConfirmationInFlight) {
            this.closeConfirmWindow?.show();
            this.closeConfirmWindow?.focus();
            return false;
        }
        this.isOverlayCloseConfirmationInFlight = true;
        let shouldCloseApplication = false;
        try {
            const customResult = await this.showCustomQuitConfirmation();
            if (customResult === 'close_and_save') {
                shouldCloseApplication = true;
            }
            else if (customResult === null) {
                shouldCloseApplication = await this.showNativeQuitConfirmation();
            }
            if (!shouldCloseApplication) {
                this.showOverlayInactive();
                return false;
            }
            this.pauseRunTimerForQuit(Date.now());
            return this.quitApplicationFromOverlayClose();
        }
        catch (error) {
            console.error('[Overlay] Failed to confirm app close while timer is running.', error);
            this.showOverlayInactive();
            return false;
        }
        finally {
            this.isOverlayCloseConfirmationInFlight = false;
        }
    }

export function runQuitApplicationFromOverlayClose(this: any) {
        try {
            if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
                this.persistOverlayBoundsForCurrentState(this.overlayWindow.getBounds());
            }
        }
        catch {
            // Bounds persistence is best-effort; quitting must still work.
        }
        this.isQuittingConfirmed = true;
        this.prepareForQuit();
        app.quit();
        return true;
    }

export function runCloseOverlayWindow(this: any) {
        const targetWindow = this.overlayWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return false;
        }
        this.isClosingOverlayWindow = true;
        try {
            this.persistOverlayBoundsForCurrentState(targetWindow.getBounds());
        }
        catch {
            // Bounds persistence is best-effort; closing must still work.
        }
        targetWindow.close();
        return true;
    }
