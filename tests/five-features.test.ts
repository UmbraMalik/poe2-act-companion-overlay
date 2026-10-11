import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../src/shared/defaults';
import { normalizeAppConfig } from '../src/main/services/config-store';
import { buildOverlayContentPlan } from '../src/renderer/overlay-display-intent';
import { getRunPaceSnapshot } from '../src/renderer/run-pace';
import { filterRouteCards } from '../src/renderer/route-tab-search';

test('named overlay layouts survive settings normalization and keep custom order', () => {
  const order = ['tips', 'zoneInfo', 'route', 'nearby'] as const;
  const config = normalizeAppConfig({
    ...DEFAULT_CONFIG,
    overlayLayoutOrder: [...order],
    overlaySavedLayouts: [{ name: 'My speedrun', order: [...order], visibleSections: { ...DEFAULT_CONFIG.overlayVisibleSections } }]
  });
  assert.deepEqual(config.overlayLayoutOrder, [...order]);
  assert.equal(config.overlaySavedLayouts.length, 1);
  assert.equal(config.overlaySavedLayouts[0].name, 'My speedrun');
  const plan = buildOverlayContentPlan({ config, runtimeOverlayMode: 'full' });
  assert.equal(plan.blockOrder.skip, 10);
  assert.equal(plan.blockOrder.zoneInfo, 20);
  assert.equal(plan.blockOrder.next, 30);
  assert.equal(plan.blockOrder.nearby, 40);
});

test('invalid and duplicate layout input is safely normalized', () => {
  const config = normalizeAppConfig({
    ...DEFAULT_CONFIG,
    overlayLayoutOrder: ['tips', 'garbage', 'tips'] as any,
    overlaySavedLayouts: [{ name: 'a', order: ['invalid'], visibleSections: {} }, { name: 'A', order: [], visibleSections: {} }] as any
  });
  assert.deepEqual(config.overlayLayoutOrder, ['tips','zoneInfo','route','nearby']);
  assert.equal(config.overlaySavedLayouts.length, 1);
  assert.deepEqual(config.overlaySavedLayouts[0].order, DEFAULT_CONFIG.overlayLayoutOrder);
});

test('no Ghost Pace is displayed without checkpoint or finished reference', () => {
  const pace = getRunPaceSnapshot({
    runHistory: [], zoneId: 'a1_clearfell', currentRunElapsedMs: 20000,
    currentAct: 1, currentActElapsedMs: 20000, targetRunTimeMs: null,
    timerStatus: 'running'
  });
  assert.equal(pace.checkpointDeltaMs, null);
  assert.equal(pace.tone, 'empty');
});

test('global search model can filter cross-act RU/EN source words', () => {
  const cards = [
    { entry: { guide: { id: 'a1_clearfell' }, status: 'visited' as const }, hasBonusRewards:false, searchText:'Клирфелл Clearfell Бейра Beira' },
    { entry: { guide: { id: 'a3_kopec' }, status: 'pending' as const }, hasBonusRewards:true, searchText:'Храм Копека Temple of Kopec дух spirit' }
  ];
  assert.deepEqual(filterRouteCards(cards, {filterMode:'all',query:'kopec'}).map(x=>x.entry.guide.id),['a3_kopec']);
  assert.deepEqual(filterRouteCards(cards, {filterMode:'all',query:'бейра'}).map(x=>x.entry.guide.id),['a1_clearfell']);
});
