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


export function runClearMissedWarning(this: any) {
        this.runtime.missedWarningZoneRu = null;
        this.runtime.missedWarningItems = [];
    }

export function runSyncRuntimeZoneFields(this: any, rawZoneName: any, guide: any) {
        this.runtime.lastRawZoneName = rawZoneName;
        this.runtime.lastMatchedZoneEn = guide?.zone_en ?? null;
        this.runtime.lastMatchedZoneRu = guide?.zone_ru ?? null;
        this.runtime.lastMatchedGuideId = guide?.id ?? null;
    }

export function runUpdateZoneProgress(this: any, guide: any) {
        if (!guide) {
            return;
        }
        const currentProgress = this.getZoneProgress(guide.id);
        this.config = this.configStore.update({
            zoneProgress: {
                ...this.config.zoneProgress,
                [guide.id]: {
                    ...currentProgress,
                    lastVisitedAt: new Date().toISOString()
                }
            }
        });
    }

export function runGetZoneProgress(this: any, zoneId: any) {
        return (this.config.zoneProgress[zoneId] ?? {
            itemStates: {},
            likelyDoneKeywords: [],
            lastVisitedAt: null
        });
    }

export function runMergeLikelyDoneKeywords(this: any, guide: any, matchedKeywords: any) {
        const currentProgress = this.getZoneProgress(guide.id);
        const mergedKeywords = [
            ...new Set([
                ...currentProgress.likelyDoneKeywords,
                ...matchedKeywords
            ])
        ];
        const hasChanges = mergedKeywords.length !== currentProgress.likelyDoneKeywords.length ||
            mergedKeywords.some((keyword: any, index: any) => keyword !== currentProgress.likelyDoneKeywords[index]);
        if (!hasChanges) {
            return false;
        }
        this.config = this.configStore.update({
            zoneProgress: {
                ...this.config.zoneProgress,
                [guide.id]: {
                    ...currentProgress,
                    likelyDoneKeywords: mergedKeywords,
                    lastVisitedAt: currentProgress.lastVisitedAt ?? new Date().toISOString()
                }
            }
        });
        this.broadcastState();
        return true;
    }

export function runMarkCurrentChecklistItemDone(this: any) {
        // Manual checklist completion disabled. Items are reminders only.
    }

export function runUndoLastChecklistMark(this: any) {
        // Manual checklist completion disabled. Nothing to undo.
    }

export function runSetLogStatus(this: any, status: any, message: any) {
        this.runtime.logWatcherStatus = status;
        this.runtime.logWatcherMessage = message;
        this.scheduleLogFileInfoRefresh();
        this.broadcastState();
    }

export function runGetSnapshot(this: any) {
        const currentGuideEntry = this.currentZone.guide;
        const currentZoneProgress = currentGuideEntry
            ? this.getZoneProgress(currentGuideEntry.id)
            : null;
        return {
            config: this.config,
            currentZone: this.currentZone,
            currentGuideEntry,
            currentZoneProgress,
            currentChecklist: buildChecklistViewItems(currentGuideEntry, currentZoneProgress ?? undefined),
            guideEntries: this.guideService.getAll(),
            vendorCheckpoints: this.guideService.getVendorCheckpoints(),
            powerSpikes: this.guideService.getPowerSpikes(),
            campaignBonuses: this.campaignBonuses,
            activeLevelReminder: this.getActiveLevelReminder(),
            runtime: {
                ...this.runtime,
                timerNowMs: Date.now()
            }
        };
    }

export function runClearBroadcastTimer(this: any) {
        if (this.broadcastTimer) {
            clearTimeout(this.broadcastTimer);
            this.broadcastTimer = null;
        }
    }

export function runFlushBroadcastState(this: any) {
        this.broadcastTimer = null;
        const snapshot = this.pendingSnapshot ?? this.getSnapshot();
        this.pendingSnapshot = null;
        for (const win of [this.overlayWindow, this.settingsWindow, this.companionWindow, this.infoWindow, this.communityWindow, this.supportWindow]) {
            if (win && !win.isDestroyed()) {
                win.webContents.send('app:state-changed', snapshot);
            }
        }
    }

export function runBroadcastState(this: any) {
        // Build snapshots lazily in flushBroadcastState(). Creating a full snapshot is
        // relatively expensive (guide lists, checklist view, bonuses). During combat
        // and area loading the log watcher can request several broadcasts in a short
        // burst; doing getSnapshot() for each request was enough to make the overlay
        // feel frozen. The flush always reads the latest app state, so no data is lost.
        this.pendingSnapshot = null;
        if (this.broadcastTimer) {
            return;
        }
        this.broadcastTimer = setTimeout(() => {
            this.flushBroadcastState();
        }, BROADCAST_THROTTLE_MS);
    }
