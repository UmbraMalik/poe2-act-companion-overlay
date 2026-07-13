import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRouteOverviewForAct,
  getRouteProgressState
} from '../src/renderer/companion-helpers';
import { getStructuredRouteBonusIds } from '../src/renderer/route-tab-search';
import type { AppConfig, GuideEntry, VisitedZoneEntry } from '../src/shared/types';
import { getCampaignBonuses } from './helpers/bonusTestUtils';
import { createMockUserDataPath } from './helpers/electron-mock';
import {
  applyAppLogLine,
  createTestAppInstance,
  loadMainModule
} from './helpers/zoneTestUtils';

const POST_INTERLUDES_KINGSMARCH_ID = 'post_interludes_kingsmarch';
const FINAL_INTERLUDE_BONUS_ID = 'int3_final_zolin_zelina_weapon_points';
const INTERLUDE_BRANCH_ENDPOINT_IDS = [
  'i2_kima_reservoir',
  'interlude_cuachic_vault',
  'i_final_holten_estate'
] as const;

type TestApp = ReturnType<typeof createTestAppInstance>;

function getGuide(app: TestApp, guideId: string): GuideEntry {
  const guide = app.getSnapshot().guideEntries.find((entry: GuideEntry) => entry.id === guideId);
  assert.ok(guide, `missing guide ${guideId}`);
  return guide;
}

function visitGuide(app: TestApp, guideId: string): void {
  const guide = getGuide(app, guideId);
  app.setCurrentZone(guide.zone_en, 'log', guide, guide.act);
}

function enterKingsmarch(app: TestApp): void {
  applyAppLogLine(app, '2026/07/13 12:00:00 [SCENE] Set Source [Kingsmarch]');
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [Array.from(items)];
  }

  return items.flatMap((item, index) => (
    permutations([...items.slice(0, index), ...items.slice(index + 1)])
      .map((tail) => [item, ...tail])
  ));
}

test('ordinary Act 4 Kingsmarch stays on the island route before all Interludes are complete', () => {
  const app = createTestAppInstance();
  enterKingsmarch(app);

  const guide = app.getSnapshot().currentGuideEntry;
  assert.equal(guide?.id, 'a4_kingsmarch');
  assert.equal(guide?.act, 4);
  assert.equal(guide?.next_zone_ru, 'Остров Вакапану');
});

test('one or two completed Interlude branches do not enable final Kingsmarch', () => {
  for (const completedCount of [1, 2]) {
    const app = createTestAppInstance();
    for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS.slice(0, completedCount)) {
      visitGuide(app, guideId);
    }

    enterKingsmarch(app);
    assert.equal(app.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
  }
});

test('all branch completion orders resolve physical Kingsmarch to the post-Interludes context', () => {
  for (const completionOrder of permutations(INTERLUDE_BRANCH_ENDPOINT_IDS)) {
    const app = createTestAppInstance();
    for (const guideId of completionOrder) {
      visitGuide(app, guideId);
    }

    enterKingsmarch(app);
    const guide = app.getSnapshot().currentGuideEntry;
    assert.equal(guide?.id, POST_INTERLUDES_KINGSMARCH_ID, completionOrder.join(' -> '));
    assert.equal(guide?.act, 5);
    assert.equal(guide?.next_zone_ru, 'Ориат');
    assert.doesNotMatch(guide?.next_zone_ru ?? '', /Остров Вакапану/);
    assert.doesNotMatch(JSON.stringify(guide), /Кингсмарш → Остров Вакапану/);
  }
});

test('persisted Interlude completion restores post-Interludes Kingsmarch after restart', () => {
  const { PoeOverlayApp } = loadMainModule();
  createMockUserDataPath('post-interludes-kingsmarch');

  const firstApp = new PoeOverlayApp();
  firstApp.loadGuide();
  for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS) {
    visitGuide(firstApp, guideId);
  }
  enterKingsmarch(firstApp);
  assert.equal(firstApp.getSnapshot().currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);

  const restartedApp = new PoeOverlayApp();
  restartedApp.loadGuide();
  restartedApp.restoreLastZoneFromConfig();

  const restartedSnapshot = restartedApp.getSnapshot();
  assert.equal(restartedSnapshot.currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);
  assert.deepEqual(
    INTERLUDE_BRANCH_ENDPOINT_IDS.filter((guideId) => (
      restartedSnapshot.config.visitedZones.some((entry: VisitedZoneEntry) => entry.zoneId === guideId)
    )),
    [...INTERLUDE_BRANCH_ENDPOINT_IDS]
  );
});

test('route overview and progress use Khari, Kriar, Ogham, then final Kingsmarch order', () => {
  const app = createTestAppInstance();
  visitGuide(app, 'interlude_the_glade');

  const route = getRouteOverviewForAct(app.getSnapshot(), 5);
  const routeIds = route.map((entry) => entry.guide.id);
  const khariIndex = routeIds.indexOf('interlude_khari_bazaar');
  const kriarIndex = routeIds.indexOf('interlude_the_glade');
  const oghamIndex = routeIds.indexOf('interlude_refuge');
  const finalKingsmarchIndex = routeIds.indexOf(POST_INTERLUDES_KINGSMARCH_ID);

  assert.ok(khariIndex >= 0 && khariIndex < kriarIndex);
  assert.ok(kriarIndex < oghamIndex);
  assert.ok(oghamIndex < finalKingsmarchIndex);
  assert.equal(finalKingsmarchIndex, route.length - 1);

  const currentIndex = route.findIndex((entry) => entry.status === 'current');
  const progress = getRouteProgressState(route, {
    isSelectedRouteActCurrent: true,
    isSelectedRouteActBeforeCurrent: false
  });
  assert.equal(route[currentIndex]?.guide.id, 'interlude_the_glade');
  assert.equal(progress.currentIndex, currentIndex);
  assert.equal(progress.currentCount, currentIndex + 1);
});

test('final +2 bonus is linked only to post-Interludes Kingsmarch and keeps its persisted id', () => {
  const app = createTestAppInstance();
  const bonuses = getCampaignBonuses();
  const finalBonusMatches = bonuses.filter((bonus) => bonus.id === FINAL_INTERLUDE_BONUS_ID);
  const ordinaryKingsmarch = getGuide(app, 'a4_kingsmarch');
  const finalKingsmarch = getGuide(app, POST_INTERLUDES_KINGSMARCH_ID);

  assert.equal(finalBonusMatches.length, 1);
  assert.deepEqual(
    getStructuredRouteBonusIds(finalKingsmarch, bonuses),
    [FINAL_INTERLUDE_BONUS_ID]
  );
  assert.equal(
    getStructuredRouteBonusIds(ordinaryKingsmarch, bonuses).includes(FINAL_INTERLUDE_BONUS_ID),
    false
  );

  const persistedProgress = {
    state: 'done' as const,
    timestamp: '2026-07-13T12:00:00.000Z',
    detectedBy: 'log' as const,
    logLine: 'legacy persisted id regression'
  };
  const mutableApp = app as unknown as {
    config: AppConfig;
    configStore: { update: (patch: Partial<AppConfig>) => AppConfig };
  };
  mutableApp.config = mutableApp.configStore.update({
    campaignBonusProgress: {
      [FINAL_INTERLUDE_BONUS_ID]: persistedProgress
    }
  });
  assert.deepEqual(
    app.getSnapshot().config.campaignBonusProgress[FINAL_INTERLUDE_BONUS_ID],
    persistedProgress
  );
});
