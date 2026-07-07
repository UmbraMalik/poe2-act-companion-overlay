import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getZoneRecognitionView,
  LOG_HEALTH_STALE_AFTER_MS,
  type LogHealthSnapshot
} from '../src/renderer/log-health';

const NOW_MS = Date.parse('2026-07-08T12:00:00.000Z');

function isoAgo(ms: number): string {
  return new Date(NOW_MS - ms).toISOString();
}

type LogHealthSnapshotOverrides = Omit<Partial<LogHealthSnapshot>, 'runtime' | 'currentZone'> & {
  runtime?: Partial<LogHealthSnapshot['runtime']>;
  currentZone?: Partial<LogHealthSnapshot['currentZone']>;
};

function makeSnapshot(
  overrides: LogHealthSnapshotOverrides = {}
): LogHealthSnapshot {
  const runtime: LogHealthSnapshot['runtime'] = {
    logWatcherStatus: 'ready',
    watchedLogPath: 'C:\\Games\\Path of Exile 2\\logs\\Client.txt',
    lastReadAt: isoAgo(10_000),
    lastMatchedAt: isoAgo(20_000),
    ...overrides.runtime
  };
  const currentZone: LogHealthSnapshot['currentZone'] = {
    rawZoneName: null,
    sceneKind: 'inactive',
    guide: null,
    ...overrides.currentZone
  };

  return {
    runtime,
    currentZone,
    currentGuideEntry: overrides.currentGuideEntry ?? null
  };
}

test('zone recognition view separates log active, missing, stale and matched states', () => {
  const active = getZoneRecognitionView(makeSnapshot(), 'en', NOW_MS);
  assert.equal(active.state, 'log_active');
  assert.equal(active.label, 'Log active');
  assert.equal(active.tone, 'ok');

  const missing = getZoneRecognitionView(
    makeSnapshot({
      runtime: {
        logWatcherStatus: 'missing',
        watchedLogPath: null
      }
    }),
    'en',
    NOW_MS
  );
  assert.equal(missing.state, 'log_missing');
  assert.equal(missing.label, 'Log missing');
  assert.equal(missing.tone, 'warning');
  assert.match(missing.noGuideText, /Choose Client\.txt/);

  const stale = getZoneRecognitionView(
    makeSnapshot({
      runtime: {
        lastReadAt: isoAgo(LOG_HEALTH_STALE_AFTER_MS + 1_000)
      }
    }),
    'en',
    NOW_MS
  );
  assert.equal(stale.state, 'log_stale');
  assert.equal(stale.label, 'Log stale');
  assert.equal(stale.tone, 'warning');
  assert.match(stale.detail, /Last read:/);

  const matched = getZoneRecognitionView(
    makeSnapshot({
      currentGuideEntry: {} as never
    }),
    'en',
    NOW_MS
  );
  assert.equal(matched.state, 'matched');
  assert.equal(matched.label, 'Zone matched');
  assert.equal(matched.tone, 'ok');
});

test('zone recognition view separates town, known no-guide and unknown zone copy', () => {
  const town = getZoneRecognitionView(
    makeSnapshot({
      currentZone: {
        rawZoneName: 'Clearfell Encampment',
        sceneKind: 'town',
        guide: null
      }
    }),
    'en',
    NOW_MS
  );
  assert.equal(town.state, 'town');
  assert.equal(town.label, 'Town/hub');
  assert.match(town.noGuideText, /safe state/);
  assert.equal(town.sceneLabel, 'Town/hub');

  const noGuide = getZoneRecognitionView(
    makeSnapshot({
      currentZone: {
        rawZoneName: 'Forgotten Causeway',
        sceneKind: 'gameplay',
        guide: null
      }
    }),
    'en',
    NOW_MS
  );
  assert.equal(noGuide.state, 'known_no_guide');
  assert.equal(noGuide.label, 'No route card');
  assert.match(noGuide.noGuideText, /no separate card/);
  assert.equal(noGuide.sceneLabel, 'Gameplay zone');

  const unknown = getZoneRecognitionView(
    makeSnapshot({
      currentZone: {
        rawZoneName: 'G9_strange_area',
        sceneKind: 'unknown',
        guide: null
      }
    }),
    'en',
    NOW_MS
  );
  assert.equal(unknown.state, 'unknown_zone');
  assert.equal(unknown.label, 'Unknown zone');
  assert.match(unknown.noGuideText, /could not match/);
  assert.equal(unknown.sceneLabel, 'Unknown scene');
});
