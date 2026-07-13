import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRouteOverviewForAct,
  getRouteProgressState
} from '../src/renderer/companion-helpers';
import { getStructuredRouteBonusIds } from '../src/renderer/route-tab-search';
import {
  FINAL_INTERLUDE_BONUS_ID,
  INTERLUDE_BRANCH_COMPLETION_RULES,
  INTERLUDE_BRANCH_ENDPOINT_GUIDE_IDS,
  POST_INTERLUDES_REWARD_CHECKLIST_ITEM_ID
} from '../src/shared/interlude-completion';
import type { AppConfig, AppSnapshot, GuideEntry } from '../src/shared/types';
import { getCampaignBonuses } from './helpers/bonusTestUtils';
import {
  createMockUserDataPath,
  invokeIpcHandler,
  resetElectronMockState
} from './helpers/electron-mock';
import {
  applyAppLogLine,
  createTestAppInstance,
  loadMainModule
} from './helpers/zoneTestUtils';

const POST_INTERLUDES_KINGSMARCH_ID = 'post_interludes_kingsmarch';
const INTERLUDE_BRANCH_ENDPOINT_IDS = INTERLUDE_BRANCH_ENDPOINT_GUIDE_IDS;

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

function completeInterludeBranch(app: TestApp, guideId: string): void {
  visitGuide(app, guideId);
  assert.equal(app.markCurrentChecklistItemDone(), true, `failed to complete ${guideId}`);
  const completionRule = INTERLUDE_BRANCH_COMPLETION_RULES.find((rule) => rule.guideId === guideId);
  assert.ok(completionRule, `missing completion rule ${guideId}`);
  const progress = app.getSnapshot().config.zoneProgress[guideId]
    ?.itemStates[completionRule.completionChecklistItemId];
  assert.equal(progress?.state, 'done');
  assert.equal(progress?.detectedBy, 'manual');
}

function hasCompletedAllInterludeBranches(app: TestApp): boolean {
  const controller = require('../src/main/app-guide-log-controller') as typeof import('../src/main/app-guide-log-controller');
  return controller.hasCompletedAllInterludeBranches(app.getSnapshot().config);
}

function enterKingsmarch(app: TestApp): void {
  applyAppLogLine(app, '2026/07/13 12:00:00 [SCENE] Set Source [Kingsmarch]');
}

async function simulateGuideById(app: TestApp, guideId: string): Promise<AppSnapshot> {
  resetElectronMockState();
  app.registerIpc();
  return await invokeIpcHandler<AppSnapshot>('app:simulate-zone', guideId);
}

function completeAllInterludeBranches(app: TestApp): void {
  for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS) {
    completeInterludeBranch(app, guideId);
  }
}

function assertOrdinaryKingsmarch(snapshot: AppSnapshot): void {
  assert.equal(snapshot.currentGuideEntry?.id, 'a4_kingsmarch');
  assert.equal(snapshot.currentGuideEntry?.act, 4);
  assert.equal(snapshot.currentGuideEntry?.next_zone_ru, 'Остров Вакапану');
  assert.doesNotMatch(JSON.stringify(snapshot.currentGuideEntry), /Скрытый|Ориат/);
}

function assertFinalKingsmarch(snapshot: AppSnapshot): void {
  assert.equal(snapshot.currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);
  assert.equal(snapshot.currentGuideEntry?.act, 5);
  assert.equal(snapshot.currentGuideEntry?.next_zone_ru, 'Ориат');
  assert.match(JSON.stringify(snapshot.currentGuideEntry), /Скрытый/);
  assert.match(JSON.stringify(snapshot.currentGuideEntry), /\+2 пассивных очка/);
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

test('explicit simulation keeps ordinary Act 4 Kingsmarch', async () => {
  const app = createTestAppInstance();

  assertOrdinaryKingsmarch(await simulateGuideById(app, 'a4_kingsmarch'));
});

test('explicit simulation keeps ordinary Act 4 Kingsmarch after completed Interludes', async () => {
  const app = createTestAppInstance();
  completeAllInterludeBranches(app);

  assertOrdinaryKingsmarch(await simulateGuideById(app, 'a4_kingsmarch'));
});

test('explicit simulation shows final Kingsmarch before Interludes are complete', async () => {
  const app = createTestAppInstance();

  assertFinalKingsmarch(await simulateGuideById(app, POST_INTERLUDES_KINGSMARCH_ID));
});

test('explicit simulation shows final Kingsmarch after completed Interludes', async () => {
  const app = createTestAppInstance();
  completeAllInterludeBranches(app);

  assertFinalKingsmarch(await simulateGuideById(app, POST_INTERLUDES_KINGSMARCH_ID));
});

test('sequential final then ordinary simulation keeps the second explicit guide', async () => {
  const app = createTestAppInstance();

  assertFinalKingsmarch(await simulateGuideById(app, POST_INTERLUDES_KINGSMARCH_ID));
  assertOrdinaryKingsmarch(await simulateGuideById(app, 'a4_kingsmarch'));
});

test('sequential ordinary then final simulation keeps the second explicit guide', async () => {
  const app = createTestAppInstance();

  assertOrdinaryKingsmarch(await simulateGuideById(app, 'a4_kingsmarch'));
  assertFinalKingsmarch(await simulateGuideById(app, POST_INTERLUDES_KINGSMARCH_ID));
});

test('real Kingsmarch after completed Interludes resolves to final context only from post-Act-4 phase', () => {
  const cases = [
    { previousGuideId: 'a3_ziggurat_encampment', expectedId: 'a4_kingsmarch' },
    { previousGuideId: 'a4_whakapanu_island', expectedId: 'a4_kingsmarch' },
    { previousGuideId: 'interlude_the_glade', expectedId: POST_INTERLUDES_KINGSMARCH_ID }
  ];

  for (const { previousGuideId, expectedId } of cases) {
    const app = createTestAppInstance();
    completeAllInterludeBranches(app);
    visitGuide(app, previousGuideId);

    enterKingsmarch(app);
    assert.equal(app.getSnapshot().currentGuideEntry?.id, expectedId, previousGuideId);
  }
});

test('real Kingsmarch from Act 5 stays ordinary without completion evidence', () => {
  const app = createTestAppInstance();
  visitGuide(app, 'interlude_the_glade');

  enterKingsmarch(app);
  assertOrdinaryKingsmarch(app.getSnapshot());
});

test('first Act 3 to Kingsmarch transition ignores stale completed bonus', () => {
  const app = createTestAppInstance();
  assert.equal(app.setCampaignBonusDone(FINAL_INTERLUDE_BONUS_ID, 'manual'), true);
  visitGuide(app, 'a3_ziggurat_encampment');

  enterKingsmarch(app);
  assertOrdinaryKingsmarch(app.getSnapshot());
});

test('restore config preserves the explicitly persisted final Kingsmarch guide', () => {
  const app = createTestAppInstance();
  const finalGuide = getGuide(app, POST_INTERLUDES_KINGSMARCH_ID);
  const mutableApp = app as unknown as {
    config: AppConfig;
    configStore: { update: (patch: Partial<AppConfig>) => AppConfig };
  };
  mutableApp.config = mutableApp.configStore.update({ lastZoneName: finalGuide.zone_ru });

  app.restoreLastZoneFromConfig();
  assertFinalKingsmarch(app.getSnapshot());
});

test('restore config preserves ordinary Kingsmarch despite completed progress', () => {
  const app = createTestAppInstance();
  const ordinaryGuide = getGuide(app, 'a4_kingsmarch');
  assert.equal(app.setCampaignBonusDone(FINAL_INTERLUDE_BONUS_ID, 'manual'), true);
  const mutableApp = app as unknown as {
    config: AppConfig;
    configStore: { update: (patch: Partial<AppConfig>) => AppConfig };
  };
  mutableApp.config = mutableApp.configStore.update({ lastZoneName: ordinaryGuide.zone_ru });

  app.restoreLastZoneFromConfig();
  assertOrdinaryKingsmarch(app.getSnapshot());
});

test('visited all endpoints without completion does not activate post-Interludes Kingsmarch', () => {
  const app = createTestAppInstance();
  for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS) {
    visitGuide(app, guideId);
  }

  assert.equal(hasCompletedAllInterludeBranches(app), false);
  enterKingsmarch(app);
  assert.equal(app.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
});

test('two completed branches and a visited-only third endpoint stay on ordinary Kingsmarch', () => {
  const app = createTestAppInstance();
  completeInterludeBranch(app, INTERLUDE_BRANCH_ENDPOINT_IDS[0]);
  completeInterludeBranch(app, INTERLUDE_BRANCH_ENDPOINT_IDS[1]);
  visitGuide(app, INTERLUDE_BRANCH_ENDPOINT_IDS[2]);

  assert.equal(hasCompletedAllInterludeBranches(app), false);
  enterKingsmarch(app);
  assert.equal(app.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
});

test('leaving the visited-only third endpoint through a portal does not complete its branch', () => {
  const app = createTestAppInstance();
  completeInterludeBranch(app, INTERLUDE_BRANCH_ENDPOINT_IDS[0]);
  completeInterludeBranch(app, INTERLUDE_BRANCH_ENDPOINT_IDS[1]);
  visitGuide(app, INTERLUDE_BRANCH_ENDPOINT_IDS[2]);

  enterKingsmarch(app);
  assert.equal(hasCompletedAllInterludeBranches(app), false);
  assert.equal(app.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
});

test('only one or two explicitly completed branches do not enable final Kingsmarch', () => {
  for (const completedCount of [1, 2]) {
    const app = createTestAppInstance();
    for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS.slice(0, completedCount)) {
      completeInterludeBranch(app, guideId);
    }

    assert.equal(hasCompletedAllInterludeBranches(app), false);
    enterKingsmarch(app);
    assert.equal(app.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
  }
});

test('all branch completion orders resolve physical Kingsmarch to the post-Interludes context', () => {
  for (const completionOrder of permutations(INTERLUDE_BRANCH_ENDPOINT_IDS)) {
    const app = createTestAppInstance();
    for (const guideId of completionOrder) {
      completeInterludeBranch(app, guideId);
    }

    assert.equal(hasCompletedAllInterludeBranches(app), true);
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
    completeInterludeBranch(firstApp, guideId);
  }
  enterKingsmarch(firstApp);
  assert.equal(firstApp.getSnapshot().currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);

  const restartedApp = new PoeOverlayApp();
  restartedApp.loadGuide();
  restartedApp.restoreLastZoneFromConfig();

  const restartedSnapshot = restartedApp.getSnapshot();
  assert.equal(restartedSnapshot.currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);
  assert.equal(hasCompletedAllInterludeBranches(restartedApp), true);
});

test('visited-only endpoint state stays incomplete after restart', () => {
  const { PoeOverlayApp } = loadMainModule();
  createMockUserDataPath('post-interludes-visited-only');

  const firstApp = new PoeOverlayApp();
  firstApp.loadGuide();
  for (const guideId of INTERLUDE_BRANCH_ENDPOINT_IDS) {
    visitGuide(firstApp, guideId);
  }
  enterKingsmarch(firstApp);
  assert.equal(firstApp.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');

  const restartedApp = new PoeOverlayApp();
  restartedApp.loadGuide();
  restartedApp.restoreLastZoneFromConfig();

  assert.equal(hasCompletedAllInterludeBranches(restartedApp), false);
  assert.equal(restartedApp.getSnapshot().currentGuideEntry?.id, 'a4_kingsmarch');
});

test('persisted final bonus is trusted without migrating visited endpoints to completion', () => {
  const { PoeOverlayApp } = loadMainModule();
  createMockUserDataPath('post-interludes-legacy-final-bonus');

  const firstApp = new PoeOverlayApp();
  firstApp.loadGuide();
  enterKingsmarch(firstApp);
  const persistedProgress = {
    state: 'done' as const,
    timestamp: '2026-07-13T12:00:00.000Z',
    detectedBy: 'log' as const,
    logLine: 'legacy persisted final reward'
  };
  const mutableApp = firstApp as unknown as {
    config: AppConfig;
    configStore: { update: (patch: Partial<AppConfig>) => AppConfig };
  };
  mutableApp.config = mutableApp.configStore.update({
    lastZoneName: getGuide(firstApp, POST_INTERLUDES_KINGSMARCH_ID).zone_ru,
    zoneProgress: {},
    campaignBonusProgress: {
      [FINAL_INTERLUDE_BONUS_ID]: persistedProgress
    }
  });

  const restartedApp = new PoeOverlayApp();
  restartedApp.loadGuide();
  restartedApp.restoreLastZoneFromConfig();
  const snapshot = restartedApp.getSnapshot();

  assert.equal(hasCompletedAllInterludeBranches(restartedApp), true);
  assert.equal(snapshot.currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);
  assert.equal(snapshot.currentGuideEntry?.next_zone_ru, 'Ориат');
  assert.equal(
    snapshot.currentChecklist.find((item) => item.id === POST_INTERLUDES_REWARD_CHECKLIST_ITEM_ID)
      ?.displayState,
    'done'
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

  assert.equal(app.setCampaignBonusDone(FINAL_INTERLUDE_BONUS_ID, 'manual'), true);
  assert.equal(hasCompletedAllInterludeBranches(app), true);
  visitGuide(app, 'interlude_the_glade');
  enterKingsmarch(app);
  const finalSnapshot = app.getSnapshot();
  assert.equal(finalSnapshot.currentGuideEntry?.id, POST_INTERLUDES_KINGSMARCH_ID);
  assert.equal(finalSnapshot.currentGuideEntry?.next_zone_ru, 'Ориат');
  assert.equal(
    finalSnapshot.currentChecklist.find((item) => item.id === POST_INTERLUDES_REWARD_CHECKLIST_ITEM_ID)?.displayState,
    'done'
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
