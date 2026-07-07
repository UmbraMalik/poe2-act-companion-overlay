import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

import { checkForUpdates } from './services/update-service';
import { createAppIcon } from './app-icons';
import {
  UPDATE_CHECK_DELAY_MS,
  isDev
} from './app-environment';


export function runGetUpdateWindowOwner(this: any) {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow &&
            !focusedWindow.isDestroyed() &&
            focusedWindow !== this.updateWindow) {
            return focusedWindow;
        }
        return [this.settingsWindow, this.companionWindow, this.infoWindow, this.communityWindow, this.supportWindow, this.reportWindow, this.overlayWindow].find((win: any) => Boolean(win && !win.isDestroyed() && win.isVisible()));
    }

export function runBroadcastAutoUpdateState(this: any, state: any) {
        const windows = [
            this.settingsWindow,
            this.updateWindow,
            this.companionWindow,
            this.infoWindow,
            this.communityWindow,
            this.supportWindow,
            this.reportWindow,
            this.overlayWindow
        ];
        for (const window of windows) {
            if (window && !window.isDestroyed()) {
                window.webContents.send('app:auto-update-changed', state);
            }
        }
    }

export function runScheduleStartupUpdateCheck(this: any) {
        if (this.updateCheckTimer) {
            clearTimeout(this.updateCheckTimer);
        }
        this.updateCheckTimer = setTimeout(() => {
            this.updateCheckTimer = null;
            void this.runStartupUpdateCheck();
        }, UPDATE_CHECK_DELAY_MS);
    }

export async function runRunStartupUpdateCheck(this: any) {
        if (this.isQuitting || this.isAutoUpdateCheckInFlight) {
            return;
        }
        this.isAutoUpdateCheckInFlight = true;
        try {
            const autoState = await this.autoUpdateService.checkForUpdates();
            if (autoState.status === 'available') {
                this.openUpdateWindow();
                return;
            }
            // Dev fallback: electron-updater usually cannot work without packaged update config.
            // Keep the existing GitHub Releases checker useful for local testing.
            if (autoState.status === 'error' && isDev) {
                const result = await this.checkForUpdates(false);
                if (result.status === 'available' && result.update) {
                    this.openUpdateWindow(result.update);
                }
            }
        }
        finally {
            this.isAutoUpdateCheckInFlight = false;
        }
    }

export async function runCheckForUpdates(this: any, showErrors: any = true) {
        const result = await checkForUpdates(app.getVersion());
        if (result.status === 'error') {
            if (showErrors) {
                this.cachedUpdateCheckResult = result;
            }
            return result;
        }
        this.cachedUpdateCheckResult = result;
        this.startupUpdateInfo = result.status === 'available' ? result.update ?? null : null;
        return result;
    }

export function runOpenUpdateWindow(this: any, updateInfo: any = null) {
        this.startupUpdateInfo = updateInfo;
        if (this.updateWindow && !this.updateWindow.isDestroyed()) {
            this.updateWindow.show();
            this.updateWindow.focus();
            return;
        }
        const parentWindow = this.getUpdateWindowOwner();
        this.updateWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 680,
            height: 720,
            minWidth: 620,
            minHeight: 560,
            resizable: false,
            minimizable: false,
            maximizable: false,
            fullscreenable: false,
            show: false,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#101318',
            autoHideMenuBar: true,
            skipTaskbar: true,
            alwaysOnTop: true,
            ...(parentWindow ? { parent: parentWindow } : {}),
            webPreferences: {
                preload: join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                backgroundThrottling: false
            }
        });
        this.updateWindow.setMenuBarVisibility(false);
        this.updateWindow.removeMenu();
        this.updateWindow.setAlwaysOnTop(true, 'screen-saver');
        this.updateWindow.on('closed', () => {
            this.updateWindow = null;
        });
        void this.loadWindowPage(this.updateWindow, 'update');
        this.updateWindow.once('ready-to-show', () => {
            this.updateWindow?.show();
            this.updateWindow?.focus();
        });
    }

export async function runInstallAutoUpdate(this: any) {
        const state = this.autoUpdateService.getState();
        if (state.status !== 'downloaded') {
            return false;
        }
        try {
            if (this.config.runTimer.status === 'running') {
                this.pauseRunTimerForQuit(Date.now());
            }
            this.isQuittingConfirmed = true;
            this.prepareForQuit();
            setTimeout(() => {
                this.autoUpdateService.quitAndInstall();
            }, 50);
            return true;
        }
        catch (error) {
            console.error('[AutoUpdate] Failed to install update.', error);
            return false;
        }
    }
