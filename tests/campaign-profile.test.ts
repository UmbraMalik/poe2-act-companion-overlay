import test from 'node:test';
import assert from 'node:assert/strict';
import { getCampaignActCount, getEndgameT15Act, isGuideInCampaign, isCampaignBonusInProfile, normalizeCampaignProfile } from '../src/shared/campaign-profile';
import { isEndgameT15Act } from '../src/shared/timers';
import { inferActHintFromInternalAreaId, inferActHintFromTownScene } from '../src/main/scene-classifier';
import { normalizeAppConfig, normalizeSavedRunHistoryEntry } from '../src/main/services/config-store';

test('legacy act 5 and endgame 6 stay intact while 1.0 separates act 6 from endgame 7', () => {
  assert.equal(getCampaignActCount('legacy-0.5'), 5);
  assert.equal(getCampaignActCount('release-1.0'), 6);
  assert.equal(getEndgameT15Act('legacy-0.5'), 6);
  assert.equal(getEndgameT15Act('release-1.0'), 7);
  assert.equal(isEndgameT15Act(6, 'release-1.0'), false);
  assert.equal(isEndgameT15Act(7, 'release-1.0'), true);
  assert.equal(isEndgameT15Act(6, 'legacy-0.5'), true);
});

test('old interlude guides do not masquerade as new act 5', () => {
  assert.equal(isGuideInCampaign({ act: 5 }, 'legacy-0.5'), true);
  assert.equal(isGuideInCampaign({ act: 'interlude' }, 'release-1.0'), false);
  assert.equal(isGuideInCampaign({ act: 5 }, 'release-1.0'), false);
  assert.equal(isGuideInCampaign({ act: 4 }, 'release-1.0'), true);
  assert.equal(isGuideInCampaign({ act: 5, campaignProfiles: ['release-1.0'] }, 'release-1.0'), true);
});

test('area inference routes new release act 6 but never repurposes old P3 areas', () => {
  assert.equal(inferActHintFromInternalAreaId('C_G6_1', 'release-1.0'), 6);
  assert.equal(inferActHintFromInternalAreaId('P3_2', 'release-1.0'), null);
  assert.equal(inferActHintFromInternalAreaId('P3_2', 'legacy-0.5'), 5);
  assert.equal(inferActHintFromTownScene('ziggurat refuge', 'release-1.0'), 7);
});

test('older configs and saved history entries get the original campaign profile', () => {
  assert.equal(normalizeCampaignProfile(undefined), 'legacy-0.5');
  const config = normalizeAppConfig({});
  assert.equal(config.campaignProfile, 'legacy-0.5');
  const entry = normalizeSavedRunHistoryEntry({ id: 'old', savedAt: 100, totalElapsedMs: 1234, currentAct: 6 });
  assert.equal(entry?.campaignProfile, 'legacy-0.5');
});

test('new Act 5 bonuses are allowed when tagged for 1.0, while old Interludes stay hidden', () => {
  assert.equal(isCampaignBonusInProfile({ act: 5 }, 'release-1.0'), false);
  assert.equal(isCampaignBonusInProfile({ act: 'interlude' }, 'release-1.0'), false);
  assert.equal(isCampaignBonusInProfile({ act: 5, campaignProfiles: ['release-1.0'] }, 'release-1.0'), true);
  assert.equal(isCampaignBonusInProfile({ act: 5, campaignProfiles: ['release-1.0'] }, 'legacy-0.5'), false);
  assert.equal(isCampaignBonusInProfile({ act: 6, campaignProfiles: ['release-1.0'] }, 'release-1.0'), true);
  assert.equal(isCampaignBonusInProfile({ act: 2 }, 'release-1.0'), true);
});
