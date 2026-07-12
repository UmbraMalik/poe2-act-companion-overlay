import test from 'node:test';
import assert from 'node:assert/strict';
import type { GuideService } from '../src/main/services/guide-service';
import { loadGuideService } from './helpers/zoneTestUtils';

const { ZoneMatchExtractor } = require('../src/main/services/zone-match-extractor') as typeof import('../src/main/services/zone-match-extractor');

function createExtractor(): InstanceType<typeof ZoneMatchExtractor> {
  return new ZoneMatchExtractor(loadGuideService() as unknown as GuideService);
}

test('ZoneMatchExtractor keeps generated area id through scene labels and resets after gameplay zones', () => {
  const extractor = createExtractor();

  assert.equal(
    extractor.extractFromLogLine('2026/05/16 22:00:10 123 [DEBUG Client] Generating level 11 area "G1_11" with seed 1'),
    null
  );

  const actLabelMatch = extractor.extractFromLogLine('[SCENE] Set Source [Act 1]');
  assert.equal(actLabelMatch, null);

  const gameplayMatch = extractor.extractFromLogLine('[SCENE] Set Source [Hunting Grounds]');
  assert.equal(gameplayMatch?.extractedInternalAreaId, 'G1_11');
  assert.equal(gameplayMatch?.guide?.id, 'a1_hunting_grounds');

  const nextGameplayMatch = extractor.extractFromLogLine('[SCENE] Set Source [Freythorn]');
  assert.equal(nextGameplayMatch?.extractedInternalAreaId, null);
  assert.equal(nextGameplayMatch?.guide?.id, 'a1_freythorn');
});
