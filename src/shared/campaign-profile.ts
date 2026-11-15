import type { CampaignBonusDefinition, CampaignProfile, GuideEntry } from './types';

export const LEGACY_CAMPAIGN_PROFILE: CampaignProfile = 'legacy-0.5';
export const RELEASE_CAMPAIGN_PROFILE: CampaignProfile = 'release-1.0';

export function normalizeCampaignProfile(value: unknown): CampaignProfile {
  return value === RELEASE_CAMPAIGN_PROFILE ? RELEASE_CAMPAIGN_PROFILE : LEGACY_CAMPAIGN_PROFILE;
}

export function getCampaignActCount(profile: CampaignProfile): number {
  // The legacy Interludes occupy split/act 5 in historical data.
  return profile === RELEASE_CAMPAIGN_PROFILE ? 6 : 5;
}

export function getEndgameT15Act(profile: CampaignProfile): number {
  return getCampaignActCount(profile) + 1;
}

export function isGuideInCampaign(guide: Pick<GuideEntry, 'act' | 'campaignProfiles'>, profile: CampaignProfile): boolean {
  // Act 5 entries in the 0.6.1 dataset represent the OLD interludes,
  // never Act 5 of the new campaign. They must not leak into the 1.0 route.
  if (guide.campaignProfiles?.length) {
    return guide.campaignProfiles.includes(profile);
  }
  return profile === LEGACY_CAMPAIGN_PROFILE ||
    (typeof guide.act === 'number' && guide.act >= 1 && guide.act <= 4);
}

export function isLegacyInterludeAct(act: number | 'interlude' | null, profile: CampaignProfile): boolean {
  return profile === LEGACY_CAMPAIGN_PROFILE && (act === 5 || act === 'interlude');
}

/** Untagged Act 5 bonuses are from legacy Interludes, not release Act 5. */
export function isCampaignBonusInProfile(
  bonus: Pick<CampaignBonusDefinition, 'act' | 'campaignProfiles'>,
  profile: CampaignProfile
): boolean {
  if (bonus.campaignProfiles?.length) {
    return bonus.campaignProfiles.includes(profile);
  }
  return profile === LEGACY_CAMPAIGN_PROFILE ||
    (typeof bonus.act === 'number' && bonus.act >= 1 && bonus.act <= 4);
}
