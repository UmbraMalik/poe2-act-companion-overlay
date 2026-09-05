import assert from 'node:assert/strict';
import test from 'node:test';
import { getCampaignLeagueZoneContent } from '../src/renderer/league-content';
import type { GuideEntry, SceneKind } from '../src/shared/types';

function makeSnapshot(
  guideId: string | null,
  sceneKind: SceneKind = 'gameplay',
  rawZoneName: string | null = null
) {
  return {
    currentGuideEntry: guideId ? ({ id: guideId } as GuideEntry) : null,
    currentZone: { sceneKind, rawZoneName }
  };
}

test('bonus rewards expose RU and EN labels for mapped campaign zones', () => {
  const huntingGrounds = getCampaignLeagueZoneContent(makeSnapshot('a1_hunting_grounds'));
  assert.deepEqual(huntingGrounds, {
    rewardId: 'bonus_reward_a1_hunting_grounds',
    reward_en: 'Exalted Orb',
    reward_ru: 'Сфера возвышения'
  });

  const ngakanu = getCampaignLeagueZoneContent(makeSnapshot('a4_ngakanu'));
  assert.deepEqual(ngakanu, {
    rewardId: 'bonus_reward_a4_ngakanu',
    reward_en: "Greater Jeweller's Orb",
    reward_ru: 'Большая сфера златокузнеца'
  });

  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a1_cemetery'))?.reward_en, 'Regal Orb');
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a1_tomb_of_the_consort'))?.reward_en, 'Random Amulet');
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a2_vastiri_outskirts'))?.reward_en, 'Exalted Orb');
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a2_valley_titans'))?.reward_en, 'Random Unique');
});

test('zones not present in the current bonus reward table do not render a bonus reward', () => {
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a1_clearfell')), null);
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a2_keth')), null);
});

test('towns and unresolved zones do not render bonus rewards', () => {
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a1_hunting_grounds', 'town')), null);
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot(null, 'gameplay')), null);
});

test('Aggorat reward is not shown early on the shared Utzaal/Aggorat guide card', () => {
  assert.equal(
    getCampaignLeagueZoneContent(makeSnapshot('a3_vaal_heart', 'gameplay', 'Utzaal')),
    null
  );

  const aggorat = getCampaignLeagueZoneContent(makeSnapshot('a3_vaal_heart', 'gameplay', 'Aggorat'));
  assert.equal(aggorat?.reward_en, 'Uncut Skill Gem (Level 11)');
  assert.equal(aggorat?.reward_ru, 'Неогранённый камень умения (уровень 11)');
});
