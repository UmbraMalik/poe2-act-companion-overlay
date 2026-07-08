import { appendFile } from 'node:fs/promises';
import {
  app,
  BrowserWindow,
  globalShortcut,
  Menu,
  Tray
} from 'electron';

import { resolveRuntimePath } from './services/runtime-paths';
import { DEFAULT_HOTKEYS } from '../shared/defaults';
import { createAppIcon } from './app-icons';
import {
  HOTKEY_ACTION_LABELS,
  formatConfiguredHotkey,
  normalizeHotkeyAccelerator
} from './hotkey-utils';
import {
  DEV_SAMPLE_ZONE_LINE,
  devServerUrl,
  isDev
} from './app-environment';
import {
  attachWindowNavigationGuards,
  getSecureWebPreferences
} from './window-security';

function showWindowWhenReady(
        window: BrowserWindow | null | undefined,
        options: { focus?: boolean; afterShow?: () => void } = {}
): void {
        const targetWindow = window;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return;
        }
        let didShow = false;
        const show = () => {
            if (didShow || targetWindow.isDestroyed()) {
                return;
            }
            didShow = true;
            if (targetWindow.isMinimized()) {
                targetWindow.restore();
            }
            targetWindow.show();
            if (options.focus !== false) {
                targetWindow.focus();
            }
            options.afterShow?.();
        };
        const finishLoad = () => {
            targetWindow.webContents.off('did-finish-load', finishLoad);
            targetWindow.webContents.off('did-fail-load', finishLoad);
            setTimeout(show, 16);
        };
        if (targetWindow.webContents.isLoading()) {
            targetWindow.webContents.once('did-finish-load', finishLoad);
            targetWindow.webContents.once('did-fail-load', finishLoad);
            return;
        }
        show();
    }

export function runCreateOverlayWindow(this: any) {
        const bounds = this.getOverlayBoundsForMode(this.overlayMode);
        const minimumSize = this.getOverlayMinimumSize(this.overlayMode);
        this.lastOverlayKnownBounds = bounds;
        this.logOverlayBoundsEvent('info', {
            phase: 'window-create',
            source: 'restoreBounds',
            from: null,
            to: bounds
        });
        this.overlayWindow = new BrowserWindow({
            icon: createAppIcon(),
            ...bounds,
            frame: false,
            transparent: true,
            // Native resize is unstable with transparent frameless Electron windows on high-DPI
            // and Linux compositors. The app uses its own resize grip via setBounds instead.
            resizable: false,
            minWidth: minimumSize.width,
            minHeight: minimumSize.height,
            show: false,
            alwaysOnTop: true,
            skipTaskbar: false,
            // Keep the overlay focusable so local buttons and fallback hotkeys still work.
            // Showing is done through showInactive(), so the game should not lose focus on expand/show.
            focusable: true,
            hasShadow: false,
            backgroundColor: '#00000000',
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.overlayWindow);
        this.attachManualHotkeys(this.overlayWindow);
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        this.overlayWindow.setVisibleOnAllWorkspaces(true, {
            visibleOnFullScreen: true
        });
        this.overlayWindow.setOpacity(this.config.overlayOpacity);
        this.overlayWindow.setMenuBarVisibility(false);
        this.overlayWindow.setFocusable(true);
        this.overlayWindow.on('close', (event: any) => {
            if (this.isClosingOverlayWindow) {
                return;
            }
            if (!this.isQuitting) {
                event.preventDefault();
                this.overlayWindow?.hide();
            }
        });
        this.overlayWindow.on('closed', () => {
            this.overlayWindow = null;
            this.isClosingOverlayWindow = false;
            this.overlayDragInProgress = false;
            this.overlayDragBounds = null;
            this.lastOverlayKnownBounds = null;
            this.overlayBoundsSourceHint = null;
        });
        this.overlayWindow.on('move', () => {
            this.handleOverlayWindowBoundsEvent('move');
            this.persistOverlayBounds();
        });
        this.overlayWindow.on('resize', () => {
            this.handleOverlayWindowBoundsEvent('resize');
            this.persistOverlayBounds();
        });
        void this.loadWindowPage(this.overlayWindow, 'overlay');
        this.overlayWindow.once('ready-to-show', () => {
            this.showOverlayInactive();
        });
    }

export function runGetConfiguredHotkeys(this: any) {
        return {
            toggleTimerPause: formatConfiguredHotkey(this.config.hotkeys.toggleTimerPause, DEFAULT_HOTKEYS.toggleTimerPause),
            openCompanion: formatConfiguredHotkey(this.config.hotkeys.openCompanion, DEFAULT_HOTKEYS.openCompanion),
            toggleOverlayMode: formatConfiguredHotkey(this.config.hotkeys.toggleOverlayMode, DEFAULT_HOTKEYS.toggleOverlayMode)
        };
    }

export function runRegisterGlobalHotkeys(this: any) {
        globalShortcut.unregisterAll();
        this.registeredGlobalHotkeys.clear();
        this.globalHotkeysRegistered = false;
        const hotkeys = this.getConfiguredHotkeys();
        const shortcuts: Array<[string, string, () => void]> = [
            [
                'toggleTimerPause',
                hotkeys.toggleTimerPause,
                () => {
                    if (this.config.runTimer.status === 'running') {
                        this.pauseRunTimer();
                    }
                    else if (this.config.runTimer.status === 'paused') {
                        this.resumeRunTimer();
                    }
                }
            ],
            ['openCompanion', hotkeys.openCompanion, () => this.toggleCompanionWindow()],
            ['toggleOverlayMode', hotkeys.toggleOverlayMode, () => this.toggleOverlayMode()]
        ];
        const usedAccelerators = new Map<string, string>();
        for (const [action, accelerator, handler] of shortcuts) {
            const normalized = normalizeHotkeyAccelerator(accelerator);
            if (!normalized) {
                console.warn(`[Hotkeys] Invalid shortcut for ${action}: ${accelerator}`);
                continue;
            }
            const duplicateAction = usedAccelerators.get(normalized);
            if (duplicateAction) {
                console.warn(`[Hotkeys] Duplicate shortcut ${normalized} for ${action} and ${duplicateAction}. Skipping ${action}.`);
                continue;
            }
            usedAccelerators.set(normalized, action);
            const registered = globalShortcut.register(normalized, () => {
                if (this.isQuitting) {
                    return;
                }
                handler();
            });
            if (!registered) {
                console.warn(`[Hotkeys] Failed to register global shortcut ${normalized} (${HOTKEY_ACTION_LABELS[action as keyof typeof HOTKEY_ACTION_LABELS]}). Local fallback will work when overlay is focused.`);
                continue;
            }
            this.registeredGlobalHotkeys.add(normalized);
        }
        this.globalHotkeysRegistered = this.registeredGlobalHotkeys.size > 0;
        this.refreshTrayMenu();
    }

export function runGetLocalInputAccelerator(this: any, input: any) {
        const key = String(input.key ?? '').trim();
        if (!key) {
            return null;
        }
        const parts: string[] = [];
        if (input.control || input.meta) {
            parts.push('Ctrl');
        }
        if (input.alt) {
            parts.push('Alt');
        }
        if (input.shift) {
            parts.push('Shift');
        }
        const upperKey = key.length === 1 ? key.toUpperCase() : key.toUpperCase();
        parts.push(upperKey === ' ' ? 'Space' : upperKey);
        return normalizeHotkeyAccelerator(parts.join('+'));
    }

export function runAttachManualHotkeys(this: any, window: any) {
        window.webContents.on('before-input-event', (event: any, input: any) => {
            if (input.type !== 'keyDown') {
                return;
            }
            const inputAccelerator = this.getLocalInputAccelerator(input);
            if (!inputAccelerator || this.registeredGlobalHotkeys.has(inputAccelerator)) {
                return;
            }
            const hotkeys = this.getConfiguredHotkeys();
            const matches = (value: any) => normalizeHotkeyAccelerator(value) === inputAccelerator;
            if (matches(hotkeys.openCompanion)) {
                event.preventDefault();
                this.toggleCompanionWindow();
                return;
            }
            if (matches(hotkeys.toggleOverlayMode)) {
                event.preventDefault();
                this.toggleOverlayMode();
                return;
            }
            if (matches(hotkeys.toggleTimerPause)) {
                event.preventDefault();
                if (this.config.runTimer.status === 'running') {
                    this.pauseRunTimer();
                }
                else if (this.config.runTimer.status === 'paused') {
                    this.resumeRunTimer();
                }
                return;
            }
        });
    }

export function runToggleSettingsWindow(this: any) {
        if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
            if (this.settingsWindow.isVisible()) {
                this.settingsWindow.hide();
                return;
            }
            showWindowWhenReady(this.settingsWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.openSettingsWindow();
    }

export function runOpenSettingsWindow(this: any) {
        if (this.settingsWindow) {
            showWindowWhenReady(this.settingsWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.settingsWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 760,
            height: 860,
            minWidth: 680,
            minHeight: 720,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#10161f',
            show: false,
            autoHideMenuBar: true,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.settingsWindow);
        this.attachManualHotkeys(this.settingsWindow);
        this.settingsWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.settingsWindow?.hide();
            }
        });
        this.settingsWindow.on('closed', () => {
            this.settingsWindow = null;
        });
        void this.loadWindowPage(this.settingsWindow, 'settings');
        this.settingsWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.settingsWindow, { focus: false, afterShow: () => this.broadcastState() });
        });
    }

export function runToggleCompanionWindow(this: any) {
        if (this.companionWindow && !this.companionWindow.isDestroyed()) {
            if (this.companionWindow.isVisible()) {
                this.companionWindow.hide();
                return;
            }
            showWindowWhenReady(this.companionWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.openCompanionWindow();
    }

export function runOpenCompanionWindow(this: any) {
        if (this.companionWindow) {
            showWindowWhenReady(this.companionWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        const bounds = this.getCompanionBounds();
        this.companionWindow = new BrowserWindow({
            icon: createAppIcon(),
            ...bounds,
            minWidth: 720,
            minHeight: 520,
            resizable: true,
            show: false,
            autoHideMenuBar: true,
            backgroundColor: '#0f151d',
            alwaysOnTop: this.config.companionAlwaysOnTop,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.companionWindow);
        this.attachManualHotkeys(this.companionWindow);
        this.companionWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.companionWindow?.hide();
            }
        });
        this.companionWindow.on('closed', () => {
            this.companionWindow = null;
        });
        this.companionWindow.on('move', () => {
            this.persistCompanionBounds();
        });
        this.companionWindow.on('resize', () => {
            this.persistCompanionBounds();
        });
        void this.loadWindowPage(this.companionWindow, 'companion');
        this.companionWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.companionWindow, { focus: false, afterShow: () => this.broadcastState() });
        });
    }

export function runOpenInfoWindow(this: any) {
        if (this.infoWindow) {
            showWindowWhenReady(this.infoWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.infoWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 760,
            height: 760,
            minWidth: 680,
            minHeight: 620,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#10161f',
            show: false,
            autoHideMenuBar: true,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.infoWindow);
        this.attachManualHotkeys(this.infoWindow);
        this.infoWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.infoWindow?.hide();
            }
        });
        this.infoWindow.on('closed', () => {
            this.infoWindow = null;
        });
        void this.loadWindowPage(this.infoWindow, 'info');
        this.infoWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.infoWindow, { focus: false, afterShow: () => this.broadcastState() });
        });
    }

export function runOpenCommunityWindow(this: any) {
        if (this.communityWindow) {
            showWindowWhenReady(this.communityWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.communityWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 760,
            height: 680,
            minWidth: 680,
            minHeight: 560,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#10161f',
            show: false,
            autoHideMenuBar: true,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.communityWindow);
        this.attachManualHotkeys(this.communityWindow);
        this.communityWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.communityWindow?.hide();
            }
        });
        this.communityWindow.on('closed', () => {
            this.communityWindow = null;
        });
        void this.loadWindowPage(this.communityWindow, 'community');
        this.communityWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.communityWindow, { afterShow: () => this.broadcastState() });
        });
    }

export function runOpenSupportWindow(this: any) {
        if (this.supportWindow) {
            showWindowWhenReady(this.supportWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.supportWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 760,
            height: 700,
            minWidth: 680,
            minHeight: 560,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#10161f',
            show: false,
            autoHideMenuBar: true,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.supportWindow);
        this.attachManualHotkeys(this.supportWindow);
        this.supportWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.supportWindow?.hide();
            }
        });
        this.supportWindow.on('closed', () => {
            this.supportWindow = null;
        });
        void this.loadWindowPage(this.supportWindow, 'support');
        this.supportWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.supportWindow, { afterShow: () => this.broadcastState() });
        });
    }

export function runOpenReportIssueWindow(this: any) {
        if (this.reportWindow) {
            showWindowWhenReady(this.reportWindow, { afterShow: () => this.broadcastState() });
            return;
        }
        this.reportWindow = new BrowserWindow({
            icon: createAppIcon(),
            width: 820,
            height: 780,
            minWidth: 720,
            minHeight: 620,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#10161f',
            show: false,
            autoHideMenuBar: true,
            webPreferences: getSecureWebPreferences()
        });
        attachWindowNavigationGuards(this.reportWindow);
        this.attachManualHotkeys(this.reportWindow);
        this.reportWindow.on('close', (event: any) => {
            if (!this.isQuitting) {
                event.preventDefault();
                this.reportWindow?.hide();
            }
        });
        this.reportWindow.on('closed', () => {
            this.reportWindow = null;
        });
        void this.loadWindowPage(this.reportWindow, 'report');
        this.reportWindow.once('ready-to-show', () => {
            showWindowWhenReady(this.reportWindow, { afterShow: () => this.broadcastState() });
        });
    }

export function runCreateTray(this: any) {
        this.tray = new Tray(createAppIcon());
        this.tray.setToolTip(this.t('main.trayTooltip'));
        this.refreshTrayMenu();
        this.tray.on('double-click', () => {
            this.showOverlay();
        });
    }

export function runGetHotkeyTrayLabel(this: any) {
        const hotkeys = this.getConfiguredHotkeys();
        const segments: string[] = [];
        segments.push(`${hotkeys.toggleTimerPause} — ${this.t('main.hotkeysPause')}`);
        segments.push(`${hotkeys.openCompanion} — ${this.t('main.hotkeysCompanion')}`);
        segments.push(`${hotkeys.toggleOverlayMode} — ${this.t('main.hotkeysOverlayMode')}`);
        return `${this.t('main.hotkeysLabel')}: ${segments.join(', ')}`;
    }

export function runRefreshTrayMenu(this: any) {
        if (!this.tray) {
            return;
        }
        this.tray.setToolTip(this.t('main.trayTooltip'));
        const menu = Menu.buildFromTemplate([
            {
                label: this.t('main.trayShowOverlay'),
                click: () => this.showOverlay()
            },
            {
                label: this.t('main.trayHideOverlay'),
                click: () => this.overlayWindow?.hide()
            },
            {
                label: this.t('main.trayOpenCompanion'),
                click: () => this.openCompanionWindow()
            },
            {
                label: this.t('main.traySettings'),
                click: () => this.openSettingsWindow()
            },
            { type: 'separator' },
            {
                label: this.getHotkeyTrayLabel(),
                enabled: false
            },
            {
                label: this.t('main.trayQuit'),
                click: () => {
                    app.quit();
                }
            }
        ]);
        this.tray.setContextMenu(menu);
    }

export async function runAppendDevSampleLine(this: any) {
        const targetPath = this.config.logFilePath ?? this.runtime.watchedLogPath;
        if (!targetPath) {
            return;
        }
        await appendFile(targetPath, `${DEV_SAMPLE_ZONE_LINE}\r\n`, 'utf8');
        await this.refreshLogFileInfo(targetPath);
        await this.logWatcher.checkNow();
        this.broadcastState();
    }

export function runShowOverlayInactive(this: any) {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            return;
        }
        // Show without activating the window. The overlay remains focusable for mouse buttons
        // and fallback local hotkeys, but showInactive() keeps the game focused on show/expand.
        this.overlayWindow.setFocusable(true);
        this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        this.overlayWindow.showInactive();
        this.broadcastState();
    }

export function runShowOverlay(this: any) {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            this.createOverlayWindow();
            return;
        }
        this.showOverlayInactive();
    }

export function runSetOverlayMode(this: any, mode: any) {
        if (mode !== 'full' && mode !== 'timer_only') {
            return;
        }
        if (this.overlayMode === mode && this.runtime.overlayMode === mode) {
            return;
        }
        const previousOverlayMode = this.overlayMode;
        const previousOverlayDensity = this.config.overlayDensity;
        const previousOverlayBounds = this.overlayWindow && !this.overlayWindow.isDestroyed()
            ? this.overlayWindow.getBounds()
            : null;
        if (previousOverlayBounds) {
            if (this.overlayBoundsTimer) {
                clearTimeout(this.overlayBoundsTimer);
                this.overlayBoundsTimer = null;
            }
            this.persistOverlayBoundsForState(previousOverlayMode, previousOverlayDensity, previousOverlayBounds);
        }
        this.overlayMode = mode;
        this.runtime.overlayMode = mode;
        this.config = this.configStore.updateSettings({
            mainOverlaySettings: {
                overlayMode: mode
            }
        });
        if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
            const minimumSize = this.getOverlayMinimumSize(mode);
            const targetModeBounds = this.getOverlayBoundsForMode(mode);
            const nextBounds = previousOverlayBounds
                ? this.normalizeOverlayBoundsForMode({
                    ...targetModeBounds,
                    x: previousOverlayBounds.x,
                    y: previousOverlayBounds.y
                }, mode)
                : targetModeBounds;
            this.applyOverlayWindowBounds('modeSwitch', nextBounds, { minimumSize });
            this.overlayWindow.setFocusable(true);
            this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        this.broadcastState();
    }

export function runToggleOverlayMode(this: any) {
        if (this.overlayMode === 'timer_only') {
            if (this.config.overlayDensity === 'compact') {
                this.config = this.configStore.updateSettings({
                    overlayDensity: 'normal'
                });
            }
            this.setOverlayMode('full');
            return;
        }
        this.setOverlayMode('timer_only');
    }

export async function runLoadWindowPage(this: any, window: any, page: any) {
        const pageName = String(page);
        const pageSearch = `?page=${encodeURIComponent(pageName)}`;
        if (isDev) {
            try {
                await window.loadURL(`${devServerUrl}/${pageName}.html${pageSearch}`);
                if (this.config.realtimePriorityEnabled) {
                    this.scheduleRealtimePriorityApply(true);
                }
                return;
            }
            catch {
                // If Vite is not running, fall back to built files.
            }
        }
        await window.loadFile(resolveRuntimePath('dist', `${pageName}.html`), { search: pageSearch });
        if (this.config.realtimePriorityEnabled) {
            this.scheduleRealtimePriorityApply(true);
        }
    }

export function runGetStartupOverlayMode(this: any) {
        return this.config.mainOverlaySettings.overlayTimerOnlyMode
            ? 'timer_only'
            : this.config.mainOverlaySettings.overlayMode;
    }
