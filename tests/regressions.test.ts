import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentActElapsedMsForAct } from '../src/renderer/companion-helpers';
import { shouldStartOverlayDrag } from '../src/shared/overlay-drag';
import { loadLogFixtureLines } from './helpers/logFixtures';
import { readMainProcessSource, readText } from './helpers/loadJson';
import { withMockedNow } from './helpers/timerTestUtils';
import {
  applyAppLogLine,
  applyAppLogLines,
  createTestAppInstance,
  loadGuideService
} from './helpers/zoneTestUtils';

function getDoneBonusIds(app: unknown): string[] {
  return Object.keys((app as { config: { campaignBonusProgress: Record<string, unknown> } }).config.campaignBonusProgress).sort();
}

test('Hunting Grounds and Ogham Farmlands remain separate mappings', () => {
  const service = loadGuideService();

  assert.equal(
    service.resolveZoneMatch({
      rawLine: 'G1_11',
      extractedInternalAreaId: 'G1_11',
      extractedZoneName: 'Hunting Grounds'
    })?.guide?.id,
    'a1_hunting_grounds'
  );
  assert.equal(
    service.resolveZoneMatch({
      rawLine: 'G1_13_1',
      extractedInternalAreaId: 'G1_13_1',
      extractedZoneName: 'Ogham Farmlands'
    })?.guide?.id,
    'a1_ogham_farmlands'
  );
});

test('unknown zone does not reuse the previous guide card and keeps the act timer', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:00:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Hunting Grounds]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:01:10 123 [DEBUG Client] Generating level 12 area "G1_unknown_test" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Misty Side Zone]');
  });

  const runTimer = (app as any).config.runTimer;
  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.rawZoneName, 'Misty Side Zone');
  assert.equal((app as any).runtime.lastGameplayGuideId, 'a1_hunting_grounds');
  assert.equal(getCurrentActElapsedMsForAct(runTimer, 1, 2_000), 1_000);
});

test('ordinary passive points never auto-complete weapon passives and repeated reward lines stay deduped', () => {
  const app = createTestAppInstance();

  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Hunting Grounds]');
  applyAppLogLine(app as never, ': You have received 2 Passive Skill Points.');
  assert.deepEqual(getDoneBonusIds(app), []);

  applyAppLogLines(app as never, [
    ': You have received 2 Weapon Set Passive Skill Points.',
    ': You have received 2 Weapon Set Passive Skill Points.'
  ]);
  assert.deepEqual(getDoneBonusIds(app), ['act1_hunting_grounds_crowbell_weapon_points']);
});

test('spirit rewards stay act-specific and do not chain into the next similar bonus', () => {
  const app = createTestAppInstance();
  applyAppLogLines(app as never, loadLogFixtureLines('repeated-reward-lines.txt'));

  assert.deepEqual(getDoneBonusIds(app), [
    'act1_freythorn_king_mists_spirit',
    'int3_mount_cryer_lythara_spirit'
  ]);
  assert.equal(getDoneBonusIds(app).includes('act3_azak_bog_ignagduk_spirit'), false);
});

test('unknown interlude zones stay no-guide while preserving act timers', () => {
  const app = createTestAppInstance();

  withMockedNow(1_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:20:10 123 [DEBUG Client] Generating level 64 area "P2_1" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [The Khari Crossing]');
    (app as any).startRunTimerFromAnchor(1_000);
  });

  withMockedNow(2_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:21:10 123 [DEBUG Client] Generating level 65 area "P2_unknown_test" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Silent Summit]');
  });

  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.rawZoneName, 'Silent Summit');
  assert.equal(getCurrentActElapsedMsForAct((app as any).config.runTimer, 5, 2_000), 1_000);

  withMockedNow(3_000, () => {
    applyAppLogLine(app as never, '2026/05/16 22:22:10 123 [DEBUG Client] Generating level 66 area "P2_unknown_test" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Uncharted Vault]');
  });

  assert.equal((app as any).currentZone.guide, null);
  assert.equal((app as any).currentZone.rawZoneName, 'Uncharted Vault');
  assert.equal(getCurrentActElapsedMsForAct((app as any).config.runTimer, 5, 3_000), 2_000);
});

test('similar-zone regression pairs stay separated by exact area id', () => {
  const service = loadGuideService();
  const cases = [
    ['P2_6', 'Qimah'],
    ['P2_7', 'Qimah Reservoir'],
    ['P1_4', 'Holten'],
    ['P1_6', 'Holten Estate'],
    ['P3_Town', 'The Glade'],
    ['P3_1', 'Ashen Forest'],
    ['P3_2', 'Kriar Village'],
    ['P3_5', 'Kriar Peaks'],
    ['P3_4', 'Howling Caves'],
    ['P2_1', 'The Khari Crossing']
  ] as const;

  for (const [areaId, expectedZoneEn] of cases) {
    assert.equal(
      service.resolveZoneMatch({
        rawLine: areaId,
        extractedInternalAreaId: areaId,
        extractedZoneName: expectedZoneEn
      })?.guide?.zone_en,
      expectedZoneEn
    );
  }

  assert.equal(service.findByZoneName('The Galai Gates')?.id, 'interlude_galai_gates');
});

test('overlay/main/settings regressions stay fixed statically', () => {
  const overlay = readText('src/renderer/pages/OverlayPage.tsx');
  const settings = readText('src/renderer/pages/SettingsPage.tsx');
  const main = readMainProcessSource();

  assert.equal(
    shouldStartOverlayDrag({ closest: () => ({}) } as unknown as EventTarget, {
      button: 0
    }),
    false
  );
  assert.doesNotMatch(main, /powerSaveBlocker/);
  assert.doesNotMatch(main, /setPriority\s*\(/);
  assert.doesNotMatch(overlay, /F10 Свернуть/);
  assert.match(overlay, /overlay-lock-icon-button/);
  assert.match(overlay, /getOverlayLockButtonIcon/);
  assert.match(overlay, /overlayMovementLocked/);
  assert.doesNotMatch(overlay, /overlay-lock-button/);
  assert.doesNotMatch(overlay, />\s*(?:Открепить|Закрепить)\s*</);
  assert.doesNotMatch(settings, /support-qr\.png/);
  assert.match(main, /if \(patch\.overlayOpacity !== undefined\) \{/);
  assert.match(main, /if \(patch\.companionAlwaysOnTop !== undefined\) \{/);
});
