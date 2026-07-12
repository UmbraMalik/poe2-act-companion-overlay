import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { ENDGAME_T15_ACT } from '../shared/timers';
import type { ZoneMatchExtractor } from './services/zone-match-extractor';
import {
  inferActHintFromInternalAreaId as inferActHintFromInternalAreaIdFromScene,
  inferActHintFromTownScene,
  isActLabelScene,
  isLoginLikeScene,
  isTownSceneWithGuide,
  isUnknownOrNullScene,
  isValidGameplaySceneSource,
  normalizeSceneText
} from './scene-classifier';
import { diagnosticInfo } from './diagnostic-logger';

type ZoneMatchExtractionContext = {
    zoneMatchExtractor: ZoneMatchExtractor;
};


export function runLoadGuide(this: any) {
        try {
            this.guideService.load();
            this.runtime.guideLoadedAt = this.guideService.getLoadedAt();
        }
        catch (error) {
            const message = error instanceof Error && error.message
                ? `${this.t('main.guideLoadError')}: ${error.message}`
                : this.t('main.guideLoadError');
            this.setLogStatus('error', message);
        }
    }

export function runRestoreLastZoneFromConfig(this: any) {
        if (!this.config.lastZoneName) {
            return;
        }
        this.currentZone = {
            rawZoneName: this.config.lastZoneName,
            guide: this.guideService.findByZoneName(this.config.lastZoneName),
            sceneKind: this.guideService.findByZoneName(this.config.lastZoneName)
                ? 'gameplay'
                : 'unknown',
            actHint: this.guideService.findByZoneName(this.config.lastZoneName)?.act ?? null
        };
        this.syncRuntimeZoneFields(this.config.lastZoneName, this.currentZone.guide);
        this.runtime.lastZoneSource = 'config';
    }

export function runRebindCurrentZoneAfterGuideReload(this: any) {
        const currentGuideId = this.currentZone.guide?.id ?? this.runtime.lastMatchedGuideId;
        const reboundGuide = this.guideService.findById(currentGuideId) ??
            this.guideService.findByZoneName(this.currentZone.rawZoneName);
        this.currentZone = {
            rawZoneName: this.currentZone.rawZoneName,
            guide: reboundGuide,
            sceneKind: this.currentZone.sceneKind === 'town' || this.currentZone.sceneKind === 'login'
                ? this.currentZone.sceneKind
                : reboundGuide
                    ? 'gameplay'
                    : this.currentZone.sceneKind,
            actHint: reboundGuide?.act ?? this.currentZone.actHint
        };
        this.syncRuntimeZoneFields(this.currentZone.rawZoneName, this.currentZone.guide);
    }

export async function runEnsureLogFile(this: any) {
        if (this.config.logFilePath) {
            const shouldPreservePath = this.config.logFileSelectionMode !== 'auto';
            if (shouldPreservePath || (await this.isReadable(this.config.logFilePath))) {
                await this.refreshLogFileInfo(this.config.logFilePath);
                return;
            }
        }
        const discoveredPath = await this.findAutoLogFile();
        if (discoveredPath) {
            this.config = this.configStore.update({
                logFilePath: discoveredPath,
                logFileSelectionMode: 'auto'
            });
            await this.refreshLogFileInfo(discoveredPath);
            return;
        }
        this.config = this.configStore.update({
            logFilePath: this.config.logFileSelectionMode === 'manual' ? this.config.logFilePath : null,
            logFileSelectionMode: this.config.logFileSelectionMode === 'manual'
                ? 'manual'
                : null
        });
        await this.refreshLogFileInfo(this.config.logFilePath);
        if (!this.config.logFilePath) {
            this.setLogStatus('missing', this.t('system.logWatcher.missingManual'));
        }
    }

export async function runFindAutoLogFile(this: any) {
        const documents = app.getPath('documents');
        const baseDirectories = [
            join(documents, 'My Games', 'Path of Exile 2', 'logs'),
            join(documents, 'My Games', 'Path of Exile 2'),
            'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs',
            'C:\\Program Files\\Steam\\steamapps\\common\\Path of Exile 2\\logs',
            'E:\\Steam\\steamapps\\common\\Path of Exile 2\\logs'
        ];
        const fileNamesByPriority = ['LatestClient.txt', 'Client.txt'];
        const candidates = fileNamesByPriority.flatMap((fileName: any) => baseDirectories.map((directory: any) => join(directory, fileName)));
        for (const candidate of candidates) {
            if (await this.isReadable(candidate)) {
                return candidate;
            }
        }
        return null;
    }

export async function runIsReadable(this: any, filePath: any) {
        try {
            await access(filePath, constants.R_OK);
            return true;
        }
        catch {
            return false;
        }
    }

export function runClearLogFileInfoRefreshTimer(this: any) {
        if (this.logInfoRefreshTimer) {
            clearTimeout(this.logInfoRefreshTimer);
            this.logInfoRefreshTimer = null;
        }
    }

export function runScheduleLogFileInfoRefresh(this: any) {
        if (this.isQuitting) {
            return;
        }
        this.clearLogFileInfoRefreshTimer();
        this.logInfoRefreshTimer = setTimeout(() => {
            this.logInfoRefreshTimer = null;
            void this.refreshLogFileInfo();
        }, 250);
    }

export async function runRefreshLogFileInfo(this: any, filePath: any = this.config.logFilePath) {
        const nextPath = filePath ?? null;
        let nextExists = false;
        let nextSize = null;
        if (nextPath) {
            try {
                const fileStat = await stat(nextPath);
                if (fileStat.isFile()) {
                    nextExists = true;
                    nextSize = fileStat.size;
                }
            }
            catch {
                nextExists = false;
                nextSize = null;
            }
        }
        const hasChanges = this.runtime.logFileExists !== nextExists ||
            this.runtime.logFileSize !== nextSize;
        this.runtime.logFileExists = nextExists;
        this.runtime.logFileSize = nextSize;
        if (hasChanges) {
            this.broadcastState();
        }
    }

export async function runStartLogWatcher(this: any, filePath: any, skipBootstrap: any = false) {
        await this.refreshLogFileInfo(filePath);
        this.zoneMatchExtractor.reset();
        await this.logWatcher.start(filePath, { skipBootstrap });
        if (skipBootstrap && this.config.ignoreExistingLogOnNextStart) {
            this.config = this.configStore.update({
                ignoreExistingLogOnNextStart: false
            });
        }
        this.scheduleLogFileInfoRefresh();
        this.broadcastState();
    }

export function runSetCurrentZone(this: any, rawZoneName: any, source: any, guide: any = this.guideService.findByZoneName(rawZoneName), actHint: any = null) {
        if (!guide) {
            this.setSceneWithoutGuide(rawZoneName, source, 'gameplay', actHint);
            return;
        }
        const now = Date.now();
        const previousGuide = this.currentZone.guide;
        const previousGuideId = previousGuide?.id ?? null;
        const nextGuideId = guide.id;
        const sceneChanged = this.currentZone.sceneKind !== 'gameplay' ||
            previousGuideId !== nextGuideId;
        if (previousGuide && previousGuideId !== nextGuideId) {
            this.handleZoneLeave(previousGuide);
        }
        else if (!previousGuide) {
            this.clearMissedWarning();
        }
        this.currentZone = {
            rawZoneName,
            guide,
            sceneKind: 'gameplay',
            actHint: guide.act
        };
        this.runtime.lastGameplayGuideId = guide.id;
        this.runtime.lastGameplayZoneRu = guide.zone_ru;
        this.runtime.lastGameplayAct = guide.act;
        this.runtime.lastValidGameplayZoneAt = new Date().toISOString();
        this.syncRuntimeZoneFields(rawZoneName, guide);
        this.runtime.lastZoneSource = source;
        this.updateZoneProgress(guide);
        this.config = this.configStore.update({
            lastZoneName: guide.zone_ru
        });
        if (sceneChanged) {
            this.recordVisitedZone(guide, now);
            this.handleRunTimerAfterZoneEntered(previousGuide, guide, now);
        }
        this.broadcastState();
    }

export function runHandleZoneLeave(this: any, _previousGuide: any) {
        // Do not mark missed rewards anymore. The overlay is a guide/reminder,
        // not a pass/fail checklist.
        this.clearMissedWarning();
    }

export function runSetSceneWithoutGuide(this: any, rawZoneName: any, source: any, sceneKind: any, actHint: any = null) {
        const now = Date.now();
        const previousActHint = this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        const nextActHint = this.getFallbackActHintForScene(sceneKind, actHint);
        const previousRawZoneName = this.currentZone.rawZoneName;
        this.currentZone = {
            rawZoneName,
            guide: sceneKind === 'gameplay' || sceneKind === 'unknown' ? null : this.currentZone.guide,
            sceneKind,
            actHint: nextActHint
        };
        if ((sceneKind === 'gameplay' || sceneKind === 'unknown') && typeof nextActHint === 'number') {
            this.runtime.lastGameplayAct = nextActHint;
            this.runtime.lastValidGameplayZoneAt = new Date(now).toISOString();
            this.recordActTransitionByHint(previousActHint, nextActHint, now);
        }
        this.syncRuntimeZoneFields(rawZoneName, this.currentZone.guide);
        this.runtime.lastZoneSource = source;
        this.config = this.configStore.update({
            lastZoneName: rawZoneName
        });
        const runTimer = this.config.runTimer;
        if ((sceneKind === 'gameplay' || sceneKind === 'unknown' || sceneKind === 'town') &&
            previousRawZoneName !== rawZoneName &&
            (runTimer.status === 'running' ||
                runTimer.status === 'paused' ||
                runTimer.status === 'finished' ||
                runTimer.lastZoneEnteredAt !== null ||
                runTimer.currentZoneElapsedMs !== 0)) {
            this.logTimerDiagnostics('timer-zone-change', {
                source: `main.scene-${sceneKind}`,
                zoneName: rawZoneName ?? null,
                act: nextActHint,
                note: `zone-source:${source ?? 'unknown'}`
            });
        }
        this.broadcastState();
    }

export function runSetTownScene(this: any, rawZoneName: any, source: any) {
        const now = Date.now();
        const previousActHint = this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        const sceneChanged = this.currentZone.rawZoneName !== rawZoneName ||
            this.currentZone.sceneKind !== 'town';
        const matchedTownGuide = rawZoneName ? this.guideService.findByZoneName(rawZoneName) : null;
        const townActHint = inferActHintFromTownScene(rawZoneName);
        const shouldClearGuide = townActHint === ENDGAME_T15_ACT ||
            this.normalizeSceneSource(rawZoneName) === 'clearfell encampment';
        const nextTownGuide = matchedTownGuide ??
            (shouldClearGuide ? null : this.currentZone.guide);
        const nextActHint = townActHint ?? nextTownGuide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        // Town/hub scenes are part of the run. Do not pause timers and do not
        // start separate town tracking.
        this.currentZone = {
            rawZoneName,
            guide: nextTownGuide,
            sceneKind: 'town',
            actHint: nextActHint
        };
        if (typeof townActHint === 'number') {
            this.runtime.lastGameplayAct = townActHint;
            this.recordActTransitionByHint(previousActHint, townActHint, now);
        }
        this.syncRuntimeZoneFields(rawZoneName, this.currentZone.guide);
        this.runtime.lastZoneSource = source;
        this.updateZoneProgress(this.currentZone.guide);
        this.config = this.configStore.update({
            lastZoneName: rawZoneName
        });
        const runTimer = this.config.runTimer;
        if (sceneChanged) {
            if (runTimer.status === 'running' || runTimer.status === 'paused' || runTimer.status === 'finished') {
                this.logTimerDiagnostics('timer-zone-change', {
                    source: 'main.zone-town',
                    zoneName: rawZoneName ?? null,
                    act: this.currentZone.actHint,
                    note: nextTownGuide?.id ?? 'town-without-guide'
                });
            }
        }
        this.broadcastState();
    }

export function runRecordVisitedZone(this: any, guide: any, enteredAt: any) {
        const existing = this.config.visitedZones.find((entry: any) => entry.zoneId === guide.id);
        const nextVisitedZones = existing
            ? this.config.visitedZones.map((entry: any) => entry.zoneId === guide.id
                ? {
                    ...entry,
                    lastEnteredAt: enteredAt,
                    visitCount: entry.visitCount + 1
                }
                : entry)
            : [
                ...this.config.visitedZones,
                {
                    zoneId: guide.id,
                    zone_ru: guide.zone_ru,
                    act: guide.act,
                    firstEnteredAt: enteredAt,
                    lastEnteredAt: enteredAt,
                    visitCount: 1
                }
            ];
        this.config = this.configStore.update({
            visitedZones: nextVisitedZones
        });
    }

export function runOpenTownVisit(this: any, _townName: any, _now: any) {
        // Town timer removed: towns are not tracked separately.
    }

export function runCloseTownVisit(this: any, _now: any) {
        // Town timer removed: nothing to close.
    }

export function runHandleRunTimerAfterTownEntered(this: any, _now: any) {
        // Towns no longer close or pause the active gameplay zone timer.
        // We keep only the global run timer and act splits in the UI.
    }

export function runRecordZoneTimeEntry(this: any, guide: any, now: any) {
        const runTimer = this.config.runTimer;
        const enteredAt = runTimer.lastZoneEnteredAt ??
            (runTimer.pausedAt !== null
                ? Math.max(0, runTimer.pausedAt - runTimer.currentZoneElapsedMs)
                : null);
        if (!guide || enteredAt === null) {
            return;
        }
        const elapsedMs = runTimer.status === 'running'
            ? this.getCurrentZoneElapsedMs(now)
            : runTimer.currentZoneElapsedMs;
        if (elapsedMs <= 0) {
            return;
        }
        const nextEntry = {
            zoneId: guide.id,
            zone_ru: guide.zone_ru,
            act: guide.act,
            elapsedMs,
            enteredAt,
            leftAt: now
        };
        const previousEntry = this.config.zoneTimeHistory[this.config.zoneTimeHistory.length - 1];
        if (previousEntry &&
            previousEntry.zoneId === nextEntry.zoneId &&
            previousEntry.enteredAt === nextEntry.enteredAt) {
            return;
        }
        this.config = this.configStore.update({
            zoneTimeHistory: [...this.config.zoneTimeHistory, nextEntry]
        });
    }

export function runCollectVisitedGuides(this: any) {
        const visitedIds = new Set(this.config.visitedZones.map((entry: any) => entry.zoneId));
        return this.guideService
            .getAll()
            .filter((guide: any) => guide.id === this.currentZone.guide?.id || visitedIds.has(guide.id));
    }

export function runBuildRunSummary(this: any, runTimer: any, totalElapsedMs: any, finishedAt: any) {
        const longestZones = [...this.config.zoneTimeHistory]
            .sort((left: any, right: any) => right.elapsedMs - left.elapsedMs)
            .slice(0, 5);
        const previousPb = this.config.bestRun;
        const isNewPb = previousPb === null || totalElapsedMs < previousPb.totalElapsedMs;
        return {
            totalElapsedMs,
            finishedAt,
            actSplits: [...runTimer.actSplits],
            missedRequiredRewards: [],
            skippedRequiredItems: [],
            unfinishedChecklistItems: [],
            pauseCount: runTimer.pauseCount,
            longestZones,
            townTimeTotalMs: 0,
            isNewPb
        };
    }

export function runGetActiveLevelReminder(this: any) {
        const reminder = this.guideService.findVendorCheckpointById(this.config.levelRemindersState.activeLevelReminderId);
        const currentLevel = this.config.currentLevel;
        if (!reminder || (typeof currentLevel === 'number' && reminder.level < currentLevel)) {
            return null;
        }
        return reminder;
    }

export function runNormalizeSceneSource(this: any, rawSceneSource: any) {
        return normalizeSceneText(rawSceneSource);
    }

export function runGetZoneMatchActHint(this: any, zoneMatch: any) {
        return zoneMatch?.guide?.act ?? inferActHintFromInternalAreaIdFromScene(zoneMatch?.extractedInternalAreaId) ?? null;
    }

export function runGetFallbackActHintForScene(this: any, sceneKind: any, explicitActHint: any = null) {
        if (explicitActHint !== null && explicitActHint !== undefined) {
            return explicitActHint;
        }
        if (sceneKind === 'gameplay' || sceneKind === 'unknown' || sceneKind === 'town') {
            return this.currentZone.guide?.act ?? this.currentZone.actHint ?? this.runtime.lastGameplayAct ?? null;
        }
        return this.currentZone.actHint;
    }

export function runIsUnknownOrNullScene(this: any, rawSceneSource: any) {
        return isUnknownOrNullScene(rawSceneSource);
    }

export function runIsActLabelScene(this: any, rawSceneSource: any) {
        return isActLabelScene(rawSceneSource);
    }

export function runIsLoginLikeScene(this: any, rawSceneSource: any) {
        return isLoginLikeScene(rawSceneSource);
    }

export function runIsTownScene(this: any, rawSceneSource: any) {
        return this.isTownSceneWithGuide(rawSceneSource, rawSceneSource ? this.guideService.findByZoneName(rawSceneSource) : null);
    }

export function runIsTownSceneWithGuide(this: any, rawSceneSource: any, guide: any) {
        return isTownSceneWithGuide(rawSceneSource, guide);
    }

export function runIsValidGameplaySceneSource(this: any, rawSceneSource: any, guide: any = rawSceneSource ? this.guideService.findByZoneName(rawSceneSource) : null) {
        return isValidGameplaySceneSource(rawSceneSource, guide);
    }

export function runGetIgnoredZoneEventReason(this: any, zoneMatch: any) {
        const currentGuideId = this.currentZone.guide?.id ?? null;
        const matchedGuideId = zoneMatch.guide?.id ?? null;
        if (matchedGuideId &&
            currentGuideId === matchedGuideId &&
            this.currentZone.sceneKind === 'gameplay') {
            return `same guide zone already active (${matchedGuideId})`;
        }
        // If the log names a gameplay scene but we do not have a guide entry for it,
        // do not keep the previous guide zone. Show an explicit “no info for this location”
        // state instead, so the overlay does not lie about the current location.
        return null;
    }

export function runLogZoneEventDecision(this: any, zoneMatch: any, action: any, reason: any = null) {
        diagnosticInfo('ZoneEvent', 'Processed zone event', {
            rawLine: zoneMatch.rawLine,
            extractedInternalAreaId: zoneMatch.extractedInternalAreaId,
            extractedZoneName: zoneMatch.extractedZoneName,
            normalizedZoneName: zoneMatch.normalizedZoneName,
            source: zoneMatch.source,
            matchedGuideZoneId: zoneMatch.guide?.id ?? null,
            matchedGuideZoneRu: zoneMatch.guide?.zone_ru ?? null,
            currentZoneUpdated: action === 'updated',
            currentZoneIgnored: action === 'ignored',
            reason: reason ?? null
        });
    }

export function runExtractZoneMatchFromLogLine(this: ZoneMatchExtractionContext, line: unknown) {
        return this.zoneMatchExtractor.extractFromLogLine(line);
    }
