import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { getGuideZones } from './helpers/zoneTestUtils';
import { getGuideView } from '../src/i18n/data';
import { QIMAH_CHOICE_OPTIONS, QIMAH_BONUS_ID, isQimahChoice, getQimahResistanceContribution } from '../src/shared/campaign-bonus-choice';

const zones = new Map(getGuideZones().map((zone) => [zone.id, zone]));

test('campaign routing excludes seasonal loot resources while keeping permanent rewards', () => {
  assert.equal(existsSync('src/data/campaign-bonus-rewards.json'), false);
  assert.equal(existsSync('src/renderer/league-content.ts'), false);
});

test('Boat Charter and trial retry hints have full RU/EN translations', () => {
  for (const [zoneId, ruTerm, enTerm] of [
    ['a4_kingsmarch', 'Чартер корабля', 'Boat Charter'],
    ['a3_temple_of_chaos', 'Распорядителя испытаний', 'Trialmaster']
  ] as const) {
    const zone = zones.get(zoneId)!;
    const ru = getGuideView(zone, 'ru')!;
    const en = getGuideView(zone, 'en')!;
    const ruNewLines = [...ru.checklist.map((item) => item.text), ...ru.important];
    const enNewLines = [...en.checklist.map((item) => item.text), ...en.important];
    assert.ok(ruNewLines.some((line) => line.includes(ruTerm)), `${zoneId} missing RU translation`);
    assert.ok(enNewLines.some((line) => line.includes(enTerm)), `${zoneId} missing EN translation`);
    const enMatched = enNewLines.filter((line) => line.includes(enTerm));
    assert.ok(enMatched.every((line) => !/[а-яё]/i.test(line)), `${zoneId} new EN line contains Russian text`);
  }
});

test('zone spellings preserve legacy log aliases and correct canonical names', () => {
  const kopec = zones.get('a3_temple_kopec')!;
  const bay = zones.get('a4_kids_bay')!;
  assert.equal(kopec.zone_en, 'Temple of Kopec');
  assert.ok(kopec.aliases?.includes('Temple of Kopek'));
  assert.equal(bay.zone_en, 'Kedge Bay');
  assert.ok(bay.aliases?.includes("Kid's Bay"));
});

test('Qimah offers seven localized, validated permanent boon choices', () => {
  assert.equal(QIMAH_BONUS_ID, 'int2_kima_pillar_choice');
  assert.equal(QIMAH_CHOICE_OPTIONS.length, 7);
  assert.ok(QIMAH_CHOICE_OPTIONS.every((choice) => choice.ru && choice.en && isQimahChoice(choice.value)));
  assert.equal(isQimahChoice('nonsense'), false);
});

test('Qimah completion adds no fake resistances unless the chosen boon grants them', () => {
  assert.equal(getQimahResistanceContribution(undefined), 0);
  assert.equal(getQimahResistanceContribution({}), 0);
  assert.equal(getQimahResistanceContribution({ selectedChoice: 'movement' }), 0);
  assert.equal(getQimahResistanceContribution({ selectedChoice: 'resistances' }), 5);
});
