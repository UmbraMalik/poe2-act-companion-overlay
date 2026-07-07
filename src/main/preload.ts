import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppSnapshot,
  ElectronApi,
  OverlayMode,
  RunTimerState,
  SettingsPatch,
  AutoUpdateState,
  TimerDiagnosticsPayload,
  TimerVisualTickPayload
} from '../shared/types';

const timerDiagnosticsEnabled = process.env.POE2_TIMER_DIAGNOSTICS === '1';

const api: ElectronApi = {
  getSnapshot: () => ipcRenderer.invoke('app:get-snapshot'),
  getOverlaySnapshot: () => ipcRenderer.invoke('app:get-overlay-snapshot'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getCachedUpdateCheckResult: () => ipcRenderer.invoke('app:get-cached-update-check-result'),
  getStartupUpdateInfo: () => ipcRenderer.invoke('app:get-startup-update-info'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  getAutoUpdateState: () => ipcRenderer.invoke('app:auto-update-get-state'),
  checkAutoUpdate: () => ipcRenderer.invoke('app:auto-update-check'),
  downloadAutoUpdate: () => ipcRenderer.invoke('app:auto-update-download'),
  installAutoUpdate: () => ipcRenderer.invoke('app:auto-update-install'),
  chooseLogFile: () => ipcRenderer.invoke('app:choose-log-file'),
  updateSettings: (patch: SettingsPatch) =>
    ipcRenderer.invoke('app:update-settings', patch),
  simulateZone: (zoneSelector: string) =>
    ipcRenderer.invoke('app:simulate-zone', zoneSelector),
  reloadGuide: () => ipcRenderer.invoke('app:reload-guide'),
  resetProgress: () => ipcRenderer.invoke('app:reset-progress'),
  resetLevelReminders: () => ipcRenderer.invoke('app:reset-level-reminders'),
  setCampaignBonusDone: (bonusId: string, done: boolean) =>
    ipcRenderer.invoke('app:set-campaign-bonus-done', bonusId, done),
  resetCampaignBonuses: () => ipcRenderer.invoke('app:reset-campaign-bonuses'),
  dismissActiveLevelReminder: () =>
    ipcRenderer.invoke('app:dismiss-active-level-reminder'),
  appendDevLogLine: (line: string) =>
    ipcRenderer.invoke('app:append-dev-log-line', line),
  markCurrentChecklistItemDone: () =>
    ipcRenderer.invoke('app:mark-current-checklist-item-done'),
  undoLastChecklistMark: () =>
    ipcRenderer.invoke('app:undo-last-checklist-mark'),
  armRunTimer: () => ipcRenderer.invoke('app:arm-run-timer'),
  startRunTimer: () => ipcRenderer.invoke('app:start-run-timer'),
  pauseRunTimer: () => ipcRenderer.invoke('app:pause-run-timer'),
  resumeRunTimer: () => ipcRenderer.invoke('app:resume-run-timer'),
  resetRunTimer: () => ipcRenderer.invoke('app:reset-run-timer'),
  saveCurrentRunToHistory: (label?: string) => ipcRenderer.invoke('app:save-current-run', label),
  restoreSavedRun: (runId: string) => ipcRenderer.invoke('app:restore-saved-run', runId),
  deleteSavedRun: (runId: string) => ipcRenderer.invoke('app:delete-saved-run', runId),
  finishRunTimer: () => ipcRenderer.invoke('app:finish-run-timer'),
  getRunTimerState: () => ipcRenderer.invoke('timer:get-state'),
  isTimerDiagnosticsEnabled: () => Promise.resolve(timerDiagnosticsEnabled),
  sendTimerDiagnostics: (payload: TimerDiagnosticsPayload) =>
    ipcRenderer.invoke('app:timer-diagnostics', payload),
  getOverlayBounds: () => ipcRenderer.invoke('app:get-overlay-bounds'),
  resizeOverlay: (width: number, height: number) =>
    ipcRenderer.invoke('app:resize-overlay', width, height),
  resizeOverlayHeight: (height: number, options?: { force?: boolean; allowBelowMinimum?: boolean }) =>
    ipcRenderer.invoke('app:resize-overlay-height', height, options),
  setOverlayAutoResizeSuspended: (suspended: boolean) =>
    ipcRenderer.invoke('app:set-overlay-auto-resize-suspended', suspended),
  setOverlayDragActive: (active: boolean) =>
    ipcRenderer.invoke('app:set-overlay-drag-active', active),
  setOverlayPosition: (x: number, y: number) =>
    ipcRenderer.invoke('app:set-overlay-position', x, y),
  setOverlayMode: (mode: OverlayMode) => ipcRenderer.invoke('app:set-overlay-mode', mode),
  toggleOverlayMode: () => ipcRenderer.invoke('app:toggle-overlay-mode'),
  closeOverlay: () => ipcRenderer.invoke('app:close-overlay'),
  openCompanionPanel: () => ipcRenderer.invoke('app:open-companion-panel'),
  requestRunResetConfirmation: () => ipcRenderer.invoke('app:request-run-reset-confirmation'),
  toggleCompanionPanel: () => ipcRenderer.invoke('app:toggle-companion-panel'),
  openSettings: () => ipcRenderer.invoke('app:open-settings'),
  toggleSettings: () => ipcRenderer.invoke('app:toggle-settings'),
  openInfo: () => ipcRenderer.invoke('app:open-info'),
  openCommunity: () => ipcRenderer.invoke('app:open-community'),
  openSupport: () => ipcRenderer.invoke('app:open-support'),
  openReportIssue: () => ipcRenderer.invoke('app:open-report-issue'),
  openUpdateDownload: (url: string) =>
    ipcRenderer.invoke('app:open-update-download', url),
  openReleasePage: (url: string) => ipcRenderer.invoke('app:open-release-page', url),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  cancelCloseConfirm: () => ipcRenderer.invoke('close-confirm:stay'),
  confirmCloseAndSave: () => ipcRenderer.invoke('close-confirm:close-and-save'),
  onAutoUpdateChanged: (callback: (state: AutoUpdateState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AutoUpdateState) => {
      callback(state);
    };
    ipcRenderer.on('app:auto-update-changed', listener);
    return () => {
      ipcRenderer.removeListener('app:auto-update-changed', listener);
    };
  },
  onRunTimerChanged: (callback: (runTimer: RunTimerState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runTimer: RunTimerState) => {
      callback(runTimer);
    };
    ipcRenderer.on('timer:state-changed', listener);
    return () => {
      ipcRenderer.removeListener('timer:state-changed', listener);
    };
  },
  onRunResetConfirmationRequested: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on('app:request-run-reset-confirmation', listener);
    return () => {
      ipcRenderer.removeListener('app:request-run-reset-confirmation', listener);
    };
  },
  onTimerVisualTick: (callback: (payload: TimerVisualTickPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: TimerVisualTickPayload) => {
      callback(payload);
    };
    ipcRenderer.on('timer:visual-tick', listener);
    return () => {
      ipcRenderer.removeListener('timer:visual-tick', listener);
    };
  },
  onStateChanged: (callback: (snapshot: AppSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot) => {
      callback(snapshot);
    };
    ipcRenderer.on('app:state-changed', listener);
    return () => {
      ipcRenderer.removeListener('app:state-changed', listener);
    };
  }
};

contextBridge.exposeInMainWorld('poe2Overlay', api);
