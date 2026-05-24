import type { KeyboardEvent, ReactNode } from 'react';
import { translate } from '../../i18n/translations';
import type { AppLanguage, HotkeySettings, OverlayDensity, RunTimerStatus } from '../../shared/types';

export const SHOW_DEVELOPER_SETTINGS = import.meta.env.DEV;

export function getDefaultDevLine(language: AppLanguage): string {
  return language === 'en'
    ? '2026/05/12 12:00:00 You have entered area: Grelwood'
    : '2026/05/12 12:00:00 Вы вошли в область: Грельвуд';
}

export function getDefaultRewardLine(language: AppLanguage): string {
  return language === 'en'
    ? 'Player has received +10% to [Resistances|Cold].'
    : 'Игрок получил +10% к сопротивлению [Resistances|холоду].';
}

export const HOTKEY_LABELS: Array<{ key: keyof HotkeySettings; labelKey: string; noteKey: string }> = [
  { key: 'toggleTimerPause', labelKey: 'settings.hotkeyPause', noteKey: 'settings.hotkeyAlways' },
  { key: 'openCompanion', labelKey: 'settings.hotkeyCompanion', noteKey: 'settings.hotkeyAlways' },
  { key: 'toggleOverlayMode', labelKey: 'settings.hotkeyOverlayMode', noteKey: 'settings.hotkeyAlways' }
];

export const OVERLAY_SECTION_VISIBILITY_LABELS = [
  ['nearby', 'settings.overlayShowNearby'],
  ['zoneInfo', 'settings.overlayShowZoneInfo'],
  ['zoneBonuses', 'settings.overlayShowZoneBonuses'],
  ['league', 'settings.overlayShowLeague'],
  ['next', 'settings.overlayShowNext'],
  ['skip', 'settings.overlayShowSkip'],
  ['speedrun', 'settings.overlayShowSpeedrun'],
  ['important', 'settings.overlayShowImportant']
] as const;

export function hotkeyFromKeyboardEvent(event: KeyboardEvent<HTMLInputElement>): string | null {
  const key = event.key;
  if (!key || key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    return null;
  }

  if (key === 'Escape') {
    event.currentTarget.blur();
    return null;
  }

  if (key === 'Backspace' || key === 'Delete') {
    return '';
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  let normalizedKey = key.length === 1 ? key.toUpperCase() : key;
  if (normalizedKey === ' ') {
    normalizedKey = 'Space';
  }

  const isFunctionKey = /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(normalizedKey.toUpperCase());
  const isSimpleKey = /^[A-Z0-9]$/.test(normalizedKey.toUpperCase()) || normalizedKey === 'Space';

  if (!isFunctionKey && !isSimpleKey) {
    return null;
  }

  if (!isFunctionKey && parts.length === 0) {
    // Bare letters/numbers would hijack typing globally. Require Ctrl/Alt/Shift for them.
    return null;
  }

  return [...parts, normalizedKey.toUpperCase()].join('+');
}


export function formatDateTimeLocalInput(
  timestamp: number | null,
  fallbackLabel: string | null
): string {
  if (fallbackLabel) {
    return fallbackLabel;
  }

  if (timestamp === null) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatRunTimerStatus(status: RunTimerStatus, language: AppLanguage): string {
  switch (status) {
    case 'armed':
      return translate(language, 'companion.runStatus.armed');
    case 'running':
      return translate(language, 'companion.runStatus.running');
    case 'paused':
      return translate(language, 'companion.runStatus.paused');
    case 'finished':
      return translate(language, 'companion.runStatus.finished');
    default:
      return translate(language, 'companion.runStatus.idle');
  }
}

export function formatOverlayDensity(value: OverlayDensity, language: AppLanguage): string {
  switch (value) {
    case 'compact':
      return translate(language, 'overlayDensity.compact');
    case 'detailed':
      return translate(language, 'overlayDensity.detailed');
    default:
      return translate(language, 'overlayDensity.normal');
  }
}

export function formatLogSelectionMode(mode: 'auto' | 'manual' | null, language: AppLanguage): string {
  switch (mode) {
    case 'auto':
      return translate(language, 'logSelectionMode.auto');
    case 'manual':
      return translate(language, 'logSelectionMode.manual');
    default:
      return translate(language, 'logSelectionMode.legacy');
  }
}

export function InfoGrid({
  items
}: {
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
}) {
  return (
    <dl className="info-grid">
      {items.map((item) => (
        <div className="info-cell" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

