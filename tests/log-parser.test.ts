import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGeneratedAreaId,
  extractNamedZoneFromLine,
  parseClientRestart,
  parseLevelUp,
  parseLogLine,
  parsePermanentReward,
  parsePlayerDeath,
  parseSceneSource
} from '../src/main/services/log-parser';
import { loadLogFixtureLines } from './helpers/logFixtures';
import { readText } from './helpers/loadJson';
import {
  applyAppLogLine,
  applyAppLogLines,
  createTestAppInstance
} from './helpers/zoneTestUtils';

test('extracts generated internal area ids and named scene sources from RU/EN logs', () => {
  assert.equal(
    extractGeneratedAreaId('2026/05/16 22:04:58 38703593 [DEBUG Client] Generating level 15 area "G1_11" with seed 1'),
    'G1_11'
  );
  assert.equal(extractNamedZoneFromLine('[SCENE] Set Source [Лагерь Клирфелл]'), 'Лагерь Клирфелл');
  assert.equal(extractNamedZoneFromLine('You have entered The Glade.'), 'The Glade');
  assert.deepEqual(parseSceneSource('[SCENE] Set Source [The Khari Crossing]'), { rawZoneName: 'The Khari Crossing' });
  assert.equal(parseSceneSource('[SCENE] Set Source [(null)]'), null);
});

test('parses core RU and EN level-up, death and reward lines', () => {
  assert.equal(parseLevelUp(': Umbra (Witch) достигает 13 уровня')?.level, 13);
  assert.equal(parseLevelUp(': Umbra (Witch) is now level 14')?.level, 14);
  assert.equal(parsePlayerDeath(': Umbra был повержен.')?.player, 'Umbra');
  assert.equal(parsePlayerDeath(': Umbra has been slain.')?.player, 'Umbra');

  assert.equal(parsePermanentReward(': Вы получили очков пассивных умений: 2.')?.rewardKey, 'passivePoints');
  assert.equal(parsePermanentReward(': Вы получили 2 очка пассивных умений для набора оружия.')?.rewardKey, 'weaponSetPassivePoints');
  assert.equal(parsePermanentReward(': You have received 2 Passive Skill Points.')?.rewardKey, 'passivePoints');
  assert.equal(parsePermanentReward(': You have received 2 Weapon Set Passive Skill Points.')?.rewardKey, 'weaponSetPassivePoints');
  assert.equal(parsePermanentReward(': Игрок Umbra получил +30 к [Spirit|духу].')?.rewardKey, 'spirit30');
  assert.equal(parsePermanentReward(': Umbra has received +40 to [Spirit|Spirit].')?.rewardKey, 'spirit40');
});

test('parseLogLine keeps stable event types for core log events and ignores unrelated focus noise', () => {
  assert.equal(parseLogLine('***** LOG FILE OPENING *****').type, 'client_restart');
  assert.equal(parseLogLine('[SCENE] Set Source [Деревня Огам]').type, 'scene_source');
  assert.equal(parseLogLine(': You have received 2 Weapon Set Passive Skill Points.').type, 'permanent_reward');
  assert.equal(parseLogLine('[Client] Lost focus').type, 'none');
  assert.equal(parseLogLine('[Client] Gained focus').type, 'none');
  assert.equal(parseClientRestart('***** LOG FILE OPENING *****'), true);
});

test('log parser keeps JSON pattern regexes precompiled', () => {
  const parserSource = readText('src/main/services/log-parser.ts');

  assert.doesNotMatch(parserSource, /SCENE_SOURCE_REGEXES/);
  assert.match(parserSource, /const logPatternRegexes =/);
  assert.match(parserSource, /function firstMatch\(patterns: RegExp\[\], line: string\)/);
  assert.doesNotMatch(parserSource, /line\.match\(makeRegex\(pattern\)\)/);
});

test('RU act 1 fixture leaves the app in town while preserving the last gameplay zone and level', () => {
  const app = createTestAppInstance();
  applyAppLogLines(app as never, loadLogFixtureLines('ru-act1-basic.txt'));

  assert.equal((app as any).currentZone.sceneKind, 'town');
  assert.equal((app as any).currentZone.rawZoneName, 'Лагерь Клирфелл');
  assert.equal((app as any).runtime.lastGameplayGuideId, 'a1_grelwood');
  assert.equal((app as any).runtime.lastGameplayAct, 1);
  assert.equal((app as any).config.currentLevel, 4);
});

test('EN act 1 fixture keeps gameplay mapping, level-up and death parsing stable', () => {
  const app = createTestAppInstance();
  applyAppLogLines(app as never, loadLogFixtureLines('en-act1-basic.txt'));

  assert.equal((app as any).currentZone.sceneKind, 'town');
  assert.equal((app as any).runtime.lastGameplayGuideId, 'a1_hunting_grounds');
  assert.equal((app as any).runtime.lastGameplayAct, 1);
  assert.equal((app as any).config.currentLevel, 12);
});

test('lost focus and gained focus lines do not disturb the current mapped zone state', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 6 area "G1_4" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Грельвуд]');

  const before = {
    guideId: (app as any).currentZone.guide?.id ?? null,
    rawZoneName: (app as any).currentZone.rawZoneName,
    sceneKind: (app as any).currentZone.sceneKind
  };

  applyAppLogLine(app as never, '[Client] Lost focus');
  applyAppLogLine(app as never, '[Client] Gained focus');

  assert.deepEqual(
    {
      guideId: (app as any).currentZone.guide?.id ?? null,
      rawZoneName: (app as any).currentZone.rawZoneName,
      sceneKind: (app as any).currentZone.sceneKind
    },
    before
  );
});

test('RU and EN no-guide fixtures preserve raw names and clear stale guide cards', () => {
  for (const fixtureName of ['ru-no-guide-zones.txt', 'en-no-guide-zones.txt']) {
    const app = createTestAppInstance();
    applyAppLogLine(app as never, '2026/05/16 22:30:10 123 [DEBUG Client] Generating level 6 area "G1_4" with seed 1');
    applyAppLogLine(app as never, '[SCENE] Set Source [Grelwood]');
    applyAppLogLines(app as never, loadLogFixtureLines(fixtureName));

    assert.equal((app as any).currentZone.guide, null, `${fixtureName}: no-guide zone must not keep the previous guide card`);
    assert.notEqual((app as any).currentZone.rawZoneName, null, `${fixtureName}: raw zone name must stay visible`);
    assert.equal(typeof (app as any).runtime.lastGameplayAct, 'number', `${fixtureName}: act context must survive no-guide zones`);
  }
});
