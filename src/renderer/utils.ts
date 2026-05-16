import type { AppSnapshot, GuideEntry } from '../shared/types';

export { formatDuration } from '../shared/timers';

export type LevelState = 'ok' | 'low' | 'unknown';

export function getRecommendedMinLevel(
  recommendedLevel: number | null | undefined
): number | null {
  return typeof recommendedLevel === 'number' ? recommendedLevel : null;
}

export function getLevelState(snapshot: AppSnapshot | null): {
  state: LevelState;
  label: string;
} {
  if (!snapshot) {
    return {
      state: 'unknown',
      label: 'НЕИЗВЕСТНО'
    };
  }

  const currentLevel = snapshot.config.currentLevel;
  const recommendedMinLevel = getRecommendedMinLevel(
    snapshot.currentGuideEntry?.recommended_level ?? snapshot.currentZone.guide?.recommended_level
  );

  if (currentLevel === null || recommendedMinLevel === null) {
    return {
      state: 'unknown',
      label: 'НЕИЗВЕСТНО'
    };
  }

  if (currentLevel < recommendedMinLevel) {
    return {
      state: 'low',
      label: 'НИЗКИЙ УРОВЕНЬ'
    };
  }

  return {
    state: 'ok',
    label: 'ОК'
  };
}

export function formatZoneOption(entry: GuideEntry): string {
  return `${formatActLabel(entry)} · ${entry.zone_ru} (${entry.zone_en})`;
}

export function formatActLabel(entry: Pick<GuideEntry, 'act'>): string {
  return entry.act === 'interlude' ? 'ИНТЕРЛЮДИИ' : `АКТ ${entry.act}`;
}

export function formatFileSize(size: number | null): string {
  if (size === null) {
    return '—';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTimestamp(timestamp: string | null): string {
  if (!timestamp) {
    return '—';
  }

  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime())
    ? timestamp
    : parsed.toLocaleString('ru-RU');
}

export type ReleaseNoteItem = {
  text: string;
  kind: 'heading' | 'item' | 'text';
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeReleaseNotesText(body: unknown): string {
  const raw = Array.isArray(body) ? body.join('\n') : String(body ?? '');

  return decodeHtmlEntities(
    raw
      .replace(/\r/g, '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '— ')
      .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
}

export function getReleaseNoteItems(body: unknown): ReleaseNoteItem[] {
  return normalizeReleaseNotesText(body)
    .split(/\n+/)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, '')
        .replace(/^\s*[•*]\s+/, '— ')
        .replace(/^\s*[-–]\s+/, '— ')
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .map((line) => {
      if (/^[^—].+:$/.test(line)) {
        return { text: line, kind: 'heading' };
      }

      if (/^—\s*/.test(line)) {
        return { text: line.replace(/^—\s*/, ''), kind: 'item' };
      }

      return { text: line, kind: 'text' };
    });
}

export function getReleaseNotesLines(body: unknown): string[] {
  return getReleaseNoteItems(body).map((item) =>
    item.kind === 'item' ? `— ${item.text}` : item.text
  );
}
