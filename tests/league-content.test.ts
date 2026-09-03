import assert from 'node:assert/strict';
import test from 'node:test';
import { getCampaignLeagueZoneContent } from '../src/renderer/league-content';
import type { GuideEntry, SceneKind } from '../src/shared/types';

function makeSnapshot(guideId: string | null, sceneKind: SceneKind = 'gameplay') {
  return {
    currentGuideEntry: guideId ? ({ id: guideId } as GuideEntry) : null,
    currentZone: { sceneKind }
  };
}

test('ordinary campaign gameplay zones expose generic league content', () => {
  const content = getCampaignLeagueZoneContent(makeSnapshot('a1_red_vale'));

  assert.ok(content);
  assert.equal(content.bossRitual, null);
});

test('towns and unresolved zones do not expose campaign league content', () => {
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot('a1_clearfell_encampment', 'town')), null);
  assert.equal(getCampaignLeagueZoneContent(makeSnapshot(null, 'gameplay')), null);
});

test('the demonstrated Act 1 boss Ritual chain is mapped in order', () => {
  const expected = [
    ['a1_clearfell', 1],
    ['a1_mud_burrow', 2],
    ['a1_grelwood', 3],
    ['a1_grim_tangle', 4]
  ] as const;

  for (const [guideId, step] of expected) {
    const content = getCampaignLeagueZoneContent(makeSnapshot(guideId));
    assert.ok(content?.bossRitual, `${guideId} must be a boss Ritual step`);
    assert.equal(content.bossRitual.step, step);
    assert.equal(content.bossRitual.total, 4);
    assert.equal(content.bossRitual.final, step === 4);
  }
});

test('unconfirmed boss Ritual chains are not inferred', () => {
  const content = getCampaignLeagueZoneContent(makeSnapshot('a1_red_vale'));
  assert.ok(content);
  assert.equal(content.bossRitual, null);
});
