import type { CampaignBonusDefinition, CampaignBonusesDataFile } from '../../src/shared/types';
import { readJson } from './loadJson';

export function getCampaignBonusesData(): CampaignBonusesDataFile {
  return readJson<CampaignBonusesDataFile>('src/data/campaign-bonuses.json');
}

export function getCampaignBonuses(): CampaignBonusDefinition[] {
  return getCampaignBonusesData().bonuses;
}

export function getBonusesByAct(): Map<string, CampaignBonusDefinition[]> {
  const result = new Map<string, CampaignBonusDefinition[]>();
  for (const bonus of getCampaignBonuses()) {
    const key = String(bonus.act);
    const bucket = result.get(key) ?? [];
    bucket.push(bonus);
    result.set(key, bucket);
  }
  return result;
}

export function groupBonusesByRewardSignature(): Map<string, CampaignBonusDefinition[]> {
  const result = new Map<string, CampaignBonusDefinition[]>();

  for (const bonus of getCampaignBonuses()) {
    const key = JSON.stringify(bonus.reward);
    const bucket = result.get(key) ?? [];
    bucket.push(bonus);
    result.set(key, bucket);
  }

  return result;
}
