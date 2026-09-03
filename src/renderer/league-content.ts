import forbiddenRitesBossRitualsData from '../data/forbidden-rites-boss-rituals.json';
import type { GuideEntry, SceneKind } from '../shared/types';

interface LeagueContentSnapshot {
  currentGuideEntry: GuideEntry | null;
  currentZone: {
    sceneKind: SceneKind;
  };
}

interface BossRitualStepData {
  guideZoneId: string;
  step: number;
}

interface BossRitualChainData {
  id: string;
  act: number;
  steps: BossRitualStepData[];
}

export interface BossRitualProgress {
  chainId: string;
  step: number;
  total: number;
  final: boolean;
}

export interface CampaignLeagueZoneContent {
  bossRitual: BossRitualProgress | null;
}

const BOSS_RITUAL_CHAINS = (
  forbiddenRitesBossRitualsData as { chains?: BossRitualChainData[] }
).chains ?? [];

const BOSS_RITUAL_BY_GUIDE_ID = new Map<string, BossRitualProgress>();

for (const chain of BOSS_RITUAL_CHAINS) {
  const total = chain.steps.length;

  for (const step of chain.steps) {
    BOSS_RITUAL_BY_GUIDE_ID.set(step.guideZoneId, {
      chainId: chain.id,
      step: step.step,
      total,
      final: step.step === total
    });
  }
}

export function getCampaignLeagueZoneContent(
  snapshot: LeagueContentSnapshot
): CampaignLeagueZoneContent | null {
  const guide = snapshot.currentGuideEntry;

  if (!guide || snapshot.currentZone.sceneKind !== 'gameplay') {
    return null;
  }

  return {
    bossRitual: BOSS_RITUAL_BY_GUIDE_ID.get(guide.id) ?? null
  };
}
