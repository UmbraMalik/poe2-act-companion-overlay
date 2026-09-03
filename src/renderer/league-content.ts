import campaignBonusRewardsData from '../data/campaign-bonus-rewards.json';
import type { GuideEntry, SceneKind } from '../shared/types';

interface LeagueContentSnapshot {
  currentGuideEntry: GuideEntry | null;
  currentZone: {
    sceneKind: SceneKind;
    rawZoneName?: string | null;
  };
}

interface CampaignBonusRewardEntry {
  id: string;
  guideZoneId: string | null;
  reward_en: string;
  reward_ru: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  matchZoneNames?: string[];
}

export interface CampaignLeagueZoneContent {
  rewardId: string;
  reward_en: string;
  reward_ru: string;
}

const BONUS_REWARDS = (
  campaignBonusRewardsData as { rewards?: CampaignBonusRewardEntry[] }
).rewards ?? [];

function normalizeZoneName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[’'`".,:;!?()[\]{}\/\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function getCampaignLeagueZoneContent(
  snapshot: LeagueContentSnapshot
): CampaignLeagueZoneContent | null {
  const guide = snapshot.currentGuideEntry;

  if (!guide || snapshot.currentZone.sceneKind !== 'gameplay') {
    return null;
  }

  const rawZoneName = normalizeZoneName(snapshot.currentZone.rawZoneName);
  const reward = BONUS_REWARDS.find((entry) => {
    if (
      entry.guideZoneId !== guide.id ||
      !entry.hasReward ||
      !entry.displayInOverlay
    ) {
      return false;
    }

    if (!entry.matchZoneNames?.length) {
      return true;
    }

    return entry.matchZoneNames.some((name) => normalizeZoneName(name) === rawZoneName);
  });

  if (!reward) {
    return null;
  }

  return {
    rewardId: reward.id,
    reward_en: reward.reward_en,
    reward_ru: reward.reward_ru
  };
}
