import type {
  AppLanguage,
  CurrentZoneState,
  GuideEntry,
  RuntimeState
} from '../shared/types';

export const LOG_HEALTH_STALE_AFTER_MS = 120_000;

export type ZoneRecognitionState =
  | 'matched'
  | 'log_active'
  | 'log_missing'
  | 'log_stale'
  | 'town'
  | 'known_no_guide'
  | 'unknown_zone';

export type ZoneRecognitionTone = 'ok' | 'neutral' | 'warning';

export type ZoneRecognitionView = {
  state: ZoneRecognitionState;
  tone: ZoneRecognitionTone;
  label: string;
  detail: string;
  sceneLabel: string;
  noGuideTitle: string;
  noGuideText: string;
  noGuideHint: string;
  companionSummary: string;
};

type LogHealthRuntime = Pick<
  RuntimeState,
  'logWatcherStatus' | 'watchedLogPath' | 'lastReadAt' | 'lastMatchedAt'
>;

type LogHealthZone = Pick<CurrentZoneState, 'rawZoneName' | 'sceneKind' | 'guide'>;

export type LogHealthSnapshot = {
  runtime: LogHealthRuntime;
  currentZone: LogHealthZone;
  currentGuideEntry?: GuideEntry | null;
};

type Copy = {
  logActive: string;
  logMissing: string;
  logStale: string;
  zoneMatched: string;
  waitingForZone: string;
  townDetected: string;
  knownNoGuide: string;
  unknownZone: string;
  noPreviousMatch: string;
  lastRead: (age: string) => string;
  lastMatched: (age: string) => string;
  justNow: string;
  secondsAgo: (value: number) => string;
  minutesAgo: (value: number) => string;
  sceneGameplay: string;
  sceneTown: string;
  sceneUnknown: string;
  missingTitle: string;
  missingText: string;
  missingHint: string;
  staleTitle: string;
  staleText: string;
  staleHint: string;
  townTitle: string;
  townText: (zone: string) => string;
  townHint: string;
  knownNoGuideTitle: string;
  knownNoGuideText: (zone: string) => string;
  knownNoGuideHint: string;
  unknownTitle: string;
  unknownText: (zone: string) => string;
  unknownHint: string;
  matchedSummary: string;
  activeSummary: string;
};

const COPY: Record<AppLanguage, Copy> = {
  ru: {
    logActive: 'Лог активен',
    logMissing: 'Лог не найден',
    logStale: 'Лог давно не обновлялся',
    zoneMatched: 'Зона распознана',
    waitingForZone: 'Ждём входа в зону',
    townDetected: 'Город/хаб',
    knownNoGuide: 'Зона без карточки',
    unknownZone: 'Неизвестная зона',
    noPreviousMatch: 'Маршрут ещё не совпадал',
    lastRead: (age) => `Последнее чтение: ${age}`,
    lastMatched: (age) => `Маршрут совпал: ${age}`,
    justNow: 'только что',
    secondsAgo: (value) => `${value} с назад`,
    minutesAgo: (value) => `${value} мин назад`,
    sceneGameplay: 'Игровая зона',
    sceneTown: 'Город/хаб',
    sceneUnknown: 'Неизвестная сцена',
    missingTitle: 'Лог-файл не читается',
    missingText: 'Выбери Client.txt или LatestClient.txt в настройках, затем зайди в любую зону.',
    missingHint: 'Оверлей не будет обновлять маршрут, пока лог не подключён.',
    staleTitle: 'Лог давно не обновлялся',
    staleText: 'Файл выбран, но оверлей давно не видел новых чтений из Client.txt.',
    staleHint: 'Если игра открыта, зайди в новую зону или перепроверь выбранный лог-файл.',
    townTitle: 'Обнаружен город или хаб',
    townText: (zone) => `${zone}: это безопасное состояние без карточки маршрута.`,
    townHint: 'Маршрут продолжится после входа в игровую зону.',
    knownNoGuideTitle: 'Для этой зоны нет карточки маршрута',
    knownNoGuideText: (zone) => `${zone} распознана из Client.txt, но в гайде для неё нет отдельной карточки.`,
    knownNoGuideHint: 'Можно продолжать: таймер и подробная панель остаются доступны.',
    unknownTitle: 'Неизвестная строка зоны из Client.txt',
    unknownText: (zone) => `Оверлей увидел "${zone}", но не смог сопоставить это с маршрутом.`,
    unknownHint: 'Если это повторяется в нужной зоне, отправь report с диагностикой.',
    matchedSummary: 'Маршрутная карточка активна.',
    activeSummary: 'Лог читается, ждём следующую маршрутную зону.'
  },
  en: {
    logActive: 'Log active',
    logMissing: 'Log missing',
    logStale: 'Log stale',
    zoneMatched: 'Zone matched',
    waitingForZone: 'Waiting for a zone',
    townDetected: 'Town/hub',
    knownNoGuide: 'No route card',
    unknownZone: 'Unknown zone',
    noPreviousMatch: 'No route match yet',
    lastRead: (age) => `Last read: ${age}`,
    lastMatched: (age) => `Route matched: ${age}`,
    justNow: 'just now',
    secondsAgo: (value) => `${value}s ago`,
    minutesAgo: (value) => `${value}m ago`,
    sceneGameplay: 'Gameplay zone',
    sceneTown: 'Town/hub',
    sceneUnknown: 'Unknown scene',
    missingTitle: 'Log file is not being read',
    missingText: 'Choose Client.txt or LatestClient.txt in Settings, then enter any zone.',
    missingHint: 'The overlay cannot update the route until the log is connected.',
    staleTitle: 'Log has not updated recently',
    staleText: 'A file is selected, but the overlay has not read Client.txt recently.',
    staleHint: 'If the game is open, enter a new zone or re-check the selected log file.',
    townTitle: 'Town or hub detected',
    townText: (zone) => `${zone}: this is a safe state without a route card.`,
    townHint: 'Route guidance resumes when you enter a gameplay zone.',
    knownNoGuideTitle: 'No route card for this zone',
    knownNoGuideText: (zone) => `${zone} was detected from Client.txt, but the guide has no separate card for it.`,
    knownNoGuideHint: 'You can keep running: the timer and detailed panel stay available.',
    unknownTitle: 'Unknown Client.txt zone line',
    unknownText: (zone) => `The overlay saw "${zone}", but could not match it to the route.`,
    unknownHint: 'If this repeats in a real route zone, send a report with diagnostics.',
    matchedSummary: 'Route card is active.',
    activeSummary: 'The log is being read; waiting for the next route zone.'
  }
};

function getCopy(language: AppLanguage): Copy {
  return COPY[language === 'en' ? 'en' : 'ru'];
}

function parseTimestampMs(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRelativeAge(timestamp: string | null, nowMs: number, copy: Copy): string | null {
  const timestampMs = parseTimestampMs(timestamp);
  if (timestampMs === null) {
    return null;
  }

  const ageMs = Math.max(0, nowMs - timestampMs);
  if (ageMs < 5_000) {
    return copy.justNow;
  }

  if (ageMs < 60_000) {
    return copy.secondsAgo(Math.max(1, Math.round(ageMs / 1000)));
  }

  return copy.minutesAgo(Math.max(1, Math.round(ageMs / 60_000)));
}

function isLogReadStale(runtime: LogHealthRuntime, nowMs: number): boolean {
  if (runtime.logWatcherStatus !== 'ready' || !runtime.watchedLogPath) {
    return false;
  }

  const lastReadMs = parseTimestampMs(runtime.lastReadAt);
  return lastReadMs !== null && nowMs - lastReadMs > LOG_HEALTH_STALE_AFTER_MS;
}

function getLastMatchDetail(runtime: LogHealthRuntime, nowMs: number, copy: Copy): string {
  const age = formatRelativeAge(runtime.lastMatchedAt, nowMs, copy);
  return age ? copy.lastMatched(age) : copy.noPreviousMatch;
}

function getZoneName(snapshot: LogHealthSnapshot, fallback: string): string {
  return snapshot.currentZone.rawZoneName?.trim() || fallback;
}

function makeView(
  state: ZoneRecognitionState,
  tone: ZoneRecognitionTone,
  label: string,
  detail: string,
  sceneLabel: string,
  noGuideTitle: string,
  noGuideText: string,
  noGuideHint: string,
  companionSummary: string
): ZoneRecognitionView {
  return {
    state,
    tone,
    label,
    detail,
    sceneLabel,
    noGuideTitle,
    noGuideText,
    noGuideHint,
    companionSummary
  };
}

export function getZoneRecognitionView(
  snapshot: LogHealthSnapshot,
  language: AppLanguage,
  nowMs = Date.now()
): ZoneRecognitionView {
  const copy = getCopy(language);
  const { runtime, currentZone } = snapshot;
  const guide = snapshot.currentGuideEntry ?? currentZone.guide;
  const zoneName = getZoneName(snapshot, copy.unknownZone);

  if (runtime.logWatcherStatus === 'missing' || runtime.logWatcherStatus === 'error') {
    return makeView(
      'log_missing',
      'warning',
      copy.logMissing,
      copy.waitingForZone,
      copy.sceneUnknown,
      copy.missingTitle,
      copy.missingText,
      copy.missingHint,
      copy.missingText
    );
  }

  if (isLogReadStale(runtime, nowMs)) {
    const age = formatRelativeAge(runtime.lastReadAt, nowMs, copy);
    return makeView(
      'log_stale',
      'warning',
      copy.logStale,
      age ? copy.lastRead(age) : copy.waitingForZone,
      copy.sceneUnknown,
      copy.staleTitle,
      copy.staleText,
      copy.staleHint,
      copy.staleText
    );
  }

  if (guide) {
    return makeView(
      'matched',
      'ok',
      copy.zoneMatched,
      getLastMatchDetail(runtime, nowMs, copy),
      copy.sceneGameplay,
      copy.zoneMatched,
      copy.matchedSummary,
      copy.logActive,
      copy.matchedSummary
    );
  }

  if (runtime.logWatcherStatus !== 'ready') {
    return makeView(
      'log_active',
      'neutral',
      copy.logActive,
      copy.waitingForZone,
      copy.sceneUnknown,
      copy.waitingForZone,
      copy.activeSummary,
      copy.missingHint,
      copy.activeSummary
    );
  }

  if (currentZone.sceneKind === 'town' && currentZone.rawZoneName) {
    return makeView(
      'town',
      'neutral',
      copy.townDetected,
      getLastMatchDetail(runtime, nowMs, copy),
      copy.sceneTown,
      copy.townTitle,
      copy.townText(zoneName),
      copy.townHint,
      copy.townHint
    );
  }

  if (currentZone.sceneKind === 'unknown' && currentZone.rawZoneName) {
    return makeView(
      'unknown_zone',
      'neutral',
      copy.unknownZone,
      getLastMatchDetail(runtime, nowMs, copy),
      copy.sceneUnknown,
      copy.unknownTitle,
      copy.unknownText(zoneName),
      copy.unknownHint,
      copy.unknownText(zoneName)
    );
  }

  if (currentZone.rawZoneName) {
    return makeView(
      'known_no_guide',
      'neutral',
      copy.knownNoGuide,
      getLastMatchDetail(runtime, nowMs, copy),
      copy.sceneGameplay,
      copy.knownNoGuideTitle,
      copy.knownNoGuideText(zoneName),
      copy.knownNoGuideHint,
      copy.knownNoGuideText(zoneName)
    );
  }

  return makeView(
    'log_active',
    'ok',
    copy.logActive,
    copy.waitingForZone,
    copy.sceneUnknown,
    copy.waitingForZone,
    copy.activeSummary,
    copy.missingHint,
    copy.activeSummary
  );
}
