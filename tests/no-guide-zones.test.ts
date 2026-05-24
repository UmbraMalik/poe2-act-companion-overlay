import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentActElapsedMsForAct } from '../src/renderer/companion-helpers';
import { withMockedNow } from './helpers/timerTestUtils';
import {
  applyAppLogLine,
  createTestAppInstance,
  getGuideZones,
  getZoneAreaIds,
  normalizeAreaId
} from './helpers/zoneTestUtils';

function getRepresentativeZone(prefix: string) {
  const normalizedPrefix = prefix.toLowerCase();

  for (const zone of getGuideZones()) {
    for (const areaId of getZoneAreaIds(zone)) {
      if (normalizeAreaId(areaId).startsWith(`${normalizedPrefix}_`)) {
        return { zone, areaId };
      }
    }
  }

  throw new Error(`No guide zone found for prefix ${prefix}`);
}

test('no-guide zones keep raw name, act timer and guide recovery for every campaign prefix', () => {
  const cases = [
    ['G1', 'G1', 1],
    ['G2', 'G2', 2],
    ['G3', 'G3', 3],
    ['G4', 'G4', 4],
    ['G5', 'P1', 5],
    ['P1', 'P1', 5],
    ['P2', 'P2', 5],
    ['P3', 'P3', 5]
  ] as const;

  for (const [unknownPrefix, knownPrefix, expectedAct] of cases) {
    const { zone, areaId } = getRepresentativeZone(knownPrefix);
    const app = createTestAppInstance();
    const rawUnknownName = `No Guide ${unknownPrefix}`;

    withMockedNow(1_000, () => {
      applyAppLogLine(app as never, `2026/05/16 22:00:10 123 [DEBUG Client] Generating level 1 area "${areaId}" with seed 1`);
      applyAppLogLine(app as never, `[SCENE] Set Source [${zone.zone_en}]`);
      (app as any).startRunTimerFromAnchor(1_000);
    });

    withMockedNow(2_000, () => {
      applyAppLogLine(app as never, `2026/05/16 22:01:10 123 [DEBUG Client] Generating level 1 area "${unknownPrefix}_unknown_test" with seed 1`);
      applyAppLogLine(app as never, `[SCENE] Set Source [${rawUnknownName}]`);
    });

    let runTimer = (app as any).config.runTimer;
    assert.equal((app as any).currentZone.guide, null, `${unknownPrefix}: guide card must be cleared`);
    assert.equal((app as any).currentZone.rawZoneName, rawUnknownName, `${unknownPrefix}: raw no-guide name must stay visible`);
    assert.equal((app as any).currentZone.actHint, expectedAct, `${unknownPrefix}: act hint must come from area-id prefix`);
    assert.equal((app as any).runtime.lastGameplayAct, expectedAct, `${unknownPrefix}: last gameplay act must stay available`);
    assert.equal(runTimer.actSplits.length, 0, `${unknownPrefix}: same-act no-guide zone must not create a false split`);
    assert.equal(
      getCurrentActElapsedMsForAct(runTimer, expectedAct, 2_000),
      1_000,
      `${unknownPrefix}: current act timer must stay visible in no-guide zone`
    );

    withMockedNow(3_000, () => {
      applyAppLogLine(app as never, `2026/05/16 22:02:10 123 [DEBUG Client] Generating level 1 area "${areaId}" with seed 1`);
      applyAppLogLine(app as never, `[SCENE] Set Source [${zone.zone_en}]`);
    });

    runTimer = (app as any).config.runTimer;
    assert.equal((app as any).currentZone.guide?.id, zone.id, `${unknownPrefix}: guide card must recover on next known zone`);
    assert.equal(
      getCurrentActElapsedMsForAct(runTimer, expectedAct, 3_000),
      2_000,
      `${unknownPrefix}: act timer must continue after returning from a no-guide zone`
    );
  }
});

test('no-guide zone without explicit area id falls back to the last gameplay act', () => {
  const { zone, areaId } = getRepresentativeZone('G3');
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, `2026/05/16 22:10:10 123 [DEBUG Client] Generating level 1 area "${areaId}" with seed 1`);
    applyAppLogLine(app as never, `[SCENE] Set Source [${zone.zone_en}]`);
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '[SCENE] Set Source [Forgotten Causeway]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.rawZoneName, 'Forgotten Causeway');
  assert.equal((app as any).currentZone.actHint, 3);
  assert.equal((app as any).runtime.lastGameplayAct, 3);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 3, 2_000), 1_000);
});

test('no-guide zone between acts keeps the split and does not break the next act transition', () => {
  const act1 = getRepresentativeZone('G1');
  const act2 = getRepresentativeZone('G2');
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, `2026/05/16 22:20:10 123 [DEBUG Client] Generating level 1 area "${act1.areaId}" with seed 1`);
    applyAppLogLine(app as never, `[SCENE] Set Source [${act1.zone.zone_en}]`);
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:21:10 123 [DEBUG Client] Generating level 1 area "G2_unknown_test" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Dusty Pass]');
  });

  let runTimer = (app as any).config.runTimer;
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [1]);
  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.actHint, 2);
  assert.equal((app as any).runtime.lastGameplayAct, 2);

  withMockedNow(3_000, () => {
    applyAppLogLine(app as never, `2026/05/16 22:22:10 123 [DEBUG Client] Generating level 1 area "${act2.areaId}" with seed 1`);
    applyAppLogLine(app as never, `[SCENE] Set Source [${act2.zone.zone_en}]`);
  });

  runTimer = (app as any).config.runTimer;
  assert.deepEqual(runTimer.actSplits.map((split: { act: number }) => split.act), [1]);
  assert.equal((app as any).currentZone.guide?.id, act2.zone.id);
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 2, 3_000), 1_000);
});
