import { translate } from '../i18n/translations';
import type { AppLanguage, CampaignBonusProgress } from './types';

export type CampaignBonusCompletionSource =
  | 'log_reward_line'
  | 'manual'
  | 'context'
  | 'unknown';

export interface CampaignBonusProvenanceView {
  source: CampaignBonusCompletionSource;
  label: string;
  line: string;
}

function getCompletionTime(progress: CampaignBonusProgress, language: AppLanguage): string | null {
  const timestampMs = Date.parse(progress.timestamp);

  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  return new Date(timestampMs).toLocaleTimeString(language === 'en' ? 'en-US' : 'ru-RU');
}

export function getCampaignBonusCompletionSource(
  progress: CampaignBonusProgress | null | undefined
): CampaignBonusCompletionSource | null {
  if (!progress) {
    return null;
  }

  if (progress.detectedBy === 'manual') {
    return 'manual';
  }

  if (progress.detectedBy === 'context') {
    return 'context';
  }

  if (progress.detectedBy === 'log') {
    return typeof progress.logLine === 'string' && progress.logLine.trim().length > 0
      ? 'log_reward_line'
      : 'context';
  }

  return 'unknown';
}

export function getCampaignBonusProvenanceView(
  progress: CampaignBonusProgress | null | undefined,
  language: AppLanguage
): CampaignBonusProvenanceView | null {
  const source = getCampaignBonusCompletionSource(progress);

  if (!source || !progress) {
    return null;
  }

  const label = translate(language, `companion.bonusCompletionSource.${source}`);
  const time = getCompletionTime(progress, language);

  return {
    source,
    label,
    line: time
      ? translate(language, 'companion.bonusCompletionWithTime', { source: label, time })
      : label
  };
}
