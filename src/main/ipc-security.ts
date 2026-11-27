import type { IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { isAllowedAppPageUrl } from './window-security';

const permissions: Record<string, readonly string[]> = {};
function allow(roles: string[], channels: string[]): void {
  for (const channel of channels) permissions[channel] = [...(permissions[channel] ?? []), ...roles];
}
const primary = ['overlay', 'settings', 'companion'];
const utility = ['settings', 'info', 'community', 'support', 'report'];
const all = [...primary, 'info', 'community', 'support', 'report', 'update', 'close-confirm'];
allow(all, ['app:get-version', 'app:get-ui-preferences-snapshot']);
allow([...primary, 'report'], ['app:get-snapshot']);
allow(['overlay'], ['app:get-overlay-snapshot', 'app:resize-overlay-height', 'app:set-overlay-auto-resize-suspended', 'app:set-overlay-drag-active', 'app:set-overlay-position', 'app:set-overlay-mode', 'app:toggle-overlay-mode', 'app:close-overlay', 'app:toggle-settings', 'app:toggle-companion-panel']);
allow(['overlay', 'settings'], ['app:get-overlay-bounds', 'app:resize-overlay', 'app:choose-log-file', 'app:auto-detect-log-file']);
allow(primary, ['app:update-settings', 'timer:get-state', 'app:timer-diagnostics', 'app:start-run-timer', 'app:pause-run-timer', 'app:resume-run-timer', 'app:open-settings', 'app:open-companion-panel', 'app:request-run-reset-confirmation', 'app:mark-current-checklist-item-done', 'app:undo-last-checklist-mark']);
allow(['settings', 'companion'], ['app:reset-run-timer', 'app:finish-run-timer', 'app:reset-campaign-bonuses', 'app:set-campaign-bonus-done', 'app:set-campaign-bonus-choice']);
allow(['settings'], ['app:simulate-zone', 'app:reload-guide', 'app:reset-progress', 'app:reset-level-reminders', 'app:dismiss-active-level-reminder', 'app:append-dev-log-line', 'app:arm-run-timer', 'app:get-cached-update-check-result', 'app:check-for-updates', 'app:auto-update-check']);
allow(['companion'], ['app:save-current-run', 'app:restore-saved-run', 'app:delete-saved-run', 'app:open-info', 'app:open-community', 'app:open-support', 'app:open-report-issue']);
allow(['settings', 'report'], ['app:get-debug-bundle-log-tail', 'app:export-debug-bundle']);
allow(['settings', 'report', 'update'], ['app:auto-update-get-state']);
allow(['settings', 'update'], ['app:auto-update-download', 'app:auto-update-install', 'app:open-release-page', 'app:open-update-download']);
allow(['update'], ['app:get-startup-update-info']);
allow(['close-confirm'], ['close-confirm:stay', 'close-confirm:close-and-save']);
allow(utility, ['app:resize-settings-window']);
allow(['companion', 'community', 'support', 'report'], ['app:open-external']);

const roleWindowKeys: Record<string, string> = {
  overlay: 'overlayWindow', settings: 'settingsWindow', companion: 'companionWindow',
  info: 'infoWindow', community: 'communityWindow', support: 'supportWindow',
  report: 'reportWindow', update: 'updateWindow', 'close-confirm': 'closeConfirmWindow'
};
export function isAuthorizedIpc(channel: string, event: IpcMainInvokeEvent, windows: Record<string, BrowserWindow | null | undefined>): boolean {
  try {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || event.sender.isDestroyed()) return false;
    return (permissions[channel] ?? []).some((role) => {
      const window = windows[roleWindowKeys[role]];
      return Boolean(window && !window.isDestroyed() && window.webContents === event.sender && isAllowedAppPageUrl(frame.url, role));
    });
  } catch { return false; }
}
