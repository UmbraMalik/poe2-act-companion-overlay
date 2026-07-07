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
import { ENDGAME_T15_ACT, getRunTimerDisplayElapsed, getZoneTimerDisplayElapsed } from '../shared/timers';
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
  inferActHintFromTownScene,
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


export function runGetRunTimerDisplayElapsedMs(this: any, now: any = Date.now()) {
        return getRunTimerDisplayElapsed(this.config.runTimer, now);
    }

export function runGetCurrentZoneElapsedMs(this: any, now: any = Date.now()) {
        return getZoneTimerDisplayElapsed(this.config.runTimer, now);
    }

// Town timer is intentionally disabled; keep these legacy getters at zero for
// older renderer/config surfaces without reintroducing separate town tracking.
export function runGetCurrentTownElapsedMs(this: any, _now: any = Date.now()) {
        return 0;
    }

export function runGetTotalTownElapsedMs(this: any, _now: any = Date.now()) {
        return 0;
    }

export function runGetCurrentTimerAct(this: any) {
        return this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
    }

export function runGetCurrentActElapsedForDiagnostics(this: any, now: any = Date.now(), currentAct: any = this.getCurrentTimerAct()) {
        if (typeof currentAct !== 'number') {
            return null;
        }
        const runTimer = this.config.runTimer;
        const sortedSplits = [...runTimer.actSplits]
            .filter((split: any) => Number.isFinite(split.act) &&
            Number.isFinite(split.elapsedMs) &&
            Number.isFinite(split.timestamp))
            .sort((left: any, right: any) => left.act - right.act || left.timestamp - right.timestamp);
        let previousTotalElapsedMs = 0;
        for (const split of sortedSplits) {
            const safeTotalElapsedMs = Math.max(previousTotalElapsedMs, split.elapsedMs);
            if (split.act === currentAct) {
                return Math.max(0, safeTotalElapsedMs - previousTotalElapsedMs);
            }
            previousTotalElapsedMs = safeTotalElapsedMs;
        }
        const highestRecordedAct = sortedSplits[sortedSplits.length - 1]?.act ?? 0;
        if ((runTimer.status === 'running' || runTimer.status === 'paused' || runTimer.status === 'finished') &&
            currentAct > highestRecordedAct &&
            !sortedSplits.some((split: any) => split.act === currentAct)) {
            const safeTotalElapsedMs = Math.max(previousTotalElapsedMs, this.getRunTimerDisplayElapsedMs(now));
            return Math.max(0, safeTotalElapsedMs - previousTotalElapsedMs);
        }
        return null;
    }

export function runBuildTimerDiagnosticsRecord(this: any, payload: any) {
        const now = Date.now();
        const runTimer = this.config.runTimer;
        const currentAct = payload.act ?? this.getCurrentTimerAct();
        return {
            timestamp: new Date(now).toISOString(),
            event: payload.event,
            source: payload.source,
            overlayMode: payload.overlayMode ?? this.runtime.overlayMode ?? this.overlayMode ?? null,
            zoneName: payload.zoneName ?? this.currentZone.guide?.zone_ru ?? this.currentZone.rawZoneName ?? this.runtime.lastGameplayZoneRu ?? null,
            act: currentAct,
            isRunning: payload.isRunning ?? runTimer.status === 'running',
            isPaused: payload.isPaused ?? runTimer.status === 'paused',
            totalElapsedMs: payload.totalElapsedMs ?? this.getRunTimerDisplayElapsedMs(now),
            actElapsedMs: payload.actElapsedMs ?? this.getCurrentActElapsedForDiagnostics(now, currentAct),
            expectedTickMs: payload.expectedTickMs ?? null,
            actualTickMs: payload.actualTickMs ?? null,
            tickDelayMs: payload.tickDelayMs ?? null,
            lastRenderedElapsedMs: payload.lastRenderedElapsedMs ?? null,
            currentElapsedMs: payload.currentElapsedMs ?? null,
            displayDeltaMs: payload.displayDeltaMs ?? null,
            wallClockDeltaMs: payload.wallClockDeltaMs ?? null,
            previousDisplayedText: payload.previousDisplayedText ?? null,
            nextDisplayedText: payload.nextDisplayedText ?? null,
            previousDisplayedElapsedMs: payload.previousDisplayedElapsedMs ?? null,
            nextDisplayedElapsedMs: payload.nextDisplayedElapsedMs ?? null,
            timerStatus: payload.timerStatus ?? runTimer.status,
            previousStatus: payload.previousStatus ?? null,
            nextStatus: payload.nextStatus ?? null,
            note: payload.note ?? null,
            component: payload.component ?? null,
            renderSource: payload.renderSource ?? null,
            renderReason: payload.renderReason ?? null,
            renderDelayMs: payload.renderDelayMs ?? null,
            snapshotAgeMs: payload.snapshotAgeMs ?? null,
            snapshotReceivedCount: payload.snapshotReceivedCount ?? null,
            snapshotCommitCount: payload.snapshotCommitCount ?? null,
            renderCommitCount: payload.renderCommitCount ?? null,
            rendererVisualTickCount: payload.rendererVisualTickCount ?? null,
            lastSnapshotReceivedAtMs: payload.lastSnapshotReceivedAtMs ?? null,
            lastSnapshotCommittedAtMs: payload.lastSnapshotCommittedAtMs ?? null,
            lastRenderCommittedAtMs: payload.lastRenderCommittedAtMs ?? null,
            documentHidden: payload.documentHidden ?? null,
            visibilityState: payload.visibilityState ?? null
        };
    }

export function runLogTimerDiagnostics(this: any, event: any, payload: any = {}) {
        if (!this.timerDiagnosticsLog.isEnabled()) {
            return;
        }
        void this.timerDiagnosticsLog.write(this.buildTimerDiagnosticsRecord({
            ...payload,
            event
        }));
    }

const GENERATED_AREA_LEVEL_REGEX = /Generating level\s+(?<level>\d+)\s+area\b/i;
const T15_MAP_AREA_LEVEL = 79;
const MAX_RUN_TIMER_START_TIMEOUT_MS = 2_147_483_647;

function getGeneratedAreaLevel(line: unknown): number | null {
        const match = String(line ?? '').match(GENERATED_AREA_LEVEL_REGEX);
        const level = Number(match?.groups?.level);
        return Number.isFinite(level) ? level : null;
    }

export function runProcessRunTimerActivityFromLogLine(this: any, line: any, source: any) {
        if (source === 'append') {
            this.completeEndgameT15Run(line);
        }
        const nowIso = new Date().toISOString();
        const zoneMatch = this.extractZoneMatchFromLogLine(line);
        if (!zoneMatch) {
            return;
        }
        const rawSceneSource = zoneMatch.rawZoneName;
        this.runtime.lastSceneSource = rawSceneSource;
        this.runtime.lastSceneSourceAt = nowIso;
        const matchedGuide = zoneMatch.guide;
        this.runtime.lastMatcherReason = zoneMatch.matcherReason;
        const ignoredReason = this.getIgnoredZoneEventReason(zoneMatch);
        if (source === 'bootstrap') {
            if (this.isTownSceneWithGuide(rawSceneSource, matchedGuide)) {
                const matchedTownGuide = rawSceneSource ? this.guideService.findByZoneName(rawSceneSource) : null;
                const townActHint = inferActHintFromTownScene(rawSceneSource);
                const shouldClearGuide = townActHint === ENDGAME_T15_ACT ||
                    this.normalizeSceneSource(rawSceneSource) === 'clearfell encampment';
                const nextTownGuide = matchedTownGuide ??
                    (shouldClearGuide ? null : this.currentZone.guide);
                this.currentZone = {
                    rawZoneName: rawSceneSource,
                    guide: nextTownGuide,
                    sceneKind: 'town',
                    actHint: townActHint ?? nextTownGuide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null
                };
                if (typeof townActHint === 'number') {
                    this.runtime.lastGameplayAct = townActHint;
                }
                this.syncRuntimeZoneFields(rawSceneSource, this.currentZone.guide);
                this.logZoneEventDecision(zoneMatch, 'updated');
            }
            else if (this.isValidGameplaySceneSource(rawSceneSource, matchedGuide)) {
                if (ignoredReason) {
                    this.logZoneEventDecision(zoneMatch, 'ignored', ignoredReason);
                    return;
                }
                this.currentZone = {
                    rawZoneName: rawSceneSource,
                    guide: matchedGuide,
                    sceneKind: matchedGuide ? 'gameplay' : 'unknown',
                    actHint: matchedGuide?.act ?? this.getZoneMatchActHint(zoneMatch) ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null
                };
                if (matchedGuide) {
                    this.runtime.lastGameplayGuideId = matchedGuide.id;
                    this.runtime.lastGameplayZoneRu = matchedGuide.zone_ru;
                    this.runtime.lastGameplayAct = typeof matchedGuide.act === 'number' ? matchedGuide.act : null;
                    this.runtime.lastValidGameplayZoneAt = nowIso;
                }
                this.syncRuntimeZoneFields(rawSceneSource, matchedGuide);
                this.logZoneEventDecision(zoneMatch, 'updated');
            }
            else if (this.isLoginLikeScene(rawSceneSource)) {
                this.setSceneWithoutGuide(rawSceneSource, 'log', 'login');
                this.logZoneEventDecision(zoneMatch, 'updated');
            }
            else if (this.isUnknownOrNullScene(rawSceneSource) || this.isActLabelScene(rawSceneSource)) {
                this.setSceneWithoutGuide(rawSceneSource, 'log', 'inactive');
                this.logZoneEventDecision(zoneMatch, 'updated');
            }
            else {
                this.setSceneWithoutGuide(rawSceneSource, 'log', 'unknown', this.getZoneMatchActHint(zoneMatch));
                this.logZoneEventDecision(zoneMatch, 'updated');
            }
            return;
        }
        if (this.isTownSceneWithGuide(rawSceneSource, matchedGuide)) {
            this.setTownScene(rawSceneSource ?? 'Город', 'log');
            this.logZoneEventDecision(zoneMatch, 'updated');
            return;
        }
        if (this.isValidGameplaySceneSource(rawSceneSource, matchedGuide)) {
            if (ignoredReason) {
                this.logZoneEventDecision(zoneMatch, 'ignored', ignoredReason);
                return;
            }
            this.runtime.lastValidGameplayZoneAt = nowIso;
            this.setCurrentZone(rawSceneSource ?? '', 'log', matchedGuide, this.getZoneMatchActHint(zoneMatch));
            this.logZoneEventDecision(zoneMatch, 'updated');
            return;
        }
        if (this.isLoginLikeScene(rawSceneSource)) {
            this.setSceneWithoutGuide(rawSceneSource, 'log', 'login');
            this.logZoneEventDecision(zoneMatch, 'updated');
            return;
        }
        if (this.isUnknownOrNullScene(rawSceneSource)) {
            this.setSceneWithoutGuide(rawSceneSource, 'log', 'inactive');
            this.logZoneEventDecision(zoneMatch, 'updated');
            return;
        }
        if (this.isActLabelScene(rawSceneSource)) {
            this.setSceneWithoutGuide(rawSceneSource, 'log', 'inactive');
            this.logZoneEventDecision(zoneMatch, 'updated');
            return;
        }
        this.setSceneWithoutGuide(rawSceneSource, 'log', 'unknown', this.getZoneMatchActHint(zoneMatch));
        this.logZoneEventDecision(zoneMatch, 'updated');
    }

export function runIsEndgameT15CompletionLogLine(this: any, line: any) {
        const generatedAreaLevel = getGeneratedAreaLevel(line);

        if (generatedAreaLevel === null || generatedAreaLevel < T15_MAP_AREA_LEVEL) {
            return false;
        }

        const runTimer = this.config.runTimer;
        const timerCanComplete = runTimer.status === 'running' || runTimer.status === 'paused';
        if (!timerCanComplete) {
            return false;
        }

        return this.currentZone.actHint === ENDGAME_T15_ACT ||
            this.runtime.lastGameplayAct === ENDGAME_T15_ACT ||
            runTimer.actSplits.some((split: any) => split.act === 5);
    }

export function runCompleteEndgameT15Run(this: any, line: any) {
        if (!this.isEndgameT15CompletionLogLine(line)) {
            return false;
        }

        const now = Date.now();
        const previousActHint = this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        if (previousActHint !== ENDGAME_T15_ACT) {
            this.currentZone = {
                ...this.currentZone,
                actHint: ENDGAME_T15_ACT
            };
            this.runtime.lastGameplayAct = ENDGAME_T15_ACT;
            this.recordActTransitionByHint(previousActHint, ENDGAME_T15_ACT, now);
        }

        this.finishRunTimer();

        if (this.config.runTimer.status !== 'finished') {
            return false;
        }

        const finishedAt = this.config.runTimer.finishedAt ?? now;
        const totalElapsedMs = this.config.runTimer.elapsedMs;
        const savedLabelLocale = this.config.appLanguage === 'en' ? 'en-US' : 'ru-RU';
        const savedLabel = `${this.t('route.endgameToT15')} · ${new Date(finishedAt).toLocaleString(savedLabelLocale)}`;
        this.saveCurrentRunToHistory(savedLabel);
        this.runtime.endgameT15CompletionNotice = {
            completedAt: new Date(finishedAt).toISOString(),
            totalElapsedMs,
            savedLabel
        };
        this.logTimerDiagnostics('timer-finish', {
            source: 'main.endgame-t15-auto-finish',
            previousStatus: 'running',
            nextStatus: 'finished',
            totalElapsedMs,
            act: ENDGAME_T15_ACT,
            note: 'entered-level-79-area'
        });
        this.refreshTrayMenu();
        this.broadcastState();
        return true;
    }

export function runClearRunTimerStartTimer(this: any) {
        if (this.runTimerStartTimer) {
            clearTimeout(this.runTimerStartTimer);
            this.runTimerStartTimer = null;
        }
    }

export function runPersistRunTimer(this: any, nextRunTimer: any, diagnosticsPayload: any = null) {
        const previousRunTimer = this.config.runTimer;
        this.config = this.configStore.update({
            runTimer: nextRunTimer
        });
        if (diagnosticsPayload?.event) {
            this.logTimerDiagnostics(diagnosticsPayload.event, {
                ...diagnosticsPayload,
                previousStatus: diagnosticsPayload.previousStatus ?? previousRunTimer.status,
                nextStatus: diagnosticsPayload.nextStatus ?? nextRunTimer.status
            });
        }
        else if (previousRunTimer.status !== nextRunTimer.status) {
            this.logTimerDiagnostics('timer-unexpected-state', {
                source: diagnosticsPayload?.source ?? 'main.persist',
                previousStatus: previousRunTimer.status,
                nextStatus: nextRunTimer.status,
                note: diagnosticsPayload?.note ?? 'status-changed-without-explicit-diagnostics-event'
            });
        }
        this.emitRunTimerState();
    }

export function runScheduleRunTimerAutoStart(this: any) {
        this.clearRunTimerStartTimer();
        const { runTimer, runTimerSettings: settings } = this.config;
        if (runTimer.status !== 'armed' ||
            settings.autoStartMode !== 'scheduled_time' ||
            !settings.autoStart ||
            !settings.leagueStartAt) {
            return;
        }
        const delayMs = settings.leagueStartAt - Date.now();
        if (delayMs <= 0) {
            this.startRunTimerFromAnchor(settings.leagueStartAt, 'main.scheduled-start-immediate');
            return;
        }
        this.runTimerStartTimer = setTimeout(() => {
            this.runTimerStartTimer = null;
            const { runTimer: latestRunTimer, runTimerSettings: latestSettings } = this.config;
            if (latestRunTimer.status !== 'armed' ||
                latestSettings.autoStartMode !== 'scheduled_time' ||
                !latestSettings.autoStart ||
                !latestSettings.leagueStartAt) {
                return;
            }
            if (Date.now() < latestSettings.leagueStartAt) {
                this.scheduleRunTimerAutoStart();
                return;
            }
            this.startRunTimerFromAnchor(latestSettings.leagueStartAt, 'main.scheduled-start-timeout');
        }, Math.min(delayMs, MAX_RUN_TIMER_START_TIMEOUT_MS));
    }

export function runReconcileRunTimerState(this: any) {
        this.clearRunTimerStartTimer();
        const { runTimer, runTimerSettings: settings } = this.config;
        if (runTimer.status === 'running' ||
            runTimer.status === 'paused' ||
            runTimer.status === 'finished') {
            return;
        }
        if (!settings.autoStart ||
            settings.autoStartMode !== 'scheduled_time' ||
            !settings.leagueStartAt) {
            if (runTimer.status === 'armed') {
                this.persistRunTimer({
                    ...DEFAULT_RUN_TIMER
                }, {
                    source: 'main.reconcile',
                    note: 'cleared-stale-armed-state'
                });
            }
            return;
        }
        const now = Date.now();
        if (runTimer.status === 'armed' && now >= settings.leagueStartAt) {
            this.startRunTimerFromAnchor(settings.leagueStartAt, 'main.reconcile-auto-start');
            return;
        }
        if (settings.leagueStartAt > now) {
            this.armRunTimer(false);
        }
    }

export function runArmRunTimer(this: any, shouldBroadcast: any = true) {
        const settings = this.config.runTimerSettings;
        if (settings.autoStartMode !== 'scheduled_time' ||
            !settings.leagueStartAt) {
            return;
        }
        const now = Date.now();
        if (settings.leagueStartAt <= now) {
            this.startRunTimerFromAnchor(settings.leagueStartAt, 'main.arm-immediate-start');
            return;
        }
        this.persistRunTimer({
            ...DEFAULT_RUN_TIMER,
            status: 'armed'
        }, {
            event: 'timer-arm',
            source: 'main.arm-run-timer',
            note: `league-start-at:${settings.leagueStartAt}`
        });
        this.scheduleRunTimerAutoStart();
        this.refreshTrayMenu();
        if (shouldBroadcast) {
            this.broadcastState();
        }
    }

export function runStartRunTimerFromAnchor(this: any, startedAt: any, source: any = 'main.start-run-timer') {
        const now = Date.now();
        const previousStatus = this.config.runTimer.status;
        this.clearRunTimerStartTimer();
        this.runtime.endgameT15CompletionNotice = null;
        const nextTownTimer = { ...DEFAULT_TOWN_TIMER };
        this.config = this.configStore.update({
            zoneTimeHistory: [],
            lastRunSummary: null,
            townTimer: nextTownTimer,
            runTimer: {
                status: 'running',
                elapsedMs: Math.max(0, now - startedAt),
                startedAt,
                resumedAt: now,
                pausedAt: null,
                finishedAt: null,
                lastZoneEnteredAt: this.currentZone.sceneKind === 'gameplay' && this.currentZone.guide
                    ? startedAt
                    : null,
                currentZoneElapsedMs: 0,
                currentZoneStartedAt: this.currentZone.sceneKind === 'gameplay' && this.currentZone.guide
                    ? startedAt
                    : null,
                pauseReason: null,
                pauseCount: 0,
                actSplits: []
            }
        });
        this.emitRunTimerState();
        this.logTimerDiagnostics('timer-start', {
            source,
            previousStatus,
            nextStatus: 'running',
            note: `started-at:${startedAt}`
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export function runStartRunTimerNow(this: any) {
        this.startRunTimerFromAnchor(Date.now(), 'main.manual-start');
    }

export function runPauseRunTimer(this: any) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'running' || runTimer.resumedAt === null) {
            return;
        }
        const now = Date.now();
        this.persistRunTimer(this.buildManualPausedRunTimer(now), {
            event: 'timer-pause',
            source: 'main.manual-pause'
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export function runResumeRunTimer(this: any) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'paused') {
            return;
        }
        const now = Date.now();
        this.persistRunTimer({
            ...runTimer,
            status: 'running',
            resumedAt: now,
            pausedAt: null,
            lastZoneEnteredAt: this.currentZone.sceneKind === 'gameplay' && this.currentZone.guide
                ? now
                : null,
            pauseReason: null
        }, {
            event: 'timer-resume',
            source: 'main.manual-resume'
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export function runResetRunTimer(this: any) {
        this.clearRunTimerStartTimer();
        const previousStatus = this.config.runTimer.status;
        const shouldClearPastLeagueStart = typeof this.config.runTimerSettings.leagueStartAt === 'number' &&
            this.config.runTimerSettings.leagueStartAt <= Date.now();
        this.runtime.endgameT15CompletionNotice = null;
        this.config = this.configStore.update({
            ignoreExistingLogOnNextStart: true,
            runTimer: {
                ...DEFAULT_RUN_TIMER
            },
            townTimer: {
                ...DEFAULT_TOWN_TIMER
            },
            runTimerSettings: {
                ...this.config.runTimerSettings,
                autoStart: false,
                leagueStartAt: shouldClearPastLeagueStart
                    ? null
                    : this.config.runTimerSettings.leagueStartAt,
                leagueStartTimeLabel: shouldClearPastLeagueStart
                    ? null
                    : this.config.runTimerSettings.leagueStartTimeLabel
            },
            zoneTimeHistory: [],
            lastRunSummary: null
        });
        this.emitRunTimerState();
        this.logTimerDiagnostics('timer-reset', {
            source: 'main.reset-run-timer',
            previousStatus,
            nextStatus: 'not_started'
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export function runFinishRunTimer(this: any) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'running' &&
            runTimer.status !== 'paused') {
            return;
        }
        const now = Date.now();
        this.clearRunTimerStartTimer();
        if (this.config.townTimer.isInTown) {
            this.closeTownVisit(now);
        }
        this.recordZoneTimeEntry(this.currentZone.guide, now);
        const elapsedMs = this.getRunTimerDisplayElapsedMs(now);
        const finalizedActSplits = this.finalizeCurrentActSplit(runTimer, now);
        const nextRunTimer: RunTimerState = {
            ...runTimer,
            status: 'finished',
            elapsedMs,
            resumedAt: null,
            pausedAt: runTimer.status === 'paused' ? runTimer.pausedAt : now,
            finishedAt: now,
            lastZoneEnteredAt: null,
            currentZoneElapsedMs: this.getCurrentZoneElapsedMs(now),
            pauseReason: null,
            actSplits: finalizedActSplits
        };
        const previousPb = this.config.bestRun;
        const isNewPb = previousPb === null || elapsedMs < previousPb.totalElapsedMs;
        const nextBestRun = isNewPb
            ? {
                totalElapsedMs: elapsedMs,
                finishedAt: now,
                actSplits: [...nextRunTimer.actSplits]
            }
            : previousPb;
        this.config = this.configStore.update({
            runTimer: nextRunTimer,
            bestRun: nextBestRun,
            lastRunSummary: {
                ...this.buildRunSummary(nextRunTimer, elapsedMs, now),
                isNewPb
            }
        });
        this.emitRunTimerState();
        this.logTimerDiagnostics('timer-finish', {
            source: 'main.finish-run-timer',
            previousStatus: runTimer.status,
            nextStatus: 'finished',
            totalElapsedMs: elapsedMs,
            note: isNewPb ? 'new-pb' : 'finished'
        });
        this.refreshTrayMenu();
        this.broadcastState();
    }

export function runFinalizeCurrentActSplit(this: any, runTimer: any, now: any) {
        const currentAct = this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        if (typeof currentAct !== 'number') {
            return [...runTimer.actSplits];
        }
        if (runTimer.actSplits.some((split: any) => split.act === currentAct)) {
            return [...runTimer.actSplits];
        }
        const highestRecordedAct = [...runTimer.actSplits]
            .sort((left: any, right: any) => right.act - left.act)[0]?.act ?? 0;
        if (currentAct < highestRecordedAct) {
            return [...runTimer.actSplits];
        }
        return [
            ...runTimer.actSplits,
            {
                act: currentAct,
                elapsedMs: this.getRunTimerDisplayElapsedMs(now),
                timestamp: now
            }
        ];
    }

export function runTryRecordActSplitByAct(this: any, previousAct: any, nextAct: any, now: any) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'running' ||
            typeof previousAct !== 'number' ||
            typeof nextAct !== 'number' ||
            nextAct === previousAct ||
            nextAct < previousAct ||
            runTimer.actSplits.some((split: any) => split.act === previousAct)) {
            return null;
        }
        return [
            ...runTimer.actSplits,
            {
                act: previousAct,
                elapsedMs: this.getRunTimerDisplayElapsedMs(now),
                timestamp: now
            }
        ];
    }

export function runRecordActTransitionByHint(this: any, previousAct: any, nextAct: any, now: any) {
        const nextSplits = this.tryRecordActSplitByAct(previousAct, nextAct, now);
        if (!nextSplits) {
            return;
        }
        this.persistRunTimer({
            ...this.config.runTimer,
            actSplits: nextSplits
        }, {
            event: 'timer-act-change',
            source: 'main.act-hint-transition',
            act: nextAct,
            note: `from:${previousAct ?? 'unknown'} to:${nextAct ?? 'unknown'}`
        });
    }

export function runTryRecordActSplit(this: any, previousGuide: any, nextGuide: any, now: any) {
        const runTimer = this.config.runTimer;
        if (runTimer.status !== 'running' ||
            !previousGuide ||
            !nextGuide ||
            typeof previousGuide.act !== 'number' ||
            typeof nextGuide.act !== 'number' ||
            nextGuide.act === previousGuide.act ||
            nextGuide.act < previousGuide.act ||
            runTimer.actSplits.some((split: any) => split.act === previousGuide.act)) {
            return null;
        }
        return [
            ...runTimer.actSplits,
            {
                act: previousGuide.act,
                elapsedMs: this.getRunTimerDisplayElapsedMs(now),
                timestamp: now
            }
        ];
    }

export function runHandleRunTimerAfterZoneEntered(this: any, previousGuide: any, nextGuide: any, now: any) {
        const runTimer = this.config.runTimer;
        this.recordZoneTimeEntry(previousGuide, now);
        const nextSplits = this.tryRecordActSplit(previousGuide, nextGuide, now);
        let shouldPersist = false;
        let nextRunTimer = runTimer;
        if (nextSplits) {
            nextRunTimer = {
                ...nextRunTimer,
                actSplits: nextSplits
            };
            shouldPersist = true;
        }
        if (runTimer.status === 'running') {
            nextRunTimer = {
                ...nextRunTimer,
                lastZoneEnteredAt: now,
                currentZoneElapsedMs: 0
            };
            shouldPersist = true;
        }
        else if (runTimer.currentZoneElapsedMs !== 0 || runTimer.lastZoneEnteredAt !== null) {
            nextRunTimer = {
                ...nextRunTimer,
                currentZoneElapsedMs: 0,
                lastZoneEnteredAt: null
            };
            shouldPersist = true;
        }
        if (shouldPersist) {
            this.persistRunTimer(nextRunTimer, nextSplits
                ? {
                    event: 'timer-act-change',
                    source: 'main.zone-act-transition',
                    act: nextGuide?.act ?? null,
                    note: previousGuide && nextGuide
                        ? `from:${previousGuide.act}:${previousGuide.zone_ru} to:${nextGuide.act}:${nextGuide.zone_ru}`
                        : 'act-transition'
                }
                : {
                    event: 'timer-zone-change',
                    source: 'main.zone-timer-reset',
                    act: nextGuide?.act ?? null,
                    zoneName: nextGuide?.zone_ru ?? this.currentZone.rawZoneName ?? null,
                    note: previousGuide && nextGuide
                        ? `from:${previousGuide.zone_ru} to:${nextGuide.zone_ru}`
                        : 'zone-timer-reset'
                });
        }
    }

export function runProcessLevelUpFromLogLine(this: any, line: any, source: any) {
        const parsedLevelUp = parseLevelUp(line);
        if (parsedLevelUp === null) {
            return;
        }
        const level = parsedLevelUp.level;
        const previousLevel = this.config.currentLevel;
        const changed = previousLevel !== level;
        if (!changed) {
            return;
        }
        this.config = this.configStore.update({
            currentLevel: level
        });
        this.runtime.lastLevelUpDetectedAt = new Date().toISOString();
        if (source !== 'append') {
            this.broadcastState();
            return;
        }
        const state = this.config.levelRemindersState;
        const reminder = this.guideService.findVendorCheckpointByLevel(level);
        if (!reminder) {
            this.broadcastState();
            return;
        }
        if (state.shown.includes(reminder.id) ||
            state.dismissed.includes(reminder.id)) {
            this.broadcastState();
            return;
        }
        this.config = this.configStore.update({
            levelRemindersState: {
                shown: [...state.shown, reminder.id],
                dismissed: state.dismissed,
                activeLevelReminderId: reminder.id
            }
        });
        this.broadcastState();
    }

export function runStartTimerVisualHeartbeat(this: any) {
        this.stopTimerVisualHeartbeat();
        this.timerVisualHeartbeat = setInterval(() => {
            const overlayWindow = this.overlayWindow;
            if (!overlayWindow || overlayWindow.isDestroyed()) {
                return;
            }
            if (overlayWindow.webContents.isDestroyed()) {
                return;
            }
            const now = Date.now();
            if (this.lastTimerVisualHeartbeatSentAtMs !== null) {
                const actualTickMs = Math.max(0, now - this.lastTimerVisualHeartbeatSentAtMs);
                const tickDelayMs = Math.max(0, actualTickMs - TIMER_VISUAL_HEARTBEAT_MS);
                if (tickDelayMs > TIMER_DIAGNOSTICS_TICK_DELAY_THRESHOLD_MS) {
                    this.logTimerDiagnostics('timer-tick-delay', {
                        source: 'main.visual-heartbeat',
                        expectedTickMs: TIMER_VISUAL_HEARTBEAT_MS,
                        actualTickMs,
                        tickDelayMs,
                        note: 'main-thread-stall-symptom'
                    });
                }
            }
            this.lastTimerVisualHeartbeatSentAtMs = now;
            overlayWindow.webContents.send('timer:visual-tick', {
                now
            });
        }, TIMER_VISUAL_HEARTBEAT_MS);
        if (typeof this.timerVisualHeartbeat?.unref === 'function') {
            this.timerVisualHeartbeat.unref();
        }
    }

export function runStopTimerVisualHeartbeat(this: any) {
        if (!this.timerVisualHeartbeat) {
            return;
        }
        clearInterval(this.timerVisualHeartbeat);
        this.timerVisualHeartbeat = null;
        this.lastTimerVisualHeartbeatSentAtMs = null;
    }

export function runEmitRunTimerState(this: any) {
        for (const win of [this.overlayWindow, this.settingsWindow, this.companionWindow, this.infoWindow, this.communityWindow, this.supportWindow]) {
            if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
                win.webContents.send('timer:state-changed', this.config.runTimer);
            }
        }
    }
