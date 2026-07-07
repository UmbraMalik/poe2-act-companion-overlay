import { buildChecklistViewItems } from '../shared/checklist';
import { BROADCAST_THROTTLE_MS } from './app-environment';


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
        // Legacy compatibility no-op: old preload/hotkey surfaces may still call this,
        // but manual checklist completion is disabled and must not mutate progress.
    }

export function runUndoLastChecklistMark(this: any) {
        // Legacy compatibility no-op: kept so older renderer calls resolve safely.
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

export function runGetOverlaySnapshot(this: any) {
        const currentGuideEntry = this.currentZone.guide;
        return {
            config: this.config,
            currentZone: this.currentZone,
            currentGuideEntry,
            vendorCheckpoints: this.guideService.getVendorCheckpoints(),
            powerSpikes: this.guideService.getPowerSpikes(),
            campaignBonuses: this.campaignBonuses,
            runtime: {
                ...this.runtime,
                timerNowMs: Date.now()
            }
        };
    }

export function runGetUiPreferencesSnapshot(this: any) {
        return {
            config: {
                appLanguage: this.config.appLanguage,
                theme: this.config.theme,
                visualFxIntensity: this.config.visualFxIntensity
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
        const targetWindows = [
            this.overlayWindow,
            this.settingsWindow,
            this.companionWindow,
            this.infoWindow,
            this.communityWindow,
            this.supportWindow
        ].filter((win) => (
            win &&
            !win.isDestroyed() &&
            win.isVisible() &&
            !win.webContents.isDestroyed() &&
            !win.webContents.isLoading()
        ));
        if (targetWindows.length === 0) {
            this.pendingSnapshot = null;
            return;
        }
        const overlayTargets = targetWindows.filter((win) => win === this.overlayWindow);
        const uiPreferencesTargets = targetWindows.filter((win) => (
            win === this.infoWindow ||
            win === this.communityWindow ||
            win === this.supportWindow
        ));
        const appTargets = targetWindows.filter((win) => (
            win !== this.overlayWindow &&
            win !== this.infoWindow &&
            win !== this.communityWindow &&
            win !== this.supportWindow
        ));
        const pendingSnapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;
        if (overlayTargets.length > 0) {
            const overlaySnapshot = this.getOverlaySnapshot();
            for (const win of overlayTargets) {
                win.webContents.send('app:state-changed', overlaySnapshot);
            }
        }
        if (uiPreferencesTargets.length > 0) {
            const uiPreferencesSnapshot = this.getUiPreferencesSnapshot();
            for (const win of uiPreferencesTargets) {
                win.webContents.send('app:ui-preferences-changed', uiPreferencesSnapshot);
            }
        }
        if (appTargets.length > 0) {
            const snapshot = pendingSnapshot ?? this.getSnapshot();
            for (const win of appTargets) {
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
