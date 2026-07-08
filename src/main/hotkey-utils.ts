export const HOTKEY_ACTION_LABELS = {
  toggleTimerPause: 'пауза/продолжить таймер',
  openCompanion: 'подробная панель',
  toggleOverlayMode: 'режим оверлея'
} as const;

export function normalizeHotkeyAccelerator(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }

  const parts = raw
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .split('+')
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const modifiers = new Set<string>();
  let key: string | null = null;

  for (const part of parts) {
    const upper = part.toUpperCase();

    if (upper === 'CTRL' || upper === 'CONTROL' || upper === 'CMDORCTRL' || upper === 'COMMANDORCONTROL') {
      modifiers.add('CommandOrControl');
      continue;
    }
    if (upper === 'SHIFT') {
      modifiers.add('Shift');
      continue;
    }
    if (upper === 'ALT' || upper === 'OPTION') {
      modifiers.add('Alt');
      continue;
    }
    if (upper === 'META' || upper === 'CMD' || upper === 'COMMAND' || upper === 'SUPER') {
      modifiers.add(process.platform === 'darwin' ? 'Command' : 'Super');
      continue;
    }
    if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(upper)) {
      key = upper;
      continue;
    }
    if (/^[A-Z]$/.test(upper) || /^\d$/.test(upper)) {
      key = upper;
      continue;
    }
    if (upper === 'SPACE') {
      key = 'Space';
      continue;
    }
    return null;
  }

  if (!key) {
    return null;
  }

  const isFunctionKey = /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(key);
  // Do not allow bare letters/digits/space as global shortcuts — that would hijack normal typing.
  if (!isFunctionKey && modifiers.size === 0) {
    return null;
  }

  const orderedModifiers = ['CommandOrControl', 'Command', 'Super', 'Alt', 'Shift'].filter((modifier) => modifiers.has(modifier));
  return [...orderedModifiers, key].join('+');
}

export function formatConfiguredHotkey(value: unknown, fallback: string): string {
  return normalizeHotkeyAccelerator(value) ?? normalizeHotkeyAccelerator(fallback) ?? fallback;
}
