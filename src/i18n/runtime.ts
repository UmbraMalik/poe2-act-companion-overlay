import type { AppLanguage, LogWatcherStatus, ZoneMatcherReason } from '../shared/types';
import { translate } from './translations';

const SYSTEM_TEXT_KEYS = new Map<string, string>([
  ['Ожидание лог-файла', 'system.logWatcher.waiting'],
  ['Waiting for the log file', 'system.logWatcher.waiting'],
  ['Чтение лога активно', 'system.logWatcher.ready'],
  ['Log reading is active', 'system.logWatcher.ready'],
  ['Лог-файл не найден', 'system.logWatcher.missing'],
  ['Log file not found', 'system.logWatcher.missing'],
  ['Лог-файл не найден. Выберите Client.txt или LatestClient.txt вручную.', 'system.logWatcher.missingManual'],
  ['Log file not found. Choose Client.txt or LatestClient.txt manually.', 'system.logWatcher.missingManual'],
  ['Ошибка чтения лог-файла', 'system.logWatcher.readError'],
  ['Error reading the log file', 'system.logWatcher.readError'],
  ['Preview mode', 'system.logWatcher.preview'],
  ['Режим предпросмотра', 'system.logWatcher.preview'],
  ['Не удалось проверить обновления. Проверь интернет/VPN или попробуй позже.', 'system.autoUpdate.generic'],
  ['Could not check for updates. Check your internet/VPN or try again later.', 'system.autoUpdate.generic'],
  ['Не удалось проверить автообновление: в последнем релизе не найден latest.yml. Проверь assets релиза.', 'system.autoUpdate.latestYml'],
  ['Could not check auto-update: latest.yml was not found in the latest release. Check the release assets.', 'system.autoUpdate.latestYml'],
  ['Новая версия найдена, но автоматическое обновление недоступно. Если приложение уже было открыто, а потом включался VPN, отключи VPN и нажми “Проверить обновления” ещё раз. Либо открой релиз и скачай установщик вручную.', 'system.autoUpdate.installerFallback'],
  ['A new version was found, but automatic update is unavailable. If the app was already open and a VPN was enabled afterwards, disable the VPN and click “Check for updates” again. Or open the release page and download the installer manually.', 'system.autoUpdate.installerFallback'],
  ['Не удалось проверить обновления: GitHub вернул 404 для файла обновления.', 'system.autoUpdate.github404'],
  ['Could not check for updates: GitHub returned 404 for the update file.', 'system.autoUpdate.github404'],
  ['Не удалось проверить или скачать обновление.', 'system.autoUpdate.checkOrDownload'],
  ['Could not check or download the update.', 'system.autoUpdate.checkOrDownload'],
  ['Не удалось скачать обновление.', 'system.autoUpdate.downloadFailed'],
  ['Could not download the update.', 'system.autoUpdate.downloadFailed'],
  ['В релизе не найден установщик.', 'system.autoUpdate.installerNotFound'],
  ['The installer was not found in the release.', 'system.autoUpdate.installerNotFound'],
  ['Не удалось загрузить guide.json', 'main.guideLoadError'],
  ['Could not load guide.json', 'main.guideLoadError']
]);

const SYSTEM_TEXT_FRAGMENTS = [...SYSTEM_TEXT_KEYS.entries()].sort(
  (left, right) => right[0].length - left[0].length
);

function normalizeSystemText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function translateSystemText(
  value: string | null | undefined,
  language: AppLanguage
): string {
  const raw = String(value ?? '');
  const normalized = normalizeSystemText(raw);

  if (!normalized) {
    return raw;
  }

  const directKey = SYSTEM_TEXT_KEYS.get(normalized);
  if (directKey) {
    return translate(language, directKey);
  }

  let translatedValue = raw;

  for (const [fragment, key] of SYSTEM_TEXT_FRAGMENTS) {
    if (translatedValue.includes(fragment)) {
      translatedValue = translatedValue.split(fragment).join(translate(language, key));
    }
  }

  return translatedValue;
}

export function formatZoneMatcherReason(
  reason: ZoneMatcherReason | string | null | undefined,
  language: AppLanguage
): string {
  switch (reason) {
    case 'zone_ru':
      return translate(language, 'matcherReasons.zone_ru');
    case 'zone_en':
      return translate(language, 'matcherReasons.zone_en');
    case 'alias':
      return translate(language, 'matcherReasons.alias');
    case 'internal_area':
      return translate(language, 'matcherReasons.internal_area');
    default:
      return translate(language, 'matcherReasons.none');
  }
}

export function formatLogWatcherStatus(
  status: LogWatcherStatus | string | null | undefined,
  language: AppLanguage
): string {
  switch (status) {
    case 'ready':
      return translate(language, 'system.logWatcherStatus.ready');
    case 'missing':
      return translate(language, 'system.logWatcherStatus.missing');
    case 'error':
      return translate(language, 'system.logWatcherStatus.error');
    default:
      return translate(language, 'system.logWatcherStatus.idle');
  }
}
