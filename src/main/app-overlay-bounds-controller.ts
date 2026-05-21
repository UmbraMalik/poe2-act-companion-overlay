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
import { diagnosticInfo, diagnosticWarn } from './diagnostic-logger';


export function runLogOverlayBoundsEvent(this: any, level: any, payload: any) {
        if (level === 'warn') {
            diagnosticWarn('OverlayBounds', 'Bounds event', payload);
            return;
        }
        diagnosticInfo('OverlayBounds', 'Bounds event', payload);
    }

export function runGetOverlayBoundsSourceHint(this: any) {
        if (!this.overlayBoundsSourceHint) {
            return null;
        }
        if (Date.now() > this.overlayBoundsSourceHint.expiresAt) {
            this.overlayBoundsSourceHint = null;
            return null;
        }
        return this.overlayBoundsSourceHint;
    }

export function runSetOverlayBoundsSourceHint(this: any, source: any, applyMode: any) {
        this.overlayBoundsSourceHint = {
            source,
            applyMode,
            expiresAt: Date.now() + 250
        };
    }

export function runApplyOverlayWindowBounds(this: any, source: any, requestedBounds: any, options: any = {}) {
        const targetWindow = this.overlayWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return null;
        }
        const plan = planOverlayBoundsChange({
            source,
            currentBounds: targetWindow.getBounds(),
            requestedBounds
        });
        const shouldHintWindowEvent = Boolean(options.minimumSize) || plan.applyMode !== 'none';
        if (shouldHintWindowEvent) {
            this.setOverlayBoundsSourceHint(source, plan.applyMode === 'none' ? 'setBounds' : plan.applyMode);
        }
        if (options.minimumSize) {
            targetWindow.setMinimumSize(options.minimumSize.width, options.minimumSize.height);
        }
        this.logOverlayBoundsEvent(plan.suspiciousSizeChange ? 'warn' : 'info', {
            phase: 'request',
            source,
            applyMode: plan.applyMode,
            from: plan.currentBounds,
            requested: plan.requestedBounds,
            to: plan.nextBounds
        });
        if (plan.applyMode === 'none') {
            this.lastOverlayKnownBounds = plan.currentBounds;
            return plan.currentBounds;
        }
        if (plan.applyMode === 'setPosition') {
            targetWindow.setPosition(plan.nextBounds.x, plan.nextBounds.y);
            return plan.nextBounds;
        }
        targetWindow.setBounds(plan.nextBounds);
        return plan.nextBounds;
    }

export function runHandleOverlayWindowBoundsEvent(this: any, eventName: any) {
        const targetWindow = this.overlayWindow;
        if (!targetWindow || targetWindow.isDestroyed()) {
            return;
        }
        const nextBounds = targetWindow.getBounds();
        const previousBounds = this.lastOverlayKnownBounds ?? nextBounds;
        if (areOverlayBoundsEqual(previousBounds, nextBounds)) {
            this.lastOverlayKnownBounds = nextBounds;
            return;
        }
        const hint = this.getOverlayBoundsSourceHint();
        let source = hint?.source ?? 'unknown';
        const sizeChanged = !areOverlayBoundsSizeEqual(previousBounds, nextBounds);
        if ((eventName === 'resize' && source === 'dragMove' && hint?.applyMode === 'setPosition') ||
            (sizeChanged && source === 'dragMove')) {
            source = 'unknown';
        }
        const suspiciousSizeChange = sizeChanged && !canSourceChangeOverlaySize(source as any);
        this.logOverlayBoundsEvent(suspiciousSizeChange ? 'warn' : 'info', {
            phase: 'window-event',
            eventName,
            source,
            hintSource: hint?.source ?? null,
            hintApplyMode: hint?.applyMode ?? null,
            from: previousBounds,
            to: nextBounds
        });
        this.lastOverlayKnownBounds = nextBounds;
        if (this.overlayDragInProgress &&
            this.overlayDragBounds &&
            !areOverlayBoundsSizeEqual(nextBounds, this.overlayDragBounds)) {
            const correctedBounds = {
                x: nextBounds.x,
                y: nextBounds.y,
                width: this.overlayDragBounds.width,
                height: this.overlayDragBounds.height
            };
            this.logOverlayBoundsEvent('warn', {
                phase: 'drag-size-correction',
                source: 'unknown',
                from: nextBounds,
                to: correctedBounds
            });
            this.applyOverlayWindowBounds('unknown', correctedBounds);
        }
    }

export function runGetOverlayMinimumSize(this: any, mode: any, density: any = this.config.overlayDensity, scale: any = this.config.overlayScale) {
        return getOverlayMinimumSize(mode, density, scale);
    }

export function runGetOverlayMaximumOffscreenX(this: any, width: any) {
        return Math.min(120, Math.round(width * 0.35));
    }

export function runGetOverlayMinimumVisibleWidth(this: any, width: any) {
        return Math.min(width, Math.max(120, Math.min(160, Math.round(width * 0.4))));
    }

export function runGetOverlayMinimumVisibleHeight(this: any, height: any) {
        return Math.min(height, 120);
    }

export function runGetOverlayScaledDefaultBounds(this: any, mode: any, density: any = this.config.overlayDensity) {
        const minimumSize = this.getOverlayMinimumSize(mode, density);
        if (mode === 'timer_only') {
            return {
                width: Math.max(minimumSize.width, Math.round((DEFAULT_TIMER_ONLY_OVERLAY_BOUNDS.width * this.config.overlayScale) / 100)),
                height: Math.max(minimumSize.height, Math.round((DEFAULT_TIMER_ONLY_OVERLAY_BOUNDS.height * this.config.overlayScale) / 100))
            };
        }
        if (density === 'compact') {
            return {
                width: Math.max(minimumSize.width, Math.round((DEFAULT_COMPACT_OVERLAY_BOUNDS.width * this.config.overlayScale) / 100)),
                height: Math.max(minimumSize.height, Math.round((DEFAULT_COMPACT_OVERLAY_BOUNDS.height * this.config.overlayScale) / 100))
            };
        }
        return {
            width: Math.max(minimumSize.width, Math.round((DEFAULT_OVERLAY_BOUNDS.width * this.config.overlayScale) / 100)),
            height: Math.max(minimumSize.height, Math.round((DEFAULT_OVERLAY_BOUNDS.height * this.config.overlayScale) / 100))
        };
    }

export function runGetOverlayVirtualWorkArea(this: any) {
        const displays = screen.getAllDisplays();
        if (displays.length === 0) {
            return screen.getPrimaryDisplay().workArea;
        }
        const left = Math.min(...displays.map((display: any) => display.workArea.x));
        const top = Math.min(...displays.map((display: any) => display.workArea.y));
        const right = Math.max(...displays.map((display: any) => display.workArea.x + display.workArea.width));
        const bottom = Math.max(...displays.map((display: any) => display.workArea.y + display.workArea.height));
        return {
            x: left,
            y: top,
            width: right - left,
            height: bottom - top
        };
    }

export function runNormalizeOverlayBoundsForMode(this: any, bounds: any, mode: any, density: any = this.config.overlayDensity) {
        const minimumSize = this.getOverlayMinimumSize(mode, density);
        const roundedBounds = {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y),
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
        };
        const display = screen.getDisplayMatching(roundedBounds);
        const area = display.workArea;
        const virtualArea = this.getOverlayVirtualWorkArea();
        const width = Math.min(Math.max(minimumSize.width, area.width), Math.max(minimumSize.width, roundedBounds.width));
        const displayMaximumHeight = Math.max(minimumSize.height, area.height - 16);
        const modeDefaultSize = this.getOverlayScaledDefaultBounds(mode, density);
        const modeMaximumHeight = mode === 'timer_only'
            // Timer-only is content-driven and has no vertical user resize. If a stale
            // full/compact height ever gets saved here, the timer opens as a tall empty
            // panel and the next expand looks like the renderer has frozen. Keep enough
            // room for wrapped RU/EN text, but never restore a full overlay height.
            ? Math.min(displayMaximumHeight, Math.max(minimumSize.height, modeDefaultSize.height + 120))
            : displayMaximumHeight;
        const height = Math.min(modeMaximumHeight, Math.max(minimumSize.height, roundedBounds.height));
        const minVisibleWidth = this.getOverlayMinimumVisibleWidth(width);
        const minVisibleHeight = this.getOverlayMinimumVisibleHeight(height);
        const minX = virtualArea.x - this.getOverlayMaximumOffscreenX(width);
        const maxX = virtualArea.x + virtualArea.width - minVisibleWidth;
        const minY = virtualArea.y;
        const maxY = virtualArea.y + virtualArea.height - minVisibleHeight;
        return {
            x: Math.min(Math.max(roundedBounds.x, minX), Math.max(minX, maxX)),
            y: Math.min(Math.max(roundedBounds.y, minY), Math.max(minY, maxY)),
            width,
            height
        };
    }

export function runIsBoundsVisible(this: any, bounds: any) {
        return screen.getAllDisplays().some((display: any) => {
            const area = display.workArea;
            const intersectionWidth = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
            const intersectionHeight = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
            return (intersectionWidth >= this.getOverlayMinimumVisibleWidth(bounds.width) &&
                intersectionHeight >= this.getOverlayMinimumVisibleHeight(bounds.height));
        });
    }

export function runGetFullOverlayFallbackBounds(this: any) {
        const fallbackDisplay = screen.getPrimaryDisplay();
        const fallbackWorkArea = fallbackDisplay.workArea;
        const defaultBounds = this.getOverlayScaledDefaultBounds('full', 'normal');
        return {
            x: fallbackWorkArea.x + Math.max(20, fallbackWorkArea.width - defaultBounds.width - 40),
            y: fallbackWorkArea.y + 80,
            width: defaultBounds.width,
            height: defaultBounds.height
        };
    }

export function runGetTimerOnlyOverlayFallbackBounds(this: any) {
        const baseBounds = this.config.overlayBounds ?? this.getFullOverlayFallbackBounds();
        const defaultBounds = this.getOverlayScaledDefaultBounds('timer_only');
        return {
            x: baseBounds.x,
            y: baseBounds.y,
            width: Math.max(this.getOverlayMinimumSize('timer_only').width, Math.min(baseBounds.width, defaultBounds.width)),
            height: defaultBounds.height
        };
    }

export function runGetCompactOverlayFallbackBounds(this: any) {
        const baseBounds = this.config.overlayBounds ?? this.getFullOverlayFallbackBounds();
        const defaultBounds = this.getOverlayScaledDefaultBounds('full', 'compact');
        return {
            x: baseBounds.x,
            y: baseBounds.y,
            width: Math.max(this.getOverlayMinimumSize('full', 'compact').width, Math.min(baseBounds.width, defaultBounds.width)),
            height: Math.max(this.getOverlayMinimumSize('full', 'compact').height, Math.min(baseBounds.height, defaultBounds.height))
        };
    }

export function runGetSavedOverlayBoundsForState(this: any, mode: any, density: any = this.config.overlayDensity) {
        if (mode === 'timer_only') {
            return this.config.overlayTimerOnlyBounds;
        }
        if (density === 'compact') {
            return this.config.overlayCompactBounds;
        }
        return this.config.overlayBounds;
    }

export function runGetFallbackOverlayBoundsForState(this: any, mode: any, density: any = this.config.overlayDensity) {
        if (mode === 'timer_only') {
            return this.getTimerOnlyOverlayFallbackBounds();
        }
        if (density === 'compact') {
            return this.getCompactOverlayFallbackBounds();
        }
        return this.getFullOverlayFallbackBounds();
    }

export function runGetOverlayBoundsForMode(this: any, mode: any, density: any = this.config.overlayDensity) {
        const saved = this.getSavedOverlayBoundsForState(mode, density);
        const fallbackBounds = this.getFallbackOverlayBoundsForState(mode, density);
        if (!saved || !this.isBoundsVisible(saved)) {
            return this.normalizeOverlayBoundsForMode(fallbackBounds, mode, density);
        }
        return this.normalizeOverlayBoundsForMode({
            x: saved.x,
            y: saved.y,
            width: saved.width,
            height: saved.height
        }, mode, density);
    }

export function runGetCompanionBounds(this: any) {
        const fallbackDisplay = screen.getPrimaryDisplay();
        const fallbackWorkArea = fallbackDisplay.workArea;
        const fallbackBounds = {
            x: Math.max(0, fallbackWorkArea.x + Math.floor((fallbackWorkArea.width - DEFAULT_COMPANION_BOUNDS.width) / 2)),
            y: Math.max(20, fallbackWorkArea.y + 60),
            width: DEFAULT_COMPANION_BOUNDS.width,
            height: DEFAULT_COMPANION_BOUNDS.height
        };
        const saved = this.config.companionBounds;
        if (!saved) {
            return fallbackBounds;
        }
        const visibleOnSomeDisplay = screen.getAllDisplays().some((display: any) => {
            const area = display.workArea;
            return (saved.x < area.x + area.width - 80 &&
                saved.x + saved.width > area.x + 80 &&
                saved.y < area.y + area.height - 80 &&
                saved.y + saved.height > area.y + 80);
        });
        if (!visibleOnSomeDisplay) {
            return fallbackBounds;
        }
        return {
            x: saved.x,
            y: saved.y,
            width: Math.max(720, saved.width),
            height: Math.max(520, saved.height)
        };
    }

export function runPersistOverlayBoundsForState(this: any, mode: any, density: any, bounds: any) {
        const normalizedBounds = this.normalizeOverlayBoundsForMode(bounds, mode, density);
        if (mode === 'timer_only') {
            this.config = this.configStore.setOverlayTimerOnlyBounds(normalizedBounds);
            return;
        }
        this.config = density === 'compact'
            ? this.configStore.setOverlayCompactBounds(normalizedBounds)
            : this.configStore.setOverlayBounds(normalizedBounds);
    }

export function runPersistOverlayBoundsForCurrentState(this: any, bounds: any) {
        this.persistOverlayBoundsForState(this.overlayMode, this.config.overlayDensity, bounds);
    }

export function runPersistOverlayBoundsImmediately(this: any) {
        if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
            return;
        }
        if (this.overlayBoundsTimer) {
            clearTimeout(this.overlayBoundsTimer);
            this.overlayBoundsTimer = null;
        }
        this.persistOverlayBoundsForCurrentState(this.overlayWindow.getBounds());
    }

export function runPersistOverlayBounds(this: any) {
        if (!this.overlayWindow) {
            return;
        }
        if (this.overlayBoundsTimer) {
            clearTimeout(this.overlayBoundsTimer);
        }
        this.overlayBoundsTimer = setTimeout(() => {
            if (!this.overlayWindow || this.overlayWindow.isDestroyed()) {
                return;
            }
            const bounds = this.overlayWindow.getBounds();
            this.persistOverlayBoundsForCurrentState(bounds);
            this.broadcastState();
        }, 350);
    }

export function runPersistCompanionBounds(this: any) {
        if (!this.companionWindow) {
            return;
        }
        if (this.companionBoundsTimer) {
            clearTimeout(this.companionBoundsTimer);
        }
        this.companionBoundsTimer = setTimeout(() => {
            if (!this.companionWindow || this.companionWindow.isDestroyed()) {
                return;
            }
            const bounds = this.companionWindow.getBounds();
            this.config = this.configStore.setCompanionBounds(bounds);
            this.broadcastState();
        }, 350);
    }
