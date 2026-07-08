import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import type { AppConfig, SettingsPatch } from '../src/shared/types';
import {
  buildOverlayPresetPatch,
  formatOverlayPresetLabel,
  formatOverlayPresetState,
  getMatchingOverlayPreset,
  OVERLAY_PRESET_IDS
} from '../src/renderer/overlay-presets';

const ALLOWED_TOP_LEVEL_KEYS = new Set<keyof SettingsPatch>([
  'overlayOpacity',
  'overlayScale',
  'overlayDensity',
  'visualFxIntensity',
  'overlayEffectsEnabled',
  'overlayVisibleSections',
  'mainOverlaySettings',
  'runTimerSettings'
]);

function applyPatchToConfig(patch: SettingsPatch): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    overlayOpacity: patch.overlayOpacity ?? DEFAULT_CONFIG.overlayOpacity,
    overlayScale: patch.overlayScale ?? DEFAULT_CONFIG.overlayScale,
    overlayDensity: patch.overlayDensity ?? DEFAULT_CONFIG.overlayDensity,
    visualFxIntensity: patch.visualFxIntensity ?? DEFAULT_CONFIG.visualFxIntensity,
    overlayEffectsEnabled: patch.overlayEffectsEnabled ?? DEFAULT_CONFIG.overlayEffectsEnabled,
    overlayVisibleSections: {
      ...DEFAULT_CONFIG.overlayVisibleSections,
      ...patch.overlayVisibleSections
    },
    mainOverlaySettings: {
      ...DEFAULT_CONFIG.mainOverlaySettings,
      ...patch.mainOverlaySettings
    },
    runTimerSettings: {
      ...DEFAULT_CONFIG.runTimerSettings,
      ...patch.runTimerSettings
    },
    runTimer: {
      ...DEFAULT_CONFIG.runTimer
    },
    townTimer: {
      ...DEFAULT_CONFIG.townTimer
    }
  };
}

test('overlay presets map to existing settings and can be detected from config', () => {
  for (const presetId of OVERLAY_PRESET_IDS) {
    const patch = buildOverlayPresetPatch(presetId);
    const config = applyPatchToConfig(patch);

    assert.equal(getMatchingOverlayPreset(config), presetId);
  }

  const routeConfig = applyPatchToConfig(buildOverlayPresetPatch('route'));
  routeConfig.overlayVisibleSections.important = !routeConfig.overlayVisibleSections.important;
  assert.equal(getMatchingOverlayPreset(routeConfig), null);
});

test('overlay presets only patch overlay and timer display settings', () => {
  for (const presetId of OVERLAY_PRESET_IDS) {
    const patch = buildOverlayPresetPatch(presetId);
    const topLevelKeys = Object.keys(patch) as Array<keyof SettingsPatch>;

    assert.ok(topLevelKeys.length > 0, `${presetId} should patch at least one setting`);
    for (const key of topLevelKeys) {
      assert.equal(ALLOWED_TOP_LEVEL_KEYS.has(key), true, `${presetId} should not patch ${String(key)}`);
    }

    assert.deepEqual(
      Object.keys(patch.runTimerSettings ?? {}).sort(),
      ['showActTimer', 'showZoneTimer'],
      `${presetId} should only change timer display flags`
    );
    assert.equal('runTimer' in patch, false, `${presetId} must not change timer state`);
    assert.equal('townTimer' in patch, false, `${presetId} must not change town timer state`);
    assert.equal('guideEntries' in patch, false, `${presetId} must not change route data`);
  }
});

test('timer only preset switches overlay display without touching timer state', () => {
  const patch = buildOverlayPresetPatch('timer_only');
  const config = applyPatchToConfig(patch);

  assert.equal(config.mainOverlaySettings.overlayMode, 'timer_only');
  assert.equal(config.mainOverlaySettings.overlayTimerOnlyMode, true);
  assert.deepEqual(config.runTimer, DEFAULT_CONFIG.runTimer);
  assert.deepEqual(config.townTimer, DEFAULT_CONFIG.townTimer);
  assert.equal(config.runTimerSettings.autoStartMode, DEFAULT_CONFIG.runTimerSettings.autoStartMode);
  assert.equal(config.runTimerSettings.autoStart, DEFAULT_CONFIG.runTimerSettings.autoStart);
});

test('quiet preset returns from timer-only into full normal-density overlay', () => {
  const patch = buildOverlayPresetPatch('quiet');
  const config = applyPatchToConfig(patch);

  assert.equal(config.mainOverlaySettings.overlayMode, 'full');
  assert.equal(config.mainOverlaySettings.overlayTimerOnlyMode, false);
  assert.equal(config.overlayDensity, 'normal');
});

test('overlay preset labels are localized for Russian settings', () => {
  assert.equal(formatOverlayPresetLabel('quiet', 'ru'), 'Тихий');
  assert.equal(formatOverlayPresetLabel('route', 'ru'), 'Маршрут');
  assert.equal(formatOverlayPresetLabel('speedrun', 'ru'), 'Спидран');
  assert.equal(formatOverlayPresetLabel('timer_only', 'ru'), 'Только таймер');
  assert.equal(formatOverlayPresetState('quiet', 'ru'), 'Сейчас: Тихий');
});

test('overlay preset patches are cloned before use', () => {
  const firstPatch = buildOverlayPresetPatch('quiet');
  firstPatch.overlayVisibleSections = {
    ...firstPatch.overlayVisibleSections!,
    next: false
  };
  firstPatch.mainOverlaySettings = {
    ...firstPatch.mainOverlaySettings!,
    overlayMode: 'timer_only'
  };

  const secondPatch = buildOverlayPresetPatch('quiet');
  assert.equal(secondPatch.overlayVisibleSections?.next, true);
  assert.equal(secondPatch.mainOverlaySettings?.overlayMode, 'full');
});
