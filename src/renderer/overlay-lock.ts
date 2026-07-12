import type { AppLanguage, ElectronApi } from '../shared/types';
import { translate } from '../i18n/translations';

type OverlayControlEvent = {
  preventDefault?: () => void;
  stopPropagation: () => void;
};
type OverlaySettingsApi = Pick<ElectronApi, 'updateSettings'>;

export function getOverlayLockButtonIcon(movementLocked: boolean): 'lock' | 'unlock' {
  return movementLocked ? 'lock' : 'unlock';
}

export function getOverlayLockButtonLabel(
  movementLocked: boolean,
  language: AppLanguage
): string {
  return translate(language, movementLocked ? 'overlay.unlock' : 'overlay.lock');
}

export function getResizeGripClassName(movementLocked: boolean): string {
  return movementLocked ? 'resize-grip no-drag is-disabled' : 'resize-grip no-drag';
}

export function stopOverlayControlPropagation(event: OverlayControlEvent): void {
  event.preventDefault?.();
  event.stopPropagation();
}

export async function toggleOverlayMovementLock(
  event: OverlayControlEvent,
  api: OverlaySettingsApi,
  movementLocked: boolean
): Promise<void> {
  stopOverlayControlPropagation(event);

  await api.updateSettings({
    overlayMovementLocked: !movementLocked
  });
}
