import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getRouteOverviewForAct,
  getRouteProgressState,
  type RouteZoneStatus
} from '../src/renderer/companion-helpers';
import { buildChecklistDefinition, shouldItemBeMissed } from '../src/shared/checklist';
import type {
  AppConfig,
  ChecklistItemDefinition,
  ChecklistItemProgress,
  GuideEntry
} from '../src/shared/types';
import {
  createTestAppInstance,
  getGuideZones
} from './helpers/zoneTestUtils';

function createRouteZoneStatus(
  guide: GuideEntry,
  status: RouteZoneStatus['status']
): RouteZoneStatus {
  return {
    guide,
    status,
    rewardItems: [],
    missedItems: []
  };
}

function findGuideWithMissableRewards(): {
  guide: GuideEntry;
  routeRewards: ChecklistItemDefinition[];
  missableReward: ChecklistItemDefinition;
} {
  for (const guide of getGuideZones()) {
    const routeRewards = buildChecklistDefinition(guide).filter((item) => (
      item.required ||
      item.type === 'boss' ||
      item.autoCompleteMode === 'linked_reward'
    ));
    const missableReward = routeRewards.find((item) => shouldItemBeMissed(item));

    if (routeRewards.length > 0 && missableReward) {
      return {
        guide,
        routeRewards,
        missableReward
      };
    }
  }

  throw new Error('Expected guide data to contain at least one missable route reward.');
}

function setRouteRewardProgress(
  app: ReturnType<typeof createTestAppInstance>,
  guide: GuideEntry,
  routeRewards: ChecklistItemDefinition[],
  progressForItem: (item: ChecklistItemDefinition) => ChecklistItemProgress
): void {
  const snapshot = app.getSnapshot();
  const itemStates = Object.fromEntries(
    routeRewards.map((item) => [item.id, progressForItem(item)])
  );

  (app as unknown as { config: AppConfig }).config = {
    ...snapshot.config,
    zoneProgress: {
      ...snapshot.config.zoneProgress,
      [guide.id]: {
        itemStates,
        likelyDoneKeywords: [],
        lastVisitedAt: null
      }
    }
  };
}

test('route progress starts at zero when selected current act has no current or completed zones', () => {
  const guide = getGuideZones()[0];
  const zones = [
    createRouteZoneStatus(guide, 'pending'),
    createRouteZoneStatus(guide, 'pending'),
    createRouteZoneStatus(guide, 'pending')
  ];

  const progress = getRouteProgressState(zones, {
    isSelectedRouteActCurrent: true,
    isSelectedRouteActBeforeCurrent: false
  });

  assert.equal(progress.total, 3);
  assert.equal(progress.currentIndex, -1);
  assert.equal(progress.currentCount, 0);
  assert.equal(progress.percent, 0);
});

test('route progress uses selected act progress state consistently', () => {
  const guide = getGuideZones()[0];
  const zones = [
    createRouteZoneStatus(guide, 'visited'),
    createRouteZoneStatus(guide, 'current'),
    createRouteZoneStatus(guide, 'pending')
  ];

  const currentActProgress = getRouteProgressState(zones, {
    isSelectedRouteActCurrent: true,
    isSelectedRouteActBeforeCurrent: false
  });
  const previousActProgress = getRouteProgressState(zones, {
    isSelectedRouteActCurrent: false,
    isSelectedRouteActBeforeCurrent: true
  });

  assert.equal(currentActProgress.currentIndex, 1);
  assert.equal(currentActProgress.currentCount, 2);
  assert.equal(currentActProgress.percent, (2 / 3) * 100);
  assert.equal(previousActProgress.currentIndex, -1);
  assert.equal(previousActProgress.currentCount, 3);
  assert.equal(previousActProgress.percent, 100);
});

test('route overview treats likely done route rewards as completed', () => {
  const app = createTestAppInstance();
  const { guide, routeRewards } = findGuideWithMissableRewards();

  setRouteRewardProgress(app, guide, routeRewards, (item) => ({
    state: 'likely_done',
    timestamp: '2026-01-01T00:00:00.000Z',
    detectedBy: 'zone_leave',
    originalText: item.text
  }));

  const routeEntry = getRouteOverviewForAct(app.getSnapshot(), guide.act)
    .find((entry) => entry.guide.id === guide.id);

  assert.equal(routeEntry?.status, 'completed');
  assert.equal(routeEntry?.missedItems.length, 0);
});

test('route overview keeps missed route rewards visible without changing generic checklist rendering', () => {
  const app = createTestAppInstance();
  const { guide, routeRewards, missableReward } = findGuideWithMissableRewards();

  setRouteRewardProgress(app, guide, routeRewards, (item) => ({
    state: item.id === missableReward.id ? 'missed' : 'done',
    timestamp: '2026-01-01T00:00:00.000Z',
    detectedBy: item.id === missableReward.id ? 'inferred_zone_leave' : 'log',
    originalText: item.text
  }));

  const routeEntry = getRouteOverviewForAct(app.getSnapshot(), guide.act)
    .find((entry) => entry.guide.id === guide.id);

  assert.equal(routeEntry?.status, 'missed');
  assert.deepEqual(routeEntry?.missedItems.map((item) => item.id), [missableReward.id]);
});
