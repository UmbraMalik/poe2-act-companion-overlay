import type { AppLanguage, AppSnapshot, AutoUpdateState } from './types';
import { buildReportDiagnostics } from './report-issue';

export const DEBUG_BUNDLE_LOG_LINE_LIMIT = 20;
export const DEBUG_BUNDLE_MAX_TEXT_LENGTH = 120_000;
const DEBUG_BUNDLE_MAX_LOG_LINE_LENGTH = 500;

export interface DebugBundleOptions {
  snapshot: AppSnapshot | null;
  appVersion: string;
  language: AppLanguage;
  platform: string;
  updateState?: AutoUpdateState | null;
  diagnosticsText?: string | null;
  logLines?: readonly string[];
  now?: Date;
  userAgent?: string;
}

export interface DebugBundle {
  text: string;
  diagnosticsText: string;
  logLines: string[];
  fileName: string;
}

type DebugBundleText = {
  title: string;
  app: string;
  overlay: string;
  logHealth: string;
  zone: string;
  update: string;
  diagnostics: string;
  lastSafeLogLines: string;
  generatedAt: string;
  appVersion: string;
  platform: string;
  language: string;
  theme: string;
  visualFx: string;
  mode: string;
  density: string;
  scale: string;
  textSize: string;
  opacity: string;
  fx: string;
  timerOnly: string;
  selectedLogPath: string;
  watchedLogPath: string;
  logExists: string;
  logSize: string;
  watcherStatus: string;
  watcherMessage: string;
  lastReadAt: string;
  lastMatchedAt: string;
  currentRawZone: string;
  sceneKind: string;
  lastSource: string;
  guideMatch: string;
  status: string;
  guideId: string;
  zoneRu: string;
  zoneEn: string;
  reason: string;
  current: string;
  latest: string;
  release: string;
  error: string;
  matched: string;
  notMatched: string;
  yes: string;
  no: string;
};

const TEXT: Record<AppLanguage, DebugBundleText> = {
  ru: {
    title: 'Отладочный пакет POE2 Act Companion Overlay',
    app: 'Приложение',
    overlay: 'Оверлей',
    logHealth: 'Состояние лога',
    zone: 'Зона',
    update: 'Обновление',
    diagnostics: 'Диагностика',
    lastSafeLogLines: 'Последние безопасные строки лога',
    generatedAt: 'Создано',
    appVersion: 'Версия приложения',
    platform: 'Платформа',
    language: 'Язык',
    theme: 'Тема',
    visualFx: 'Визуальные эффекты',
    mode: 'режим',
    density: 'плотность',
    scale: 'масштаб',
    textSize: 'размер текста',
    opacity: 'прозрачность',
    fx: 'эффекты',
    timerOnly: 'только таймер',
    selectedLogPath: 'Выбранный путь к логу',
    watchedLogPath: 'Отслеживаемый путь к логу',
    logExists: 'Лог существует',
    logSize: 'Размер лога',
    watcherStatus: 'Статус watcher',
    watcherMessage: 'Сообщение watcher',
    lastReadAt: 'Последнее чтение',
    lastMatchedAt: 'Последнее совпадение',
    currentRawZone: 'Текущая сырая зона',
    sceneKind: 'Тип сцены',
    lastSource: 'Последний источник',
    guideMatch: 'Совпадение маршрута',
    status: 'статус',
    guideId: 'id маршрута',
    zoneRu: 'зона RU',
    zoneEn: 'зона EN',
    reason: 'причина',
    current: 'текущая',
    latest: 'последняя',
    release: 'релиз',
    error: 'ошибка',
    matched: 'найдено',
    notMatched: 'не найдено',
    yes: 'да',
    no: 'нет'
  },
  en: {
    title: 'POE2 Act Companion Overlay Debug Bundle',
    app: 'App',
    overlay: 'Overlay',
    logHealth: 'Log Health',
    zone: 'Zone',
    update: 'Update',
    diagnostics: 'Diagnostics',
    lastSafeLogLines: 'Last Safe Log Lines',
    generatedAt: 'Generated at',
    appVersion: 'App version',
    platform: 'Platform',
    language: 'Language',
    theme: 'Theme',
    visualFx: 'Visual FX',
    mode: 'mode',
    density: 'density',
    scale: 'scale',
    textSize: 'textSize',
    opacity: 'opacity',
    fx: 'fx',
    timerOnly: 'timerOnly',
    selectedLogPath: 'Selected log path',
    watchedLogPath: 'Watched log path',
    logExists: 'Log exists',
    logSize: 'Log size',
    watcherStatus: 'Watcher status',
    watcherMessage: 'Watcher message',
    lastReadAt: 'Last read at',
    lastMatchedAt: 'Last matched at',
    currentRawZone: 'Current raw zone',
    sceneKind: 'Scene kind',
    lastSource: 'Last source',
    guideMatch: 'Guide match',
    status: 'status',
    guideId: 'guideId',
    zoneRu: 'zoneRu',
    zoneEn: 'zoneEn',
    reason: 'reason',
    current: 'current',
    latest: 'latest',
    release: 'release',
    error: 'error',
    matched: 'matched',
    notMatched: 'not_matched',
    yes: 'yes',
    no: 'no'
  }
};

function basenameFromPath(value: string): string {
  const normalized = value.replace(/[\\/]+$/, '');
  const separatorIndex = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));

  return separatorIndex >= 0
    ? normalized.slice(separatorIndex + 1) || '<redacted>'
    : '<redacted>';
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength - 3))}...`
    : value;
}

function redactPathMatch(value: string): string {
  const separator = value.includes('\\') ? '\\' : '/';
  const basename = basenameFromPath(value);

  return basename && basename !== '<redacted>'
    ? `<redacted-path>${separator}${basename}`
    : '<redacted-path>';
}

export function redactSensitiveText(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value
    .replace(/(token|secret|password|passwd|authorization|auth|api[_-]?key)\s*[:=]\s*["']?[^"'\s,;]+/gi, '$1=<redacted>')
    .replace(/\b(?:ghp|github_pat|xox[baprs])_[A-Za-z0-9_=-]+/g, '<redacted>')
    .replace(/[A-Za-z]:\\(?:[^\\\r\n<>:"|?*]+\\)*[^\\\r\n<>:"|?*]*/g, redactPathMatch)
    .replace(/(?:\/Users\/|\/home\/|\/var\/folders\/|\/tmp\/|\/mnt\/|\/media\/)[^\s"'<>|]+/g, redactPathMatch)
    .replace(/Users[\\/][^\\/:\s]+/gi, 'Users\\<redacted>');
}

export function redactPathForDisplay(value: string | null | undefined): string {
  return redactSensitiveText(value?.trim() || null);
}

export function sanitizeDebugLogLines(
  lines: readonly string[],
  limit = DEBUG_BUNDLE_LOG_LINE_LIMIT
): string[] {
  const safeLimit = Math.max(0, Math.min(DEBUG_BUNDLE_LOG_LINE_LIMIT, Math.floor(limit)));

  return lines
    .slice(-safeLimit)
    .map((line) => truncateText(redactSensitiveText(line), DEBUG_BUNDLE_MAX_LOG_LINE_LENGTH));
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  return redactSensitiveText(String(value));
}

function boolValue(value: boolean | null | undefined, text: DebugBundleText): string {
  if (value === null || value === undefined) {
    return '—';
  }

  return value ? text.yes : text.no;
}

function formatKnownValue(value: unknown, language: AppLanguage): string {
  if (language === 'en') {
    return formatValue(value);
  }

  const stringValue = String(value ?? '');
  const values: Record<string, string> = {
    full: 'полный',
    timer_only: 'только таймер',
    compact: 'компактная',
    normal: 'обычная',
    detailed: 'подробная',
    off: 'выключены',
    subtle: 'слабые',
    rich: 'насыщенные',
    classic: 'классическая',
    dark_fantasy: 'тёмное фэнтези',
    gameplay: 'игровой мир',
    town: 'город',
    login: 'логин',
    inactive: 'неактивно',
    unknown: 'неизвестно',
    log: 'лог',
    simulation: 'симуляция',
    config: 'конфиг',
    ready: 'готов',
    missing: 'не найден',
    error: 'ошибка',
    idle: 'ожидание',
    checking: 'проверка',
    available: 'доступно',
    not_available: 'нет обновлений',
    downloading: 'загрузка',
    downloaded: 'загружено'
  };

  return values[stringValue] ?? formatValue(value);
}

function buildOverlaySummary(snapshot: AppSnapshot | null, language: AppLanguage, text: DebugBundleText): string {
  const config = snapshot?.config;
  const settings = config?.mainOverlaySettings;

  if (!config || !settings) {
    return '—';
  }

  return [
    `${text.mode}=${formatKnownValue(snapshot.runtime.overlayMode ?? settings.overlayMode, language)}`,
    `${text.density}=${formatKnownValue(config.overlayDensity, language)}`,
    `${text.scale}=${config.overlayScale}%`,
    `${text.textSize}=${config.overlayTextSize}`,
    `${text.opacity}=${Math.round(config.overlayOpacity * 100)}%`,
    `${text.fx}=${formatKnownValue(config.visualFxIntensity, language)}`,
    `${text.timerOnly}=${boolValue(settings.overlayTimerOnlyMode, text)}`
  ].join('; ');
}

function buildUpdateSummary(updateState: AutoUpdateState | null | undefined, language: AppLanguage, text: DebugBundleText): string {
  if (!updateState) {
    return '—';
  }

  return [
    `${text.status}=${formatKnownValue(updateState.status, language)}`,
    `${text.current}=${formatValue(updateState.currentVersion)}`,
    `${text.latest}=${formatValue(updateState.latestVersion)}`,
    `${text.release}=${formatValue(updateState.releaseName)}`,
    `${text.error}=${formatValue(updateState.errorMessage)}`
  ].join('; ');
}

function buildGuideMatchSummary(snapshot: AppSnapshot | null, text: DebugBundleText): string {
  const runtime = snapshot?.runtime;
  const guide = snapshot?.currentGuideEntry ?? snapshot?.currentZone.guide ?? null;

  return [
    `${text.status}=${guide ? text.matched : text.notMatched}`,
    `${text.guideId}=${formatValue(guide?.id ?? runtime?.lastMatchedGuideId)}`,
    `${text.zoneRu}=${formatValue(guide?.zone_ru ?? runtime?.lastMatchedZoneRu)}`,
    `${text.zoneEn}=${formatValue(guide?.zone_en ?? runtime?.lastMatchedZoneEn)}`,
    `${text.reason}=${formatValue(runtime?.lastMatcherReason)}`
  ].join('; ');
}

export function buildDebugBundle(options: DebugBundleOptions): DebugBundle {
  const {
    snapshot,
    appVersion,
    language,
    platform,
    updateState = null,
    now = new Date(),
    userAgent
  } = options;
  const config = snapshot?.config;
  const runtime = snapshot?.runtime;
  const labels = TEXT[language] ?? TEXT.ru;
  const safeDiagnostics = redactSensitiveText(
    options.diagnosticsText ??
    buildReportDiagnostics(snapshot, appVersion, language, { now, userAgent })
  );
  const safeLogLines = sanitizeDebugLogLines(options.logLines ?? []);
  const generatedAt = now.toISOString();
  const sections = [
    `# ${labels.title}`,
    '',
    `## ${labels.app}`,
    `${labels.generatedAt}: ${generatedAt}`,
    `${labels.appVersion}: ${formatValue(appVersion)}`,
    `${labels.platform}: ${formatValue(platform)}`,
    `${labels.language}: ${formatValue(language)}`,
    `${labels.theme}: ${formatKnownValue(config?.theme, language)}`,
    `${labels.visualFx}: ${formatKnownValue(config?.visualFxIntensity, language)}`,
    '',
    `## ${labels.overlay}`,
    buildOverlaySummary(snapshot, language, labels),
    '',
    `## ${labels.logHealth}`,
    `${labels.selectedLogPath}: ${redactPathForDisplay(config?.logFilePath)}`,
    `${labels.watchedLogPath}: ${redactPathForDisplay(runtime?.watchedLogPath)}`,
    `${labels.logExists}: ${boolValue(runtime?.logFileExists, labels)}`,
    `${labels.logSize}: ${formatValue(runtime?.logFileSize)}`,
    `${labels.watcherStatus}: ${formatKnownValue(runtime?.logWatcherStatus, language)}`,
    `${labels.watcherMessage}: ${formatValue(runtime?.logWatcherMessage)}`,
    `${labels.lastReadAt}: ${formatValue(runtime?.lastReadAt)}`,
    `${labels.lastMatchedAt}: ${formatValue(runtime?.lastMatchedAt)}`,
    '',
    `## ${labels.zone}`,
    `${labels.currentRawZone}: ${formatValue(snapshot?.currentZone.rawZoneName ?? runtime?.lastRawZoneName)}`,
    `${labels.sceneKind}: ${formatKnownValue(snapshot?.currentZone.sceneKind, language)}`,
    `${labels.lastSource}: ${formatKnownValue(runtime?.lastZoneSource, language)}`,
    `${labels.guideMatch}: ${buildGuideMatchSummary(snapshot, labels)}`,
    '',
    `## ${labels.update}`,
    buildUpdateSummary(updateState, language, labels),
    '',
    `## ${labels.diagnostics}`,
    safeDiagnostics,
    '',
    `## ${labels.lastSafeLogLines} (${safeLogLines.length}/${DEBUG_BUNDLE_LOG_LINE_LIMIT})`,
    safeLogLines.length > 0 ? safeLogLines.join('\n') : '—'
  ];
  const text = truncateText(sections.join('\n'), DEBUG_BUNDLE_MAX_TEXT_LENGTH);

  return {
    text,
    diagnosticsText: safeDiagnostics,
    logLines: safeLogLines,
    fileName: `poe2act-debug-bundle-${generatedAt.replace(/[:.]/g, '-')}.txt`
  };
}

export function normalizeDebugBundleExportText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  return normalized
    ? truncateText(normalized, DEBUG_BUNDLE_MAX_TEXT_LENGTH)
    : null;
}
