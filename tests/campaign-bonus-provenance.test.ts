import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCampaignBonusCompletionSource,
  getCampaignBonusProvenanceView
} from '../src/shared/campaign-bonus-provenance';
import type { CampaignBonusProgress } from '../src/shared/types';

const baseProgress: CampaignBonusProgress = {
  state: 'done',
  timestamp: '2026-05-17T12:30:00.000Z',
  detectedBy: 'manual'
};

test('campaign bonus provenance labels manual, reward-line, context and unknown sources', () => {
  const manual = getCampaignBonusProvenanceView(baseProgress, 'en');
  const logReward = getCampaignBonusProvenanceView({
    ...baseProgress,
    detectedBy: 'log',
    logLine: ': Umbra has received +30 Spirit.'
  }, 'en');
  const context = getCampaignBonusProvenanceView({
    ...baseProgress,
    detectedBy: 'log'
  }, 'en');
  const unknown = getCampaignBonusProvenanceView({
    ...baseProgress,
    detectedBy: 'unknown'
  }, 'en');

  assert.equal(getCampaignBonusCompletionSource(null), null);
  assert.equal(manual?.source, 'manual');
  assert.equal(manual?.label, 'Marked manually');
  assert.equal(logReward?.source, 'log_reward_line');
  assert.equal(logReward?.label, 'Detected from reward line');
  assert.equal(context?.source, 'context');
  assert.equal(context?.label, 'Detected in current route context');
  assert.equal(unknown?.source, 'unknown');
  assert.equal(unknown?.label, 'Source unknown');
});

test('campaign bonus provenance is localized for Russian users', () => {
  const view = getCampaignBonusProvenanceView({
    ...baseProgress,
    detectedBy: 'log',
    logLine: ': Игрок получил +30 к духу.'
  }, 'ru');

  assert.equal(view?.label, 'По строке награды');
  assert.match(view?.line ?? '', /По строке награды/);
});
