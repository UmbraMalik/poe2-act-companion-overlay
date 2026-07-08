import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import {
  DEBUG_BUNDLE_LOG_LINE_LIMIT,
  buildDebugBundle,
  redactPathForDisplay,
  redactSensitiveText,
  sanitizeDebugLogLines
} from '../src/shared/debug-bundle';
import {
  buildReportDiagnostics,
  buildReportTemplateBody,
  PROJECT_FEEDBACK_URL,
  getReportTemplateLabels,
  type ReportTemplate
} from '../src/shared/report-issue';
import type { AppSnapshot } from '../src/shared/types';

function makeSnapshot(): AppSnapshot {
  return {
    config: {
      ...DEFAULT_CONFIG,
      logFilePath: 'C:\\Logs\\LatestClient.txt',
      currentLevel: 42,
      runTimer: {
        ...DEFAULT_CONFIG.runTimer,
        status: 'running',
        elapsedMs: 123_000,
        pauseCount: 1
      }
    },
    currentZone: {
      rawZoneName: 'The Khari Crossing',
      guide: null,
      sceneKind: 'unknown',
      actHint: 5
    },
    currentGuideEntry: {
      id: 'interlude_khari_crossing',
      act: 5,
      zone_en: 'The Khari Crossing',
      zone_ru: 'Кхарийский перевал',
      recommended_level: 64,
      recommended_level_label: '64',
      is_good_xp_zone: false,
      priority: [],
      rewards: [],
      skip: [],
      important: [],
      after: [],
      next_zone_ru: 'Храм Селхари',
      keywords_done: []
    },
    currentZoneProgress: null,
    currentChecklist: [],
    guideEntries: [],
    vendorCheckpoints: [],
    powerSpikes: [],
    campaignBonuses: [],
    activeLevelReminder: null,
    runtime: {
      timerNowMs: 0,
      guideLoadedAt: '2026-05-17T12:00:00.000Z',
      lastLogLine: '[SCENE] Set Source [The Khari Crossing]',
      lastRawZoneName: 'The Khari Crossing',
      lastMatchedZoneEn: 'The Khari Crossing',
      lastMatchedZoneRu: 'Кхарийский перевал',
      lastMatchedGuideId: 'interlude_khari_crossing',
      lastZoneSource: 'log',
      logWatcherStatus: 'ready',
      logWatcherMessage: 'ready',
      logFileExists: true,
      logFileSize: 1000,
      watchedLogPath: 'C:\\Logs\\LatestClient.txt',
      currentLogOffset: 1000,
      lastAppendedLine: '[SCENE] Set Source [The Khari Crossing]',
      watcherLastMatchedZone: 'Кхарийский перевал',
      lastWatcherUpdateAt: '2026-05-17T12:00:00.000Z',
      lastReadAt: '2026-05-17T12:00:00.000Z',
      lastMatchedAt: '2026-05-17T12:00:00.000Z',
      lastMatcherReason: 'internal_area',
      lastLevelUpDetectedAt: null,
      lastLogLineAt: '2026-05-17T12:00:00.000Z',
      lastValidGameplayZoneAt: '2026-05-17T12:00:00.000Z',
      lastGameplayGuideId: 'interlude_khari_crossing',
      lastGameplayZoneRu: 'Кхарийский перевал',
      lastGameplayAct: 5,
      lastSceneSource: 'The Khari Crossing',
      lastSceneSourceAt: '2026-05-17T12:00:00.000Z',
      overlayMode: 'full',
      missedWarningZoneRu: null,
      missedWarningItems: [],
      endgameT15CompletionNotice: null
    }
  };
}

test('all report templates stay available and non-empty', () => {
  const diagnostics = buildReportDiagnostics(makeSnapshot(), '0.2.3', 'ru', {
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });

  for (const template of Object.keys(getReportTemplateLabels('ru')) as ReportTemplate[]) {
    const body = buildReportTemplateBody(template, diagnostics, 'ru');
    assert.ok(body.length > 40, `${template} template must not be empty`);
    assert.match(body, /Диагностика/);
  }
});

test('report diagnostics include version, overlay mode, zone and log information', () => {
  const diagnostics = buildReportDiagnostics(makeSnapshot(), '0.2.3', 'ru', {
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });

  assert.match(diagnostics, /Версия приложения: 0\.2\.3/);
  assert.match(diagnostics, /Текущая зона: Кхарийский перевал \/ The Khari Crossing/);
  assert.match(diagnostics, /Путь к логу: C:\\Logs\\LatestClient\.txt/);
  assert.match(diagnostics, /OS\/UserAgent: RegressionSuite\/1\.0/);
});

test('Telegram direct feedback link stays the expected project URL', () => {
  assert.equal(PROJECT_FEEDBACK_URL, 'https://t.me/POE2ActCompanion?direct');
});

test('debug bundle redacts Windows usernames, absolute paths and secrets', () => {
  const redacted = redactSensitiveText(
    'Path=C:\\Users\\UmbraMalik\\Documents\\My Games\\Path of Exile 2\\logs\\Client.txt token=super-secret'
  );

  assert.doesNotMatch(redacted, /UmbraMalik/);
  assert.doesNotMatch(redacted, /C:\\Users\\UmbraMalik/);
  assert.doesNotMatch(redacted, /super-secret/);
  assert.match(redacted, /<redacted/);
  assert.match(redactPathForDisplay('C:\\Users\\UmbraMalik\\Logs\\LatestClient.txt'), /LatestClient\.txt/);
});

test('debug bundle is a redacted summary and does not dump full raw config', () => {
  const snapshot = makeSnapshot();
  const bundle = buildDebugBundle({
    snapshot,
    appVersion: '0.2.3',
    language: 'en',
    platform: 'Windows x64',
    updateState: {
      status: 'error',
      currentVersion: '0.2.3',
      latestVersion: '0.2.4',
      errorMessage: 'Failed path C:\\Users\\UmbraMalik\\Downloads\\update.yml'
    },
    logLines: [
      '2026/05/17 path C:\\Users\\UmbraMalik\\Documents\\Client.txt',
      '2026/05/17 [SCENE] Set Source [The Khari Crossing]'
    ],
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });

  assert.match(bundle.text, /App version: 0\.2\.3/);
  assert.match(bundle.text, /Platform: Windows x64/);
  assert.match(bundle.text, /Language: en/);
  assert.match(bundle.text, /Theme: classic/);
  assert.match(bundle.text, /Watcher status: ready/);
  assert.match(bundle.text, /Guide match: status=matched/);
  assert.match(bundle.text, /status=error/);
  assert.doesNotMatch(bundle.text, /UmbraMalik/);
  assert.doesNotMatch(bundle.text, /C:\\Logs\\LatestClient\.txt/);
  assert.doesNotMatch(bundle.text, /C:\\Users\\UmbraMalik/);
  assert.doesNotMatch(bundle.text, /"runHistory"|runHistory:/);
  assert.doesNotMatch(bundle.text, /"guideEntries"|guideEntries:/);
});

test('debug bundle preview text follows the selected app language', () => {
  const ruBundle = buildDebugBundle({
    snapshot: makeSnapshot(),
    appVersion: '0.2.3',
    language: 'ru',
    platform: 'Windows',
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });
  const enBundle = buildDebugBundle({
    snapshot: makeSnapshot(),
    appVersion: '0.2.3',
    language: 'en',
    platform: 'Windows',
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });

  assert.match(ruBundle.text, /# Отладочный пакет POE2 Act Companion Overlay/);
  assert.match(ruBundle.text, /## Приложение/);
  assert.match(ruBundle.text, /Версия приложения: 0\.2\.3/);
  assert.match(ruBundle.text, /Выбранный путь к логу:/);
  assert.match(ruBundle.text, /Совпадение маршрута: статус=найдено/);
  assert.doesNotMatch(ruBundle.text, /## App|Selected log path|Guide match:/);

  assert.match(enBundle.text, /# POE2 Act Companion Overlay Debug Bundle/);
  assert.match(enBundle.text, /## App/);
  assert.match(enBundle.text, /App version: 0\.2\.3/);
  assert.match(enBundle.text, /Selected log path:/);
  assert.match(enBundle.text, /Guide match: status=matched/);
});

test('debug bundle limits copied log tail to the last safe lines', () => {
  const lines = Array.from({ length: DEBUG_BUNDLE_LOG_LINE_LIMIT + 5 }, (_item, index) =>
    `line-${index} C:\\Users\\UmbraMalik\\Logs\\Client.txt`
  );
  const safeLines = sanitizeDebugLogLines(lines);
  const bundle = buildDebugBundle({
    snapshot: makeSnapshot(),
    appVersion: '0.2.3',
    language: 'ru',
    platform: 'Windows',
    logLines: lines,
    now: new Date('2026-05-17T12:30:00.000Z'),
    userAgent: 'RegressionSuite/1.0'
  });

  assert.equal(safeLines.length, DEBUG_BUNDLE_LOG_LINE_LIMIT);
  assert.equal(bundle.logLines.length, DEBUG_BUNDLE_LOG_LINE_LIMIT);
  assert.doesNotMatch(bundle.text, /line-0\b/);
  assert.match(bundle.text, new RegExp(`line-${DEBUG_BUNDLE_LOG_LINE_LIMIT + 4}\\b`));
  assert.doesNotMatch(bundle.text, /UmbraMalik/);
});
