import type { AppConfig, ChecklistDetectedBy } from './types';

export const FINAL_INTERLUDE_BONUS_ID = 'int3_final_zolin_zelina_weapon_points';
export const POST_INTERLUDES_REWARD_CHECKLIST_ITEM_ID = 'post_interludes_kingsmarch_task_2';

export const INTERLUDE_BRANCH_COMPLETION_RULES = [
  {
    branch: 'khari',
    guideId: 'i2_kima_reservoir',
    completionChecklistItemId: 'i2_kima_reservoir_task_2'
  },
  {
    branch: 'kriar',
    guideId: 'interlude_cuachic_vault',
    completionChecklistItemId: 'interlude_cuachic_vault_task_2'
  },
  {
    branch: 'ogham',
    guideId: 'i_final_holten_estate',
    completionChecklistItemId: 'i_final_holten_estate_task_3'
  }
] as const;

export const INTERLUDE_BRANCH_ENDPOINT_GUIDE_IDS = INTERLUDE_BRANCH_COMPLETION_RULES.map(
  (rule) => rule.guideId
);

const RELIABLE_CHECKLIST_COMPLETION_SOURCES = new Set<ChecklistDetectedBy>([
  'manual',
  'log',
  'linked_reward'
]);

type InterludeCompletionConfig = Pick<AppConfig, 'zoneProgress' | 'campaignBonusProgress'>;

export function hasCompletedAllInterludeBranches(config: InterludeCompletionConfig): boolean {
  if (config.campaignBonusProgress[FINAL_INTERLUDE_BONUS_ID]?.state === 'done') {
    return true;
  }

  return INTERLUDE_BRANCH_COMPLETION_RULES.every((rule) => {
    const progress = config.zoneProgress[rule.guideId]?.itemStates[rule.completionChecklistItemId];
    return progress?.state === 'done' && RELIABLE_CHECKLIST_COMPLETION_SOURCES.has(progress.detectedBy);
  });
}
