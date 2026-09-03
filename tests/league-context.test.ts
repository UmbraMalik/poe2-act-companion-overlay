import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCampaignLeagueToGuideEntry,
  getActiveLeagueContentLayerIds,
  getLeagueMechanicRewards,
  normalizeCampaignLeague
} from '../src/shared/league-context';
import type { GuideEntry } from '../src/shared/types';
import { readJson } from './helpers/loadJson';

function getZone(zoneId: string): GuideEntry {
  const guide = readJson<{ zones: GuideEntry[] }>('src/data/guide.json');
  const zone = guide.zones.find((entry) => entry.id === zoneId);
  assert.ok(zone, `${zoneId} must exist`);
  return zone;
}

test('campaign league normalization accepts only supported league ids', () => {
  assert.equal(normalizeCampaignLeague('forbidden_rites'), 'forbidden_rites');
  assert.equal(normalizeCampaignLeague('runes_of_aldur'), 'runes_of_aldur');
  assert.equal(normalizeCampaignLeague('standard'), 'standard');
  assert.equal(normalizeCampaignLeague('bad-league'), null);
  assert.equal(normalizeCampaignLeague(undefined), null);
});



test('campaign leagues resolve to composable content layers', () => {
  assert.deepEqual(getActiveLeagueContentLayerIds(null), []);
  assert.deepEqual(getActiveLeagueContentLayerIds('standard'), ['core_0_5_5']);
  assert.deepEqual(getActiveLeagueContentLayerIds('runes_of_aldur'), ['runes_of_aldur']);
  assert.deepEqual(getActiveLeagueContentLayerIds('forbidden_rites'), ['core_0_5_5', 'forbidden_rites']);
});

test('base guide stays league-neutral and Runes layer restores its campaign-only hints', () => {
  const base = getZone('a1_hunting_grounds');
  const baseText = JSON.stringify(base);

  assert.doesNotMatch(baseText, /Фарроу|рунный камень|экзальт из лиги/i);
  assert.equal(applyCampaignLeagueToGuideEntry(base, 'standard'), base);
  assert.equal(applyCampaignLeagueToGuideEntry(base, 'forbidden_rites'), base);

  const runes = applyCampaignLeagueToGuideEntry(base, 'runes_of_aldur');
  assert.ok(runes);
  const runesText = JSON.stringify(runes);
  assert.match(runesText, /Забрать рунный камень 2\/3 для Фарроу/i);
  assert.match(runesText, /Сделать лигу за экзальт, если по пути/i);
});

test('guaranteed legacy reward table is exposed only for Runes of Aldur', () => {
  assert.equal(getLeagueMechanicRewards(null).length, 0);
  assert.equal(getLeagueMechanicRewards('standard').length, 0);
  assert.equal(getLeagueMechanicRewards('forbidden_rites').length, 0);

  const rewards = getLeagueMechanicRewards('runes_of_aldur');
  assert.ok(rewards.length > 0);
  assert.ok(rewards.some((reward) => reward.id === 'league_act1_clearfell'));
});
