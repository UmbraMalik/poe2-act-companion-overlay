import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import type { AppConfig, SettingsPatch } from '../src/shared/types';
import { buildOverlayContentPlan, OVERLAY_CONTENT_BLOCKS } from '../src/renderer/overlay-display-intent';
import { buildOverlayPresetPatch } from '../src/renderer/overlay-presets';

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

function assertPresetDoesNotReorderOverlayContent(plan: ReturnType<typeof buildOverlayContentPlan>): void {
  // UI-V2 supplies one shared layout order for every visibility preset.
  const expected = { nearby: 30, zoneInfo: 10, zoneBonuses: 20, league: 0,
    next: 20, skip: 40, speedrun: 40, important: 40 };
  for (const block of OVERLAY_CONTENT_BLOCKS) {
    assert.equal(plan.blockOrder[block], expected[block], `${block} should keep its configured position`);
  }
}

test('normal display intent hides speedrun copy without changing block positions', () => {
  const config = applyPatchToConfig(buildOverlayPresetPatch('route'));
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'full' });

  assert.equal(plan.intent, 'normal');
  assert.equal(plan.presetId, 'route');
  assert.equal(plan.visibleSections.zoneInfo, true);
  assert.equal(plan.visibleSections.next, true);
  assert.equal(plan.visibleSections.speedrun, false);
  assertPresetDoesNotReorderOverlayContent(plan);
  assert.equal(plan.maxChecklistItems, null);
});

test('speedrun display intent keeps existing speedrun sections without changing block positions', () => {
  const config = applyPatchToConfig(buildOverlayPresetPatch('speedrun'));
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'full' });

  assert.equal(plan.intent, 'speedrun');
  assert.equal(plan.presetId, 'speedrun');
  assert.equal(plan.visibleSections.next, true);
  assert.equal(plan.visibleSections.speedrun, true);
  assert.equal(plan.visibleSections.skip, true);
  assert.equal(plan.visibleSections.nearby, false);
  assert.equal(plan.visibleSections.league, false);
  assertPresetDoesNotReorderOverlayContent(plan);
  assert.equal(plan.maxChecklistItems, 4);
});

test('timer only display intent removes route, bonus, league and reminder noise', () => {
  const config = applyPatchToConfig(buildOverlayPresetPatch('timer_only'));
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'timer_only' });

  assert.equal(plan.intent, 'timer_only');
  assert.equal(plan.presetId, 'timer_only');
  assert.equal(plan.copyDensity, 'timer');
  assert.equal(plan.maxChecklistItems, 0);
  assert.deepEqual(
    {
      nearby: plan.visibleSections.nearby,
      zoneInfo: plan.visibleSections.zoneInfo,
      zoneBonuses: plan.visibleSections.zoneBonuses,
      league: plan.visibleSections.league,
      next: plan.visibleSections.next,
      skip: plan.visibleSections.skip,
      speedrun: plan.visibleSections.speedrun,
      important: plan.visibleSections.important
    },
    {
      nearby: false,
      zoneInfo: false,
      zoneBonuses: false,
      league: false,
      next: false,
      skip: false,
      speedrun: false,
      important: false
    }
  );
  assert.deepEqual(config.runTimer, DEFAULT_CONFIG.runTimer);
});

test('custom display intent preserves manual section visibility and existing order', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    overlayVisibleSections: {
      ...DEFAULT_CONFIG.overlayVisibleSections,
      next: false,
      speedrun: true,
      league: true
    },
    mainOverlaySettings: {
      ...DEFAULT_CONFIG.mainOverlaySettings,
      showOverlaySkip: false
    }
  };
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'full' });

  assert.equal(plan.intent, 'custom');
  assert.equal(plan.presetId, null);
  assert.equal(plan.visibleSections.next, false);
  assert.equal(plan.visibleSections.speedrun, true);
  assert.equal(plan.visibleSections.league, true);
  assert.equal(plan.visibleSections.skip, DEFAULT_CONFIG.overlayVisibleSections.skip);
  assertPresetDoesNotReorderOverlayContent(plan);
  assert.equal(plan.maxChecklistItems, null);
});


test('custom overlay layout order changes grouped blocks without reordering individual bonus cards', () => {
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    overlayLayoutOrder: ['tips', 'nearby', 'zoneInfo', 'route']
  };
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'full' });
  assert.equal(plan.blockOrder.skip, 10);
  assert.equal(plan.blockOrder.speedrun, 10);
  assert.equal(plan.blockOrder.important, 10);
  assert.equal(plan.blockOrder.nearby, 20);
  assert.equal(plan.blockOrder.zoneInfo, 30);
  assert.equal(plan.blockOrder.next, 40);
  assert.equal(plan.blockOrder.zoneBonuses, 40);
});
