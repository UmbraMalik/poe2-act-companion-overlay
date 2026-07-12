import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CampaignBonusDefinition,
  CampaignBonusEventRule,
  GuideEntry
} from '../src/shared/types';
import { getCampaignBonuses } from './helpers/bonusTestUtils';
import { readJson } from './helpers/loadJson';
import {
  getGuideData,
  getGuideZones,
  getZoneAliases,
  normalizeText
} from './helpers/zoneTestUtils';

const GUIDE_ALLOWED_DETAIL_KEYS = new Set([
  'route',
  'rewards',
  'skip',
  'important',
  'after',
  'boss_tips',
  'xp_notes',
  'crafting_tips',
  'checkpoint',
  'town_plan',
  'navigation',
  'time_saves',
  'opportunistic',
  'overlay_speedrun',
  'xp_strategy',
  'craft_plan',
  'danger'
]);

const GUIDE_TERMINAL_NEXT_REFERENCES = new Set([
  'ориат'
]);

const GUIDE_DOCUMENTED_RETURN_TRANSITIONS = new Set([
  'i_final_holten_estate->a4_kingsmarch'
]);

const USER_TEXT_GARBAGE_RE = /\b(?:undefined|null|nan|\[object object\])\b/i;
const USER_TEXT_MOJIBAKE_RE = /[ÐÑÃÂâ€]/;

type GuideEntryWithDisplay = GuideEntry & {
  display?: Record<string, unknown>;
};

interface LeagueMechanicRewardEntry {
  id: string;
  zone_en: string;
  zone_ru: string;
  guideZoneId: string | null;
  guideZoneRu: string | null;
  reward_en: string;
  reward_ru: string;
  rewardType: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  oneTimeGuaranteed: boolean;
  coverageNote: string | null;
  uncertain: boolean;
  source: string;
}

interface LeagueMechanicRewardsDataFile {
  version: string;
  source: {
    official: boolean;
    verified: string;
  };
  rewards: LeagueMechanicRewardEntry[];
}

interface InternalAreaAliasesDataFile {
  areaToGuideId: Record<string, string>;
}

function assertValidText(value: unknown, label: string): void {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  const text = String(value);
  assert.notEqual(text.trim(), '', `${label} must not be empty`);
  assert.match(text, /\S/, `${label} must contain visible text`);
  assert.equal(USER_TEXT_GARBAGE_RE.test(text), false, `${label} contains placeholder garbage`);
  assert.equal(USER_TEXT_MOJIBAKE_RE.test(text), false, `${label} contains mojibake`);
}

function collectGuideTextEntries(zone: GuideEntryWithDisplay): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    [`${zone.id}.id`, zone.id],
    [`${zone.id}.zone_ru`, zone.zone_ru],
    [`${zone.id}.zone_en`, zone.zone_en],
    [`${zone.id}.recommended_level_label`, zone.recommended_level_label],
    [`${zone.id}.next_zone_ru`, zone.next_zone_ru]
  ];

  for (const field of [
    'aliases',
    'aliases_en',
    'zone_aliases',
    'rewards',
    'skip',
    'important',
    'after',
    'boss_tips',
    'xp_notes',
    'crafting_tips',
    'area_ids'
  ] as const) {
    for (const [index, item] of (zone[field] ?? []).entries()) {
      entries.push([`${zone.id}.${field}[${index}]`, String(item)]);
    }
  }

  for (const [index, item] of (zone.checklist ?? []).entries()) {
    entries.push([`${zone.id}.checklist[${index}].id`, item.id]);
    entries.push([`${zone.id}.checklist[${index}].text`, item.text]);
    for (const [keywordIndex, keyword] of item.autoCompleteKeywords.entries()) {
      entries.push([
        `${zone.id}.checklist[${index}].autoCompleteKeywords[${keywordIndex}]`,
        keyword
      ]);
    }
  }

  if (zone.details && !Array.isArray(zone.details) && typeof zone.details === 'object') {
    for (const [key, value] of Object.entries(zone.details)) {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => {
          entries.push([`${zone.id}.details.${key}[${index}]`, String(entry)]);
        });
      }
    }
  }

  return entries;
}

function isTransitionToExistingAct(
  zone: GuideEntry,
  targetZone: GuideEntry | null
): boolean {
  if (!targetZone) {
    return false;
  }

  return (
    targetZone.act === zone.act ||
    (typeof zone.act === 'number' &&
      typeof targetZone.act === 'number' &&
      targetZone.act === zone.act + 1)
  );
}

function validateBonusRule(rule: CampaignBonusEventRule, bonus: CampaignBonusDefinition): void {
  assert.ok(Array.isArray(rule.all), `${bonus.id}: event rule all[] is required`);
  for (const [index, phrase] of rule.all.entries()) {
    assertValidText(phrase, `${bonus.id}.eventRules.all[${index}]`);
  }

  for (const [index, phrase] of (rule.any ?? []).entries()) {
    assertValidText(phrase, `${bonus.id}.eventRules.any[${index}]`);
  }

  for (const [index, phrase] of (rule.none ?? []).entries()) {
    assertValidText(phrase, `${bonus.id}.eventRules.none[${index}]`);
  }

  for (const [index, zoneId] of (rule.zoneIds ?? []).entries()) {
    assertValidText(zoneId, `${bonus.id}.eventRules.zoneIds[${index}]`);
  }

  for (const [index, sceneName] of (rule.sceneNames ?? []).entries()) {
    assertValidText(sceneName, `${bonus.id}.eventRules.sceneNames[${index}]`);
  }
}

test('guide.json has full top-level campaign coverage for Acts 1-5', () => {
  const guide = getGuideData();
  const zones = guide.zones;
  assert.ok(Array.isArray(zones), 'guide.zones must be an array');
  assert.ok(zones.length >= 70, 'guide should contain the full campaign');

  const actCounts = new Map<number, number>();
  for (const zone of zones) {
    actCounts.set(Number(zone.act), (actCounts.get(Number(zone.act)) ?? 0) + 1);
  }

  for (const act of [1, 2, 3, 4, 5]) {
    assert.ok((actCounts.get(act) ?? 0) > 0, `Act ${act} must have guide entries`);
  }
});

test('every guide entry has valid ids, acts, names, route blocks and checklist blocks', () => {
  const seenIds = new Set<string>();

  for (const zone of getGuideZones() as GuideEntryWithDisplay[]) {
    assertValidText(zone.id, 'guide.id');
    assert.equal(seenIds.has(zone.id), false, `duplicate guide id: ${zone.id}`);
    seenIds.add(zone.id);

    assert.ok([1, 2, 3, 4, 5].includes(Number(zone.act)), `${zone.id}: invalid act ${zone.act}`);
    assertValidText(zone.zone_ru, `${zone.id}.zone_ru`);
    assertValidText(zone.zone_en, `${zone.id}.zone_en`);
    assertValidText(zone.recommended_level_label, `${zone.id}.recommended_level_label`);

    if (zone.recommended_level !== null) {
      assert.ok(
        Number.isFinite(zone.recommended_level) &&
          zone.recommended_level >= 1 &&
          zone.recommended_level <= 100,
        `${zone.id}: invalid recommended_level ${zone.recommended_level}`
      );
    }

    assert.ok(Array.isArray(zone.checklist) && zone.checklist.length > 0, `${zone.id}: checklist is required`);
    const checklistIds = new Set<string>();

    for (const [itemIndex, item] of zone.checklist.entries()) {
      assertValidText(item.id, `${zone.id}.checklist[${itemIndex}].id`);
      assert.equal(
        checklistIds.has(item.id),
        false,
        `${zone.id}: duplicate checklist id ${item.id}`
      );
      checklistIds.add(item.id);
      assertValidText(item.text, `${zone.id}.checklist[${itemIndex}].text`);
      assert.equal(typeof item.required, 'boolean', `${zone.id}.checklist[${itemIndex}].required must be boolean`);
      assert.ok(Array.isArray(item.autoCompleteKeywords), `${zone.id}.checklist[${itemIndex}].autoCompleteKeywords must be an array`);
    }

    if (zone.details !== undefined && zone.details !== null) {
      assert.equal(Array.isArray(zone.details), false, `${zone.id}.details must be an object`);
      assert.equal(typeof zone.details, 'object', `${zone.id}.details must be an object`);

      for (const [key, value] of Object.entries(zone.details as Record<string, unknown>)) {
        assert.ok(GUIDE_ALLOWED_DETAIL_KEYS.has(key), `${zone.id}.details.${key} is unexpected`);
        assert.ok(Array.isArray(value), `${zone.id}.details.${key} must be an array`);
      }
    }

    assert.ok(zone.display && typeof zone.display === 'object', `${zone.id}.display must exist`);
  }
});

test('guide text fields are user-safe across all acts and zones', () => {
  for (const zone of getGuideZones() as GuideEntryWithDisplay[]) {
    for (const [label, value] of collectGuideTextEntries(zone)) {
      if (!String(value).trim()) {
        continue;
      }
      assertValidText(value, label);
    }
  }
});

test('guide next-zone references either resolve to the route or stay within allowed external destinations', () => {
  const zones = getGuideZones();
  const canonicalZoneLookup = new Map<string, GuideEntry>();
  const aliasNames = new Set<string>();
  const crossActTransitions = new Set<string>();
  let hasAct4Bridge = false;

  for (const zone of zones) {
    const canonicalName = normalizeText(zone.zone_ru);
    if (canonicalName) {
      canonicalZoneLookup.set(canonicalName, zone);
    }
    for (const alias of getZoneAliases(zone)) {
      const normalizedAlias = normalizeText(alias);
      if (normalizedAlias && normalizedAlias !== canonicalName) {
        aliasNames.add(normalizedAlias);
      }
    }
  }

  for (const zone of zones) {
    const next = String(zone.next_zone_ru ?? '').trim();
    if (!next) {
      continue;
    }

    assert.notEqual(normalizeText(next), normalizeText(zone.zone_ru), `${zone.id}: next_zone_ru points to itself`);

    const normalizedNext = normalizeText(next);
    const targetZone = canonicalZoneLookup.get(normalizedNext) ?? null;

    if (targetZone) {
      const documentedReturnKey = `${zone.id}->${targetZone.id}`;
      const isDocumentedReturn = GUIDE_DOCUMENTED_RETURN_TRANSITIONS.has(documentedReturnKey);
      if (Number(zone.act) !== Number(targetZone.act) && !isDocumentedReturn) {
        crossActTransitions.add(`${zone.act}->${targetZone.act}`);
      }
      if (Number(zone.act) === 4 && Number(targetZone.act) === 5) {
        hasAct4Bridge = true;
      }
      if (!isDocumentedReturn) {
        assert.ok(
          isTransitionToExistingAct(zone, targetZone),
          `${zone.id}: next_zone_ru crosses to unexpected act ${targetZone.id}`
        );
      }
      continue;
    }

    assert.equal(next.includes('/'), false, `${zone.id}: composite next_zone_ru is not canonical: "${next}"`);
    assert.equal(aliasNames.has(normalizedNext), false, `${zone.id}: next_zone_ru uses an alias: "${next}"`);
    assert.ok(
      GUIDE_TERMINAL_NEXT_REFERENCES.has(normalizedNext),
      `${zone.id}: unresolved next_zone_ru reference "${next}"`
    );

    if (Number(zone.act) === 4 && GUIDE_TERMINAL_NEXT_REFERENCES.has(normalizedNext)) {
      hasAct4Bridge = true;
    }
  }

  assert.deepEqual(
    [...crossActTransitions].sort(),
    ['1->2', '2->3', '3->4', '4->5'],
    'guide next-zone chain must preserve the direct in-guide act transitions'
  );
  assert.equal(hasAct4Bridge, true, 'Act 4 must still bridge into Act 5 / interlude transition');
});

test('campaign bonuses are structurally valid across all acts and repeated reward families', () => {
  const guideIds = new Set(getGuideZones().map((zone) => zone.id));
  const validCategories = new Set([
    'passive',
    'weapon_set_passive',
    'resistance',
    'spirit',
    'life',
    'mana',
    'choice',
    'utility',
    'item'
  ]);
  const seenIds = new Set<string>();
  const repeatedRewardFamilies = new Map<string, number>();

  for (const bonus of getCampaignBonuses()) {
    assertValidText(bonus.id, 'bonus.id');
    assert.equal(seenIds.has(bonus.id), false, `duplicate bonus id: ${bonus.id}`);
    seenIds.add(bonus.id);

    assert.ok([1, 2, 3, 4, 5].includes(Number(bonus.act)), `${bonus.id}: invalid act ${bonus.act}`);
    assert.ok(validCategories.has(bonus.category), `${bonus.id}: invalid category ${bonus.category}`);
    assertValidText(bonus.title, `${bonus.id}.title`);
    assertValidText(bonus.zone_ru, `${bonus.id}.zone_ru`);
    assertValidText(bonus.source, `${bonus.id}.source`);
    assert.ok(Array.isArray(bonus.details), `${bonus.id}.details must be an array`);
    bonus.details.forEach((detail, index) => assertValidText(detail, `${bonus.id}.details[${index}]`));

    assert.ok(bonus.reward && typeof bonus.reward === 'object', `${bonus.id}: reward is required`);
    assert.ok(Number.isFinite(bonus.reward.value), `${bonus.id}: reward.value must be numeric`);
    assert.ok(Array.isArray(bonus.eventRules), `${bonus.id}: eventRules must be an array`);

    if (bonus.zoneId) {
      assert.ok(guideIds.has(bonus.zoneId), `${bonus.id}: missing zoneId ${bonus.zoneId}`);
    }

    bonus.eventRules.forEach((rule) => validateBonusRule(rule, bonus));

    const rewardSignature = JSON.stringify(bonus.reward);
    repeatedRewardFamilies.set(
      rewardSignature,
      (repeatedRewardFamilies.get(rewardSignature) ?? 0) + 1
    );

    if (bonus.category === 'utility' || bonus.category === 'choice' || bonus.category === 'item') {
      continue;
    }

    if (repeatedRewardFamilies.get(rewardSignature)! > 1) {
      assert.ok(
        bonus.eventRules.some(
          (rule) => (rule.zoneIds?.length ?? 0) > 0 || (rule.sceneNames?.length ?? 0) > 0
        ),
        `${bonus.id}: repeated reward family must be zone- or scene-guarded`
      );
    }
  }
});

test('guide and bonuses JSON files stay JSON-object based', () => {
  const guide = readJson<Record<string, unknown>>('src/data/guide.json');
  const bonuses = readJson<Record<string, unknown>>('src/data/campaign-bonuses.json');
  assert.equal(Array.isArray(guide), false, 'guide.json should remain an object with zones[]');
  assert.equal(Array.isArray(bonuses), false, 'campaign-bonuses.json should remain an object with bonuses[]');
  assert.ok(Array.isArray(guide.zones), 'guide.json must expose zones[]');
  assert.ok(Array.isArray(bonuses.bonuses), 'campaign-bonuses.json must expose bonuses[]');
});

test('all shipped campaign data files parse as JSON', () => {
  for (const relativePath of [
    'src/data/guide.json',
    'src/data/campaign-bonuses.json',
    'src/data/league-mechanic-rewards.json',
    'src/data/internal-area-aliases.en.json',
    'src/data/internal-area-aliases.en.conservative.json',
    'src/data/town-scenes.json',
    'src/data/log-patterns.ru.json',
    'src/data/log-patterns.en.json',
    'src/data/power-spikes.json'
  ]) {
    assert.doesNotThrow(() => readJson<unknown>(relativePath), `${relativePath} must parse`);
  }
});

test('league rewards are structurally valid, canonical and safe to display', () => {
  const data = readJson<LeagueMechanicRewardsDataFile>('src/data/league-mechanic-rewards.json');
  const guideById = new Map(getGuideZones().map((zone) => [zone.id, zone]));
  const seenIds = new Set<string>();

  assert.match(data.version, /0\.5.*2026-07-13/);
  assert.equal(data.source.official, false, 'community reward tables must not be labelled official');
  assert.equal(data.source.verified, '2026-07-13');
  assert.ok(Array.isArray(data.rewards) && data.rewards.length > 0);

  for (const reward of data.rewards) {
    assertValidText(reward.id, 'leagueReward.id');
    assert.equal(seenIds.has(reward.id), false, `duplicate league reward id: ${reward.id}`);
    seenIds.add(reward.id);
    assertValidText(reward.zone_en, `${reward.id}.zone_en`);
    assertValidText(reward.zone_ru, `${reward.id}.zone_ru`);
    assertValidText(reward.reward_en, `${reward.id}.reward_en`);
    assertValidText(reward.reward_ru, `${reward.id}.reward_ru`);
    assertValidText(reward.rewardType, `${reward.id}.rewardType`);
    assert.equal(typeof reward.hasReward, 'boolean', `${reward.id}.hasReward must be boolean`);
    assert.equal(typeof reward.displayInOverlay, 'boolean', `${reward.id}.displayInOverlay must be boolean`);
    assert.equal(typeof reward.oneTimeGuaranteed, 'boolean', `${reward.id}.oneTimeGuaranteed must be boolean`);
    assert.equal(typeof reward.uncertain, 'boolean', `${reward.id}.uncertain must be boolean`);
    assert.doesNotMatch(reward.source, /2026-04-06|\[0\.4\].*updated/i, `${reward.id}: stale source`);

    if (reward.guideZoneId) {
      const guide = guideById.get(reward.guideZoneId);
      assert.ok(guide, `${reward.id}: missing guideZoneId ${reward.guideZoneId}`);
      assert.equal(reward.guideZoneRu, guide.zone_ru, `${reward.id}: guideZoneRu must be canonical`);
      assert.doesNotMatch(
        reward.coverageNote ?? '',
        /no guide zone|no guide zone card/i,
        `${reward.id}: linked card cannot be described as missing`
      );
    }

    if (reward.uncertain) {
      assert.equal(reward.hasReward, false, `${reward.id}: uncertain reward cannot be confirmed`);
      assert.equal(reward.displayInOverlay, false, `${reward.id}: uncertain reward cannot be displayed`);
      assert.equal(reward.oneTimeGuaranteed, false, `${reward.id}: uncertain reward cannot be guaranteed`);
      assert.match(reward.coverageNote ?? '', /unconfirmed|verification/i);
    }
  }
});

test('league reward regressions stay synchronized with guide cards', () => {
  const rewards = readJson<LeagueMechanicRewardsDataFile>('src/data/league-mechanic-rewards.json').rewards;
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));
  const guideById = new Map(getGuideZones().map((zone) => [zone.id, zone]));

  const scorchedReward = rewardsById.get('league_interlude1_scorched_farmlands');
  const scorchedGuide = guideById.get('interlude_scorched_farmlands');
  assert.ok(scorchedReward && scorchedGuide);
  assert.equal(scorchedReward.reward_en, 'Uncut Support Gem (Level 4)');
  assert.equal(scorchedReward.reward_ru, 'Неогранённый камень поддержки, ур. 4');
  assert.match(JSON.stringify(scorchedGuide), /кам(?:ень|ня) поддержки 4 уровня|ур\. 4/i);
  assert.doesNotMatch(JSON.stringify(scorchedGuide), /кам(?:ень|ня) поддержки 5 уровня|ур\. 5|Lv5/i);

  const mudBurrow = rewardsById.get('league_act1_mud_burrow');
  assert.ok(mudBurrow);
  assert.equal(mudBurrow.guideZoneId, 'a1_mud_burrow');
  assert.equal(mudBurrow.guideZoneRu, 'Грязевая нора');
  assert.equal(mudBurrow.reward_ru, 'Сфера усиления');
  assert.equal(mudBurrow.displayInOverlay, true);

  const kopec = rewardsById.get('league_act3_temple_of_kopec');
  assert.ok(kopec);
  assert.equal(kopec.zone_ru, 'Храм Копека');
  assert.equal(kopec.guideZoneRu, 'Храм Копека');
});

test('both internal area alias tables target real cards without case conflicts', () => {
  const guideIds = new Set(getGuideZones().map((zone) => zone.id));

  for (const relativePath of [
    'src/data/internal-area-aliases.en.json',
    'src/data/internal-area-aliases.en.conservative.json'
  ]) {
    const mapping = readJson<InternalAreaAliasesDataFile>(relativePath).areaToGuideId;
    const normalizedTargets = new Map<string, string>();

    for (const [areaId, guideId] of Object.entries(mapping)) {
      assert.ok(guideIds.has(guideId), `${relativePath}: ${areaId} targets missing ${guideId}`);
      const normalizedAreaId = areaId.trim().toLowerCase();
      const previousTarget = normalizedTargets.get(normalizedAreaId);
      assert.ok(
        !previousTarget || previousTarget === guideId,
        `${relativePath}: ${areaId} conflicts with normalized target ${previousTarget}`
      );
      normalizedTargets.set(normalizedAreaId, guideId);
    }

    for (const [areaId, expectedGuideId] of [
      ['g1_3', 'a1_mud_burrow'],
      ['c_g1_3', 'a1_mud_burrow'],
      ['p2_5', 'interlude_galai_gates'],
      ['p3_3', 'interlude_glacial_tarn'],
      ['p3_4', 'i2_glacial_tarn'],
      ['p3_5', 'i2_kriar_peaks']
    ] as const) {
      assert.equal(normalizedTargets.get(areaId), expectedGuideId, `${relativePath}: ${areaId}`);
    }
  }
});

test('campaign bonus references and summary totals remain complete', () => {
  const data = readJson<{
    summaryTargets: Record<string, number>;
    bonuses: CampaignBonusDefinition[];
  }>('src/data/campaign-bonuses.json');
  const guideIds = new Set(getGuideZones().map((zone) => zone.id));
  const totals: Record<string, number> = {};

  for (const bonus of data.bonuses) {
    for (const rule of bonus.eventRules) {
      for (const zoneId of rule.zoneIds ?? []) {
        assert.ok(guideIds.has(zoneId), `${bonus.id}: event rule targets missing ${zoneId}`);
      }
    }

    totals[bonus.reward.type] = (totals[bonus.reward.type] ?? 0) + bonus.reward.value;
  }

  const allResistance = totals.all_elemental_resistance ?? 0;
  assert.equal(totals.weapon_set_passive_points, 24);
  assert.equal(totals.spirit, 100);
  assert.equal((totals.cold_resistance ?? 0) + allResistance, 20);
  assert.equal((totals.fire_resistance ?? 0) + allResistance, 20);
  assert.equal((totals.lightning_resistance ?? 0) + allResistance, 20);
  assert.equal(totals.flat_life, 20);
  assert.equal(totals.increased_life, 5);
  assert.equal(totals.increased_mana, 5);
  assert.deepEqual(data.summaryTargets, {
    weaponSetPassivePoints: 24,
    coldResistance: 20,
    fireResistance: 20,
    lightningResistance: 20,
    spirit: 100,
    flatLife: 20,
    increasedLife: 5,
    increasedMana: 5
  });
});

test('Halls of the Dead keeps the verified attribute and resistance pairs', () => {
  const bonusesById = new Map(getCampaignBonuses().map((bonus) => [bonus.id, bonus]));
  const fire = bonusesById.get('act4_halls_dead_fire_choice');
  const cold = bonusesById.get('act4_halls_dead_cold_choice');
  const lightning = bonusesById.get('act4_halls_dead_lightning_choice');
  assert.ok(fire && cold && lightning);
  assert.match(`${fire.title} ${fire.details.join(' ')}`, /сил/);
  assert.match(`${cold.title} ${cold.details.join(' ')}`, /интеллект/);
  assert.match(`${lightning.title} ${lightning.details.join(' ')}`, /ловкост/);
  assert.equal(fire.reward.type, 'fire_resistance');
  assert.equal(cold.reward.type, 'cold_resistance');
  assert.equal(lightning.reward.type, 'lightning_resistance');
});

test('final Interlude bonus is global, branch-independent and counted once', () => {
  const bonuses = getCampaignBonuses();
  const matches = bonuses.filter((bonus) => bonus.id === 'int3_final_zolin_zelina_weapon_points');
  assert.equal(matches.length, 1, 'legacy persisted id must remain unique');
  const finalBonus = matches[0];
  assert.equal(finalBonus.zoneId, undefined);
  assert.equal(finalBonus.zone_ru, 'Кингсмарш');
  assert.equal(finalBonus.reward.type, 'weapon_set_passive_points');
  assert.equal(finalBonus.reward.value, 2);
  assert.doesNotMatch(`${finalBonus.source} ${finalBonus.details.join(' ')}`, /Золин|Зелин|Поместье Холтен/i);
  assert.ok(finalBonus.eventRules.every((rule) => (rule.zoneIds?.length ?? 0) === 0));
  assert.ok(finalBonus.eventRules.some((rule) => rule.sceneNames?.includes('Кингсмарш')));
});

test('Act 4 ordinary quest rewards stay in guide cards and separate from permanent or league rewards', () => {
  const guideById = new Map(getGuideZones().map((zone) => [zone.id, zone]));
  const expectedText = new Map<string, RegExp[]>([
    ['a4_isle_of_kin', [/зелье сульфита/i, /Неогранённый камень умения/i, /Большая пустая руна/i]],
    ['a4_isle_of_screams', [/выбор кольца сопротивления/i, /Неогранённый камень умения/i]],
    ['a4_whakapanu_island', [/Награда квеста Вакапану/i, /Неогранённый камень умения/i]],
    ['a4_abandoned_prison', [/выбор амулета характеристик/i, /Неогранённый камень умения/i]]
  ]);

  for (const [guideId, patterns] of expectedText) {
    const guide = guideById.get(guideId);
    assert.ok(guide, `${guideId} must exist`);
    const serialized = JSON.stringify(guide);
    patterns.forEach((pattern) => assert.match(serialized, pattern, `${guideId}: ${pattern}`));
  }

  const permanentBonusText = JSON.stringify(getCampaignBonuses());
  assert.doesNotMatch(permanentBonusText, /зелье сульфита|выбор кольца сопротивления|выбор амулета характеристик/i);

  const leagueRewards = readJson<LeagueMechanicRewardsDataFile>('src/data/league-mechanic-rewards.json').rewards;
  const whakapanuLeagueReward = leagueRewards.find((reward) => reward.guideZoneId === 'a4_whakapanu_island');
  assert.ok(whakapanuLeagueReward);
  assert.equal(whakapanuLeagueReward.reward_ru, 'Сфера астромантии');
});

test('Great White permanent reward is required and distinct from the Whakapanu league reward', () => {
  const whakapanu = getGuideZones().find((zone) => zone.id === 'a4_whakapanu_island');
  assert.ok(whakapanu);
  const requiredIds = new Set((whakapanu.checklist ?? []).filter((item) => item.required).map((item) => item.id));
  assert.ok(requiredIds.has('a4_whakapanu_island_task_2'));
  assert.ok(requiredIds.has('a4_whakapanu_island_task_3'));
  assert.ok(requiredIds.has('a4_whakapanu_island_task_4'));
  assert.ok(getCampaignBonuses().some((bonus) => bonus.id === 'act4_whakapanu_shark_fin_choice'));
});

test('Interlude guidance avoids stale levels and preserves both route strategies', () => {
  const guideById = new Map(getGuideZones().map((zone) => [zone.id, zone]));
  for (const guideId of [
    'interlude_khari_bazaar',
    'interlude_khari_crossing',
    'interlude_selvari_sanctuary'
  ]) {
    const guide = guideById.get(guideId);
    assert.ok(guide);
    assert.equal(guide.recommended_level, null);
    assert.doesNotMatch(guide.recommended_level_label, /\b(?:48|49)\b/);
    assert.match(guide.recommended_level_label, /зависит от порядка/);
  }

  assert.equal(guideById.get('a4_heart_of_the_tribe')?.next_zone_ru, 'Кхарийский базар');
  const interludeText = JSON.stringify(readJson<Record<string, unknown>>('src/data/guide.json'));
  assert.match(interludeText, /Кхарийский базар → Гора Криар → (?:Пристанище )?Огам/);
  assert.match(interludeText, /Если билду критично нужен дух, начни с Горы Криар/);
  assert.match(interludeText, /Уровни зон, камней и части наград интерлюдий могут зависеть от порядка/);
});
