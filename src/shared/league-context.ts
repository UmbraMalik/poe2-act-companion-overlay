import core055Data from '../data/league-content/core-0.5.5.json';
import forbiddenRitesData from '../data/league-content/forbidden-rites.json';
import runesOfAldurData from '../data/league-content/runes-of-aldur.json';
import type { CampaignLeague, GuideEntry } from './types';

export const CAMPAIGN_LEAGUES: CampaignLeague[] = [
  'forbidden_rites',
  'runes_of_aldur',
  'standard'
];

export interface LeagueMechanicRewardEntry {
  id: string;
  zone_en: string;
  zone_ru: string;
  guideZoneId: string | null;
  guideZoneRu: string | null;
  aliases_ru?: string[];
  reward_en: string;
  reward_ru: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  oneTimeGuaranteed: boolean;
  uncertain?: boolean;
}

type GuidePatch = {
  zoneId: string;
  path: string;
  index: number;
  value: unknown;
};

type LeagueContentFile = {
  id: string;
  guidePatches?: GuidePatch[];
  rewards?: LeagueMechanicRewardEntry[];
};

const CORE_0_5_5_CONTENT = core055Data as LeagueContentFile;
const FORBIDDEN_RITES_CONTENT = forbiddenRitesData as LeagueContentFile;
const RUNES_OF_ALDUR_CONTENT = runesOfAldurData as LeagueContentFile;

const ACTIVE_LEAGUE_LAYERS: Record<CampaignLeague, LeagueContentFile[]> = {
  standard: [CORE_0_5_5_CONTENT],
  runes_of_aldur: [RUNES_OF_ALDUR_CONTENT],
  forbidden_rites: [CORE_0_5_5_CONTENT, FORBIDDEN_RITES_CONTENT]
};

export function normalizeCampaignLeague(value: unknown): CampaignLeague | null {
  return typeof value === 'string' && CAMPAIGN_LEAGUES.includes(value as CampaignLeague)
    ? value as CampaignLeague
    : null;
}

export function getActiveLeagueContentLayerIds(
  campaignLeague: CampaignLeague | null
): string[] {
  return campaignLeague
    ? ACTIVE_LEAGUE_LAYERS[campaignLeague].map((layer) => layer.id)
    : [];
}

function cloneGuideEntry(entry: GuideEntry): GuideEntry {
  return JSON.parse(JSON.stringify(entry)) as GuideEntry;
}

function getArrayAtPath(entry: GuideEntry, path: string): unknown[] | null {
  if (path.startsWith('details.')) {
    const key = path.slice('details.'.length);
    if (!entry.details || Array.isArray(entry.details)) {
      entry.details = {};
    }

    const details = entry.details as Record<string, unknown>;
    if (!Array.isArray(details[key])) {
      details[key] = [];
    }
    return details[key] as unknown[];
  }

  const entryRecord = entry as unknown as Record<string, unknown>;
  if (!Array.isArray(entryRecord[path])) {
    return null;
  }
  return entryRecord[path] as unknown[];
}

function getGuidePatchesForZone(
  campaignLeague: CampaignLeague | null,
  zoneId: string
): GuidePatch[] {
  if (!campaignLeague) {
    return [];
  }

  return ACTIVE_LEAGUE_LAYERS[campaignLeague]
    .flatMap((layer) => layer.guidePatches ?? [])
    .filter((patch) => patch.zoneId === zoneId)
    .sort((left, right) => left.path.localeCompare(right.path) || left.index - right.index);
}

export function applyCampaignLeagueToGuideEntry(
  entry: GuideEntry | null,
  campaignLeague: CampaignLeague | null
): GuideEntry | null {
  if (!entry) {
    return null;
  }

  const patches = getGuidePatchesForZone(campaignLeague, entry.id);
  if (!patches.length) {
    return entry;
  }

  const nextEntry = cloneGuideEntry(entry);
  for (const patch of patches) {
    const target = getArrayAtPath(nextEntry, patch.path);
    if (!target) {
      continue;
    }

    const insertAt = Math.max(0, Math.min(patch.index, target.length));
    target.splice(insertAt, 0, JSON.parse(JSON.stringify(patch.value)) as unknown);
  }

  return nextEntry;
}

export function applyCampaignLeagueToGuideEntries(
  entries: GuideEntry[],
  campaignLeague: CampaignLeague | null
): GuideEntry[] {
  if (!campaignLeague || !ACTIVE_LEAGUE_LAYERS[campaignLeague].some((layer) => layer.guidePatches?.length)) {
    return entries;
  }

  return entries.map((entry) => applyCampaignLeagueToGuideEntry(entry, campaignLeague) ?? entry);
}

export function getLeagueMechanicRewards(
  campaignLeague: CampaignLeague | null
): LeagueMechanicRewardEntry[] {
  if (!campaignLeague) {
    return [];
  }

  return ACTIVE_LEAGUE_LAYERS[campaignLeague]
    .flatMap((layer) => layer.rewards ?? [])
    .map((reward) => ({ ...reward }));
}
