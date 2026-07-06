import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { DEFAULT_CONFIG, DEFAULT_HOTKEYS } from '../src/shared/defaults';
import { ConfigStore, normalizeAppConfig } from '../src/main/services/config-store';
import { readMainProcessSource, readText } from './helpers/loadJson';

test('normalizeAppConfig keeps defaults, custom settings and strips legacy unknown fields', () => {
  const normalized = normalizeAppConfig({
    logFilePath: 'C:\\temp\\LatestClient.txt',
    overlayOpacity: 0.5,
    overlayScale: 120,
    overlayDensity: 'compact',
    visualFxIntensity: 'rich',
    overlayEffectsEnabled: false,
    theme: 'dark_fantasy',
    overlayDebugLayoutEnabled: true,
    overlayMovementLocked: true,
    realtimePriorityEnabled: true,
    hotkeys: {
      openCompanion: 'Ctrl+F9'
    },
    oldSupportBlock: true
  } as never);

  assert.equal(normalized.logFilePath, 'C:\\temp\\LatestClient.txt');
  assert.equal(normalized.overlayOpacity, 0.5);
  assert.equal(normalized.overlayScale, 120);
  assert.equal(normalized.overlayDensity, 'compact');
  assert.equal(normalized.visualFxIntensity, 'rich');
  assert.equal(normalized.overlayEffectsEnabled, false);
  assert.equal(normalized.theme, 'dark_fantasy');
  assert.equal(normalized.overlayDebugLayoutEnabled, true);
  assert.equal(normalized.overlayMovementLocked, true);
  assert.equal(normalized.realtimePriorityEnabled, true);
  assert.equal(normalized.hotkeys.openCompanion, 'Ctrl+F9');
  assert.equal(normalized.hotkeys.toggleOverlayMode, DEFAULT_HOTKEYS.toggleOverlayMode);
  assert.equal('oldSupportBlock' in (normalized as unknown as Record<string, unknown>), false);
});


test('normalizeAppConfig hardens corrupted user config values', () => {
  const normalized = normalizeAppConfig({
    currentLevel: -42,
    overlayScale: 999,
    overlayDensity: 'gigantic',
    visualFxIntensity: 'casino',
    overlayEffectsEnabled: 'no',
    theme: 'neon',
    overlayDebugLayoutEnabled: 'yes',
    overlayOpacity: 5,
    realtimePriorityEnabled: 'yes',
    overlayBounds: {
      x: 999999,
      y: -999999,
      width: 1,
      height: 1
    },
    companionBounds: {
      x: 0,
      y: 0,
      width: 10,
      height: 20
    },
    overlayVisibleSections: {
      rewards: 'yes',
      important: false,
      zoneInfo: false,
      league: 'bad'
    },
    mainOverlaySettings: {
      overlayMode: 'floating',
      showOverlayBossTip: 'yes'
    },
    hotkeys: {
      markChecklistDone: 'A',
      undoChecklistMark: null,
      toggleTimerPause: 'Alt+Q',
      openCompanion: 'Ctrl+F9',
      toggleOverlayMode: 'Shift+F8'
    },
    trainingTargetActTimes: {
      act1: -1,
      act2: 999999999999
    },
    runTimer: {
      status: 'teleporting',
      elapsedMs: -100,
      startedAt: -1,
      pauseCount: -5,
      actSplits: [
        { act: 1, elapsedMs: 1234, timestamp: 1700000000000 },
        { act: 'wrong', elapsedMs: -1, timestamp: -1 }
      ]
    },
    townTimer: {
      isInTown: 'yes',
      currentTownElapsedMs: -100,
      totalTownElapsedMs: Number.POSITIVE_INFINITY,
      townVisits: [
        { townName: 'Clearfell', enteredAt: 1700000000000, leftAt: null, elapsedMs: 5000 },
        { townName: 123, enteredAt: -1, elapsedMs: -10 }
      ]
    },
    runTimerSettings: {
      autoStartMode: 'broken',
      leagueStartAt: -1,
      leagueStartTimeLabel: 123,
      autoStart: 'yes',
      showZoneTimer: false
    }
  } as never);

  assert.equal(normalized.currentLevel, DEFAULT_CONFIG.currentLevel);
  assert.equal(normalized.overlayScale, 120);
  assert.equal(normalized.overlayDensity, DEFAULT_CONFIG.overlayDensity);
  assert.equal(normalized.visualFxIntensity, DEFAULT_CONFIG.visualFxIntensity);
  assert.equal(normalized.overlayEffectsEnabled, DEFAULT_CONFIG.overlayEffectsEnabled);
  assert.equal(normalized.theme, DEFAULT_CONFIG.theme);
  assert.equal(normalized.overlayDebugLayoutEnabled, DEFAULT_CONFIG.overlayDebugLayoutEnabled);
  assert.equal(normalized.overlayOpacity, 1);
  assert.equal(normalized.realtimePriorityEnabled, DEFAULT_CONFIG.realtimePriorityEnabled);
  assert.deepEqual(normalized.overlayBounds, {
    x: 10000,
    y: -10000,
    width: 160,
    height: 90
  });
  assert.deepEqual(normalized.companionBounds, {
    x: 0,
    y: 0,
    width: 420,
    height: 320
  });
  assert.equal(normalized.overlayVisibleSections.rewards, DEFAULT_CONFIG.overlayVisibleSections.rewards);
  assert.equal(normalized.overlayVisibleSections.important, false);
  assert.equal(normalized.overlayVisibleSections.zoneInfo, false);
  assert.equal(normalized.overlayVisibleSections.league, DEFAULT_CONFIG.overlayVisibleSections.league);
  assert.equal(normalized.mainOverlaySettings.overlayMode, DEFAULT_CONFIG.mainOverlaySettings.overlayMode);
  assert.equal(normalized.mainOverlaySettings.showOverlayBossTip, DEFAULT_CONFIG.mainOverlaySettings.showOverlayBossTip);
  assert.equal(normalized.hotkeys.markChecklistDone, DEFAULT_HOTKEYS.markChecklistDone);
  assert.equal(normalized.hotkeys.undoChecklistMark, DEFAULT_HOTKEYS.undoChecklistMark);
  assert.equal(normalized.hotkeys.toggleTimerPause, 'Alt+Q');
  assert.equal(normalized.hotkeys.openCompanion, 'Ctrl+F9');
  assert.equal(normalized.hotkeys.toggleOverlayMode, 'Shift+F8');
  assert.equal(normalized.trainingTargetActTimes.act1, null);
  assert.equal(normalized.trainingTargetActTimes.act2, 86400000);
  assert.equal(normalized.runTimer.status, DEFAULT_CONFIG.runTimer.status);
  assert.equal(normalized.runTimer.elapsedMs, 0);
  assert.equal(normalized.runTimer.startedAt, null);
  assert.equal(normalized.runTimer.pauseCount, 0);
  assert.deepEqual(normalized.runTimer.actSplits, [
    { act: 1, elapsedMs: 1234, timestamp: 1700000000000 }
  ]);
  assert.equal(normalized.townTimer.isInTown, DEFAULT_CONFIG.townTimer.isInTown);
  assert.equal(normalized.townTimer.currentTownElapsedMs, 0);
  assert.equal(normalized.townTimer.totalTownElapsedMs, 0);
  assert.deepEqual(normalized.townTimer.townVisits, [
    { townName: 'Clearfell', enteredAt: 1700000000000, leftAt: null, elapsedMs: 5000 }
  ]);
  assert.equal(normalized.runTimerSettings.autoStartMode, 'scheduled_time');
  assert.equal(normalized.runTimerSettings.leagueStartAt, null);
  assert.equal(normalized.runTimerSettings.leagueStartTimeLabel, null);
  assert.equal(normalized.runTimerSettings.autoStart, DEFAULT_CONFIG.runTimerSettings.autoStart);
  assert.equal(normalized.runTimerSettings.showZoneTimer, false);
});

test('normalizeAppConfig drops corrupted checklist and campaign bonus progress entries', () => {
  const normalized = normalizeAppConfig({
    zoneProgress: {
      a1_clearfell: {
        itemStates: {
          valid_done: {
            state: 'done',
            timestamp: '2026-01-01T00:00:00.000Z',
            detectedBy: 'manual',
            originalText: 'Done reward'
          },
          valid_missed: {
            state: 'missed',
            timestamp: '2026-01-01T00:01:00.000Z',
            detectedBy: 'inferred_zone_leave',
            originalText: 'Missed reward'
          },
          missing_original_text: {
            state: 'likely_done',
            timestamp: '2026-01-01T00:02:00.000Z',
            detectedBy: 'zone_leave'
          },
          bad_state: {
            state: 'banana',
            timestamp: '2026-01-01T00:03:00.000Z',
            detectedBy: 'manual',
            originalText: 'Bad state'
          },
          bad_detected_by: {
            state: 'done',
            timestamp: '2026-01-01T00:04:00.000Z',
            detectedBy: 'screen_reader',
            originalText: 'Bad detector'
          },
          bad_timestamp: {
            state: 'done',
            timestamp: 123,
            detectedBy: 'manual',
            originalText: 'Bad timestamp'
          }
        },
        likelyDoneKeywords: ['reward', 123, 'boss'],
        lastVisitedAt: 123
      },
      broken_zone: null
    },
    campaignBonusProgress: {
      valid_manual: {
        state: 'done',
        timestamp: '2026-01-01T00:00:00.000Z',
        detectedBy: 'manual'
      },
      valid_log: {
        state: 'done',
        timestamp: '2026-01-01T00:01:00.000Z',
        detectedBy: 'log',
        logLine: 'You have gained a permanent bonus'
      },
      bad_state: {
        state: 'missed',
        timestamp: '2026-01-01T00:02:00.000Z',
        detectedBy: 'manual'
      },
      bad_detected_by: {
        state: 'done',
        timestamp: '2026-01-01T00:03:00.000Z',
        detectedBy: 'zone_leave'
      },
      bad_timestamp: {
        state: 'done',
        timestamp: 123,
        detectedBy: 'manual'
      }
    }
  } as never);

  assert.deepEqual(Object.keys(normalized.zoneProgress), ['a1_clearfell']);
  assert.deepEqual(Object.keys(normalized.zoneProgress.a1_clearfell.itemStates), [
    'valid_done',
    'valid_missed',
    'missing_original_text'
  ]);
  assert.equal(normalized.zoneProgress.a1_clearfell.itemStates.missing_original_text.originalText, '');
  assert.deepEqual(normalized.zoneProgress.a1_clearfell.likelyDoneKeywords, ['reward', 'boss']);
  assert.equal(normalized.zoneProgress.a1_clearfell.lastVisitedAt, null);
  assert.deepEqual(Object.keys(normalized.campaignBonusProgress), ['valid_manual', 'valid_log']);
  assert.equal(normalized.campaignBonusProgress.valid_log.logLine, 'You have gained a permanent bonus');
});

test('ConfigStore persists log path and merges settings safely', () => {
  const configPath = join(
    process.cwd(),
    '.tmp-tests',
    `settings-config-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
  );

  const store = new ConfigStore(configPath);
  const loaded = store.load();
  assert.equal(loaded.logFilePath, DEFAULT_CONFIG.logFilePath);

  store.update({
    logFilePath: 'Z:\\invalid\\LatestClient.txt',
    logFileSelectionMode: 'manual'
  });
  store.updateSettings({
    overlayOpacity: 0.77,
    overlayScale: 110,
    overlayMovementLocked: true,
    overlayEffectsEnabled: false,
    theme: 'dark_fantasy',
    realtimePriorityEnabled: true,
    hotkeys: {
      openCompanion: 'Ctrl+F9'
    }
  });

  const reloaded = new ConfigStore(configPath).load();
  assert.equal(reloaded.logFilePath, 'Z:\\invalid\\LatestClient.txt');
  assert.equal(reloaded.logFileSelectionMode, 'manual');
  assert.equal(reloaded.overlayOpacity, 0.77);
  assert.equal(reloaded.overlayScale, 110);
  assert.equal(reloaded.overlayMovementLocked, true);
  assert.equal(reloaded.overlayEffectsEnabled, false);
  assert.equal(reloaded.theme, 'dark_fantasy');
  assert.equal(reloaded.realtimePriorityEnabled, true);
  assert.equal(reloaded.hotkeys.openCompanion, 'Ctrl+F9');
  assert.equal(reloaded.hotkeys.toggleOverlayMode, DEFAULT_HOTKEYS.toggleOverlayMode);
});

test('settings page keeps hotkey settings but no longer embeds reload-guide or support-link UI blocks', () => {
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');

  assert.match(settingsPage, /toggleOverlayMode/);
  assert.match(settingsPage, /overlayEffectsEnabled/);
  assert.match(settingsPage, /realtimePriorityEnabled/);
  assert.match(settingsPage, /openCompanion/);
  assert.doesNotMatch(settingsPage, /Открепить|Закрепить/);
  assert.doesNotMatch(settingsPage, /reloadGuide\s*\(/);
  assert.doesNotMatch(settingsPage, /guide\.json/i);
  assert.doesNotMatch(settingsPage, /support-qr/i);
  assert.doesNotMatch(settingsPage, /https:\/\/t\.me\/POE2ActCompanion/i);
  assert.doesNotMatch(settingsPage, /https:\/\/umbramalik\.github\.io\/poe2-act-companion-overlay\//i);
});

test('support and community stay separate windows instead of a settings-only block', () => {
  const mainSource = readMainProcessSource();

  assert.match(mainSource, /app:open-community/);
  assert.match(mainSource, /app:open-support/);
  assert.match(mainSource, /openCommunityWindow/);
  assert.match(mainSource, /openSupportWindow/);
});

test('settings defaults keep safe overlay bounds and hotkeys visible in user settings', () => {
  assert.equal(DEFAULT_CONFIG.overlayOpacity >= 0.35, true);
  assert.equal(DEFAULT_CONFIG.overlayOpacity <= 1, true);
  assert.deepEqual(DEFAULT_CONFIG.hotkeys, DEFAULT_HOTKEYS);

  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  assert.match(settingsPage, /min=\{35\}/);
  assert.match(settingsPage, /max=\{100\}/);
  for (const scale of [70, 80, 90, 100, 110, 120]) {
    assert.match(settingsPage, new RegExp(`<option value=\\{${scale}\\}>${scale}%<\\/option>`));
  }
});
