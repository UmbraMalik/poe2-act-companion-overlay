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

const GUIDE_EXTERNAL_NEXT_REFERENCES = new Set([
  'лагерь клирфелл',
  'ваальская часть',
  'жертвенное сердце',
  'врата голай',
  'финальная интерлюдия',
  'тьма',
  'ориат'
]);

const USER_TEXT_GARBAGE_RE = /\b(?:undefined|null|nan|\[object object\])\b/i;
const USER_TEXT_MOJIBAKE_RE = /[ÐÑÃÂâ€]/;

type GuideEntryWithDisplay = GuideEntry & {
  display?: Record<string, unknown>;
};

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

    for (const [itemIndex, item] of zone.checklist.entries()) {
      assertValidText(item.id, `${zone.id}.checklist[${itemIndex}].id`);
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
  const zoneLookup = new Map<string, GuideEntry>();
  const crossActTransitions = new Set<string>();
  let hasAct4Bridge = false;

  for (const zone of zones) {
    for (const candidate of [
      zone.id,
      zone.zone_ru,
      zone.zone_en,
      ...getZoneAliases(zone)
    ]) {
      const normalized = normalizeText(candidate);
      if (normalized) {
        zoneLookup.set(normalized, zone);
      }
    }
  }

  for (const zone of zones) {
    const next = String(zone.next_zone_ru ?? '').trim();
    if (!next) {
      continue;
    }

    assert.notEqual(normalizeText(next), normalizeText(zone.zone_ru), `${zone.id}: next_zone_ru points to itself`);

    const parts = next.split('/').map((part) => normalizeText(part)).filter(Boolean);
    const resolvedZones = parts
      .map((part) => zoneLookup.get(part) ?? null)
      .filter((entry): entry is GuideEntry => Boolean(entry));

    if (resolvedZones.length > 0) {
      resolvedZones.forEach((targetZone) => {
        if (Number(zone.act) !== Number(targetZone.act)) {
          crossActTransitions.add(`${zone.act}->${targetZone.act}`);
        }
        if (Number(zone.act) === 4 && Number(targetZone.act) === 5) {
          hasAct4Bridge = true;
        }
        assert.ok(
          isTransitionToExistingAct(zone, targetZone),
          `${zone.id}: next_zone_ru crosses to unexpected act ${targetZone.id}`
        );
      });
      continue;
    }

    parts.forEach((part) => {
      assert.ok(
        GUIDE_EXTERNAL_NEXT_REFERENCES.has(part),
        `${zone.id}: unresolved next_zone_ru reference "${next}"`
      );
    });

    if (Number(zone.act) === 4 && parts.some((part) => GUIDE_EXTERNAL_NEXT_REFERENCES.has(part))) {
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
