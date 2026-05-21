import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
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
      missedWarningItems: []
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
