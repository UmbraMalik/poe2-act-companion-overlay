import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBonusesByAct,
  getCampaignBonuses,
  groupBonusesByRewardSignature
} from './helpers/bonusTestUtils';
import { loadLogFixtureLines } from './helpers/logFixtures';
import {
  applyAppLogLine,
  applyAppLogLines,
  createTestAppInstance
} from './helpers/zoneTestUtils';

function getDoneBonusIds(app: unknown): string[] {
  return Object.keys((app as { config: { campaignBonusProgress: Record<string, unknown> } }).config.campaignBonusProgress).sort();
}

function getBonusProgress(app: unknown, bonusId: string) {
  return (app as {
    config: { campaignBonusProgress: Record<string, { detectedBy?: string; logLine?: string }> };
  }).config.campaignBonusProgress[bonusId] ?? null;
}

test('repeated reward families exist across acts and remain context-sensitive', () => {
  const grouped = groupBonusesByRewardSignature();
  const repeatedGroups = [...grouped.values()].filter((entries) => entries.length > 1);
  assert.ok(repeatedGroups.length >= 4, 'expected repeated bonus reward families across the campaign');

  for (const group of repeatedGroups) {
    for (const bonus of group) {
      if (bonus.category === 'utility' || bonus.category === 'choice' || bonus.category === 'item') {
        continue;
      }

      assert.ok(
        bonus.eventRules.some((rule) => (rule.zoneIds?.length ?? 0) > 0 || (rule.sceneNames?.length ?? 0) > 0),
        `${bonus.id} needs strict context because its reward line repeats elsewhere`
      );
    }
  }
});

test('campaign bonus data covers every act from Act 1 through Act 5', () => {
  const bonusesByAct = getBonusesByAct();

  for (const act of ['1', '2', '3', '4', '5']) {
    assert.ok((bonusesByAct.get(act) ?? []).length > 0, `Act ${act} must have campaign bonuses`);
  }
});

test('ordinary passive points never auto-complete weapon-set bonuses', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Охотничьи угодья]');
  applyAppLogLine(app as never, ': Вы получили очков пассивных умений: 2.');

  assert.deepEqual(getDoneBonusIds(app), []);

  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');
  assert.deepEqual(getDoneBonusIds(app), ['act1_hunting_grounds_crowbell_weapon_points']);
  assert.equal(getBonusProgress(app, 'act1_hunting_grounds_crowbell_weapon_points')?.detectedBy, 'log');
  assert.match(getBonusProgress(app, 'act1_hunting_grounds_crowbell_weapon_points')?.logLine ?? '', /набор[а]? оружия/);
});

test('repeated same reward line does not tick the next similar weapon-set bonus', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Охотничьи угодья]');

  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');
  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

  assert.deepEqual(getDoneBonusIds(app), ['act1_hunting_grounds_crowbell_weapon_points']);
  assert.equal(
    getDoneBonusIds(app).includes('act1_ogham_farmlands_unas_lute_weapon_points'),
    false
  );
});


test('Una lute reward can be claimed after Ogham Manor town return', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:35:10 123 [DEBUG Client] Generating level 17 area "G1_15" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Замок Огам]');
  applyAppLogLine(app as never, '[SCENE] Set Source [Лагерь Клирфелл]');
  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

  assert.deepEqual(getDoneBonusIds(app), ['act1_ogham_farmlands_unas_lute_weapon_points']);
});


test('Khari Crossing Risu turn-in can be claimed from Khari Bazaar town', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/24 02:25:08 123 [INFO Client] [SCENE] Set Source [Кхарийский базар]');
  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

  assert.deepEqual(getDoneBonusIds(app), ['int2_khari_crossing_aktu_anundr_weapon_points']);
});

test('Khari Crossing molten shrine life reward matches by scene name', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/24 02:27:40 123 [INFO Client] [SCENE] Set Source [Кхарийский перевал]');
  applyAppLogLine(app as never, ': Игрок Umbra получил +5% к максимуму здоровья.');

  assert.deepEqual(getDoneBonusIds(app), ['int2_khari_crossing_life_percent']);
});

test('Olswin weapon-set reward can be claimed after checkpoint return to Holten', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/24 03:10:10 123 [DEBUG Client] Generating level 58 area "C_P1_5" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Вольфенхолд]');
  applyAppLogLine(app as never, '2026/05/24 03:12:10 123 [DEBUG Client] Generating level 57 area "C_P1_4" with seed 2');
  applyAppLogLine(app as never, '[SCENE] Set Source [Холтен]');
  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

  assert.deepEqual(getDoneBonusIds(app), ['int1_wolvenholt_olswin_weapon_points']);
});

test('reward in town uses last gameplay zone context instead of the first matching bonus', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 6 area "G1_2" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Клирфелл]');
  applyAppLogLine(app as never, '[SCENE] Set Source [Лагерь Клирфелл]');
  applyAppLogLine(app as never, ': Игрок Umbra получил +10% к сопротивлению [Resistances|холоду].');

  assert.deepEqual(getDoneBonusIds(app), ['act1_clearfell_beira_cold_res']);
});

test('insufficient context prefers no auto-tracking over a wrong spirit bonus', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, ': Игрок Umbra получил +30 к [Spirit|духу].');
  assert.deepEqual(getDoneBonusIds(app), []);
});

test('spirit rewards do not cross-mark another act and repeated lines are deduped', () => {
  const app = createTestAppInstance();
  applyAppLogLines(app as never, loadLogFixtureLines('repeated-reward-lines.txt').slice(0, 4));

  assert.deepEqual(getDoneBonusIds(app), ['act1_freythorn_king_mists_spirit']);
  assert.equal(getDoneBonusIds(app).includes('act3_azak_bog_ignagduk_spirit'), false);

  applyAppLogLines(app as never, loadLogFixtureLines('repeated-reward-lines.txt').slice(4));
  assert.deepEqual(
    getDoneBonusIds(app),
    ['act1_freythorn_king_mists_spirit', 'int3_mount_cryer_lythara_spirit']
  );
});

test('EN campaign bonus fixture marks the correct act-specific bonuses only', () => {
  const app = createTestAppInstance();
  applyAppLogLines(app as never, loadLogFixtureLines('campaign-bonuses-en.txt'));

  assert.deepEqual(getDoneBonusIds(app), [
    'act4_journeys_end_freya_tujen_weapon_points',
    'int3_mount_cryer_lythara_spirit'
  ]);
});



test('Yeti tusks weapon-set reward can be claimed after returning to Kriar Village', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/24 03:30:10 123 [DEBUG Client] Generating level 55 area "C_P3_4" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Воющие пещеры]');
  applyAppLogLine(app as never, '2026/05/24 03:32:10 123 [DEBUG Client] Generating level 54 area "C_P3_2" with seed 2');
  applyAppLogLine(app as never, '[SCENE] Set Source [Деревня Криар]');
  applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

  assert.deepEqual(getDoneBonusIds(app), ['int3_howling_caves_yeti_weapon_points']);
});

test('Final interlude weapon-set reward is independent from the last completed branch', () => {
  const lastBranchCases = [
    ['P1_6', 'Поместье Холтен'],
    ['P2_7', 'Водохранилище Кима'],
    ['P3_7', 'Убежище Куачик']
  ] as const;

  for (const [areaId, sceneName] of lastBranchCases) {
    const app = createTestAppInstance();
    applyAppLogLine(app as never, `2026/05/24 16:50:00 123 [DEBUG Client] Generating level 58 area "${areaId}" with seed 1`);
    applyAppLogLine(app as never, `[SCENE] Set Source [${sceneName}]`);
    applyAppLogLine(app as never, '[SCENE] Set Source [Кингсмарш]');
    applyAppLogLine(app as never, ': Вы получили 2 очка пассивных умений для набора оружия.');

    assert.deepEqual(getDoneBonusIds(app), ['int3_final_zolin_zelina_weapon_points']);
  }
});

test('Servi venom vial choice can be completed after leaving Venom Crypts', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 33 area "G3_5" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Ядовитые крипты]');
  applyAppLogLine(app as never, '2026/05/16 22:12:10 123 [DEBUG Client] Generating level 33 area "G3_4" with seed 2');
  applyAppLogLine(app as never, '[SCENE] Set Source [Развалины в джунглях]');
  applyAppLogLine(app as never, '[SCENE] Set Source [Лагерь на зиккурате]');

  applyAppLogLine(app as never, ': Игрок Umbra получил 30% увеличение [AilmentThreshold|порога стихийных состояний].');

  assert.deepEqual(getDoneBonusIds(app), ['act3_venom_crypts_choice']);
});

test('Servi venom vial choice also matches EN client reward wording', () => {
  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:10:10 123 [DEBUG Client] Generating level 33 area "G3_5" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Venom Crypts]');
  applyAppLogLine(app as never, '[SCENE] Set Source [The Ziggurat Encampment]');

  applyAppLogLine(app as never, ': Umbra has received 30% increased [AilmentThreshold|Elemental Ailment Threshold].');

  assert.deepEqual(getDoneBonusIds(app), ['act3_venom_crypts_choice']);
});
test('manual-only bonuses stay manual when no reliable reward line exists', () => {
  const salvageBench = getCampaignBonuses().find(
    (bonus) => bonus.id === 'act1_ogham_village_salvage_bench'
  );
  assert.ok(salvageBench, 'salvage bench bonus must exist');
  assert.deepEqual(salvageBench.eventRules, []);

  const app = createTestAppInstance();
  applyAppLogLine(app as never, '2026/05/16 22:20:10 123 [DEBUG Client] Generating level 14 area "G1_13_2" with seed 1');
  applyAppLogLine(app as never, '[SCENE] Set Source [Деревня Огам]');
  applyAppLogLine(app as never, ': Игрок Umbra получил +30 к [Spirit|духу].');

  assert.equal(getDoneBonusIds(app).includes('act1_ogham_village_salvage_bench'), false);
});

test('manual campaign bonus marking can be toggled on and off without auto-tracking side effects', () => {
  const app = createTestAppInstance();

  assert.equal((app as any).setCampaignBonusDone('act1_ogham_village_salvage_bench', 'manual'), true);
  assert.deepEqual(getDoneBonusIds(app), ['act1_ogham_village_salvage_bench']);
  assert.equal(getBonusProgress(app, 'act1_ogham_village_salvage_bench')?.detectedBy, 'manual');
  assert.equal(getBonusProgress(app, 'act1_ogham_village_salvage_bench')?.logLine, undefined);

  assert.equal((app as any).setCampaignBonusDone('act1_ogham_village_salvage_bench', null), true);
  assert.deepEqual(getDoneBonusIds(app), []);
});

test('manual campaign bonus marking ignores unknown bonus ids', () => {
  const app = createTestAppInstance();
  const beforeProgress = JSON.stringify((app as any).config.campaignBonusProgress);

  assert.equal((app as any).setCampaignBonusDone('unknown_bonus_id', 'manual'), false);

  assert.equal(JSON.stringify((app as any).config.campaignBonusProgress), beforeProgress);
  assert.deepEqual(getDoneBonusIds(app), []);
});
