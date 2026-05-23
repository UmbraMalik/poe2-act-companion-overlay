import leagueMechanicRewardsData from '../../data/league-mechanic-rewards.json';
import { getNearestPowerSpike, getXpStatus } from '../companion-helpers';
import { getGuideView, getLevelReminderView, getPowerSpikeView } from '../../i18n/data';
import { translate } from '../../i18n/translations';
import type {
  AppLanguage,
  AppSnapshot,
  CampaignBonusDefinition,
  ChecklistItemDefinition,
  GuideEntry,
  GuideProfile,
  LevelReminder,
  PowerSpike,
  RunTimerState,
  ZoneAct
} from '../../shared/types';

export function formatActTitle(act: ZoneAct | null, language: AppLanguage): string {
  if (act === null) {
    return translate(language, 'overlay.currentZoneFallback');
  }

  return act === 'interlude'
    ? translate(language, 'route.interludes')
    : translate(language, 'route.act', { act });
}

export function formatHotkeyLabel(value: string | null | undefined, fallback: string): string {
  const label = (value ?? fallback).trim();
  return label.length > 0 ? label : fallback;
}

export function formatTimerOnlyRunStatus(
  runTimer: RunTimerState,
  language: AppLanguage
): string {
  if (runTimer.status === 'armed') {
    return translate(language, 'overlay.timerOnlyArmed');
  }

  if (runTimer.status === 'paused') {
    return translate(language, 'overlay.timerOnlyPaused');
  }

  if (runTimer.status === 'finished') {
    return translate(language, 'overlay.timerOnlyFinished');
  }

  if (runTimer.status === 'running') {
    return translate(language, 'overlay.timerOnlyRunning');
  }

  return translate(language, 'overlay.timerOnlyReady');
}

interface OverlayUpcomingReminder {
  id: string;
  level: number;
  title: string;
  items: string[];
  source: 'vendor' | 'power';
}

interface LeagueMechanicRewardEntry {
  id: string;
  section: string;
  actLabel: string;
  zone_en: string;
  zone_ru: string;
  guideZoneId: string | null;
  guideZoneRu: string | null;
  aliases_ru?: string[];
  reward_en: string;
  reward_ru: string;
  rewardType: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  oneTimeGuaranteed: boolean;
  duplicateInCurrentGuide: boolean;
  uncertain?: boolean;
}

const LEAGUE_MECHANIC_REWARDS = (
  leagueMechanicRewardsData as { rewards?: LeagueMechanicRewardEntry[] }
).rewards ?? [];

function supportsActiveProfile(entry: PowerSpike, activeProfile: GuideProfile): boolean {
  return !entry.profiles || entry.profiles.length === 0 || entry.profiles.includes(activeProfile);
}

export function getOverlayUpcomingReminders(
  snapshot: AppSnapshot,
  language: AppLanguage,
  maxDelta = 2
): OverlayUpcomingReminder[] {
  const currentLevel = snapshot.config.currentLevel;

  if (currentLevel === null) {
    return [];
  }

  const vendorReminders: OverlayUpcomingReminder[] = snapshot.vendorCheckpoints.map(
    (entry: LevelReminder) => ({
      id: `vendor-${entry.id}`,
      level: entry.level,
      title: getLevelReminderView(entry, language)?.displayTitle ?? entry.title,
      items: getLevelReminderView(entry, language)?.displayItems ?? entry.items,
      source: 'vendor'
    })
  );

  const powerSpikes: OverlayUpcomingReminder[] = snapshot.powerSpikes
    .filter((entry) => supportsActiveProfile(entry, snapshot.config.guideProfile))
    .map((entry) => ({
      id: `power-${entry.id}`,
      level: entry.level,
      title: getPowerSpikeView(entry, language)?.displayTitle ?? entry.title,
      items: getPowerSpikeView(entry, language)?.displayItems ?? entry.items,
      source: 'power' as const
    }));

  const seen = new Set<string>();

  return [...vendorReminders, ...powerSpikes]
    .filter((entry) => entry.level >= currentLevel && entry.level <= currentLevel + maxDelta)
    .sort((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }

      if (left.source !== right.source) {
        return left.source === 'vendor' ? -1 : 1;
      }

      return left.title.localeCompare(right.title, language === 'en' ? 'en' : 'ru');
    })
    .filter((entry) => {
      const key = `${entry.level}-${entry.title.toLocaleLowerCase(language === 'en' ? 'en' : 'ru')}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

export function getImportantOverlayLines(
  snapshot: AppSnapshot,
  language: AppLanguage
) {
  const guide = snapshot.currentGuideEntry;
  if (!guide) {
    return [];
  }

  const guideView = getGuideView(guide, language);
  const nearestPowerSpike = getNearestPowerSpike(
    snapshot.powerSpikes,
    snapshot.config.currentLevel,
    snapshot.config.guideProfile
  );
  const powerSpikeView = getPowerSpikeView(nearestPowerSpike, language);
  const xpStatus = getXpStatus(snapshot, language);
  const lines: string[] = [];

  if (snapshot.config.mainOverlaySettings.showOverlayCriticalImportant) {
    lines.push(...(guideView?.important ?? []));
  }

  if (snapshot.config.mainOverlaySettings.showOverlayBossTip) {
    lines.push(...(guideView?.bossTips ?? []));
  }

  if (
    snapshot.config.mainOverlaySettings.showOverlayXpStatus &&
    (xpStatus.variant === 'low' || xpStatus.variant === 'farm')
  ) {
    lines.push(xpStatus.longLabel);
  }

  if (snapshot.config.mainOverlaySettings.showOverlayPowerSpike && nearestPowerSpike) {
    lines.push(
      translate(language, 'overlay.powerSpike', {
        level: nearestPowerSpike.level,
        title: powerSpikeView?.displayTitle ?? nearestPowerSpike.title
      })
    );
  }

  return [...new Set(lines.filter(Boolean))].slice(0, 2);
}

function normalizeZoneBonusName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLeagueZoneName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’'`".,:;!?()[\]{}\/\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '');
}

function addLeagueZoneCandidate(candidates: Set<string>, value: string | null | undefined): void {
  const normalized = normalizeLeagueZoneName(value);
  if (normalized) {
    candidates.add(normalized);
  }
}

export function getCurrentZoneLeagueReward(
  snapshot: AppSnapshot,
  sceneName: string
): LeagueMechanicRewardEntry | null {
  const guide = snapshot.currentGuideEntry;
  const guideId = guide?.id ?? null;
  const candidates = new Set<string>();

  addLeagueZoneCandidate(candidates, guide?.zone_ru);
  addLeagueZoneCandidate(candidates, guide?.zone_en);
  addLeagueZoneCandidate(candidates, snapshot.currentZone.rawZoneName);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastRawZoneName);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastMatchedZoneRu);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastMatchedZoneEn);
  addLeagueZoneCandidate(candidates, sceneName);

  return (
    LEAGUE_MECHANIC_REWARDS.find((reward) => {
      if (!reward.displayInOverlay || !reward.hasReward) {
        return false;
      }

      if (guideId && reward.guideZoneId === guideId) {
        return true;
      }

      const rewardNames = [
        reward.zone_ru,
        reward.zone_en,
        reward.guideZoneRu,
        ...(reward.aliases_ru ?? [])
      ];

      return rewardNames.some((name) => candidates.has(normalizeLeagueZoneName(name)));
    }) ?? null
  );
}

function getGuideCampaignBonusIds(guide: GuideEntry | null): Set<string> {
  const guideWithBonuses = guide as (GuideEntry & {
    campaign_bonus_ids?: string[];
    campaignBonusIds?: string[];
  }) | null;

  const ids = [
    ...(Array.isArray(guideWithBonuses?.campaign_bonus_ids) ? guideWithBonuses.campaign_bonus_ids : []),
    ...(Array.isArray(guideWithBonuses?.campaignBonusIds) ? guideWithBonuses.campaignBonusIds : [])
  ];

  return new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean));
}
function isKhariCrossingGuide(guide: GuideEntry | null, rawZoneName: string | null | undefined): boolean {
  const guideId = normalizeZoneBonusName(guide?.id);
  const zoneRu = normalizeZoneBonusName(guide?.zone_ru);
  const zoneEn = normalizeZoneBonusName(guide?.zone_en);
  const raw = normalizeZoneBonusName(rawZoneName);

  return (
    guideId === 'interlude_khari_crossing' ||
    zoneRu === 'кхарийский перевал' ||
    zoneEn === 'the khari crossing' ||
    raw === 'кхарийский перевал' ||
    raw === 'the khari crossing'
  );
}

function isGalaiGatesGuide(guide: GuideEntry | null, rawZoneName: string | null | undefined): boolean {
  const guideId = normalizeZoneBonusName(guide?.id);
  const zoneRu = normalizeZoneBonusName(guide?.zone_ru);
  const zoneEn = normalizeZoneBonusName(guide?.zone_en);
  const raw = normalizeZoneBonusName(rawZoneName);

  return (
    guideId === 'interlude_galai_gates' ||
    zoneRu === 'ворота галаи' ||
    zoneRu === 'врата голай' ||
    zoneEn === 'the galai gates' ||
    zoneEn === 'galai gates' ||
    raw === 'ворота галаи' ||
    raw === 'врата голай' ||
    raw === 'the galai gates' ||
    raw === 'galai gates'
  );
}

function isKhariCrossingCampaignBonus(bonus: CampaignBonusDefinition): boolean {
  const id = normalizeZoneBonusName(bonus.id);
  const zoneId = normalizeZoneBonusName(bonus.zoneId);
  const zoneRu = normalizeZoneBonusName(bonus.zone_ru);
  const title = normalizeZoneBonusName(bonus.title);
  const source = normalizeZoneBonusName(bonus.source);
  const details = normalizeZoneBonusName((bonus.details ?? []).join(' '));

  if (zoneId === 'interlude_khari_crossing' || zoneRu === 'кхарийский перевал') {
    return true;
  }

  const isLifeBonus = title.includes('+5') && title.includes('здоров');
  const isWeaponBonus = title.includes('+2') && title.includes('пассив') && title.includes('оруж');
  const mentionsKhariSource =
    source.includes('кхарийский перевал') ||
    details.includes('расплавленн') ||
    details.includes('актхи') ||
    details.includes('анундр') ||
    details.includes('рису');

  return (
    id.includes('khari_crossing') ||
    (id.includes('galai_gates') && (isLifeBonus || isWeaponBonus) && mentionsKhariSource) ||
    ((isLifeBonus || isWeaponBonus) && mentionsKhariSource)
  );
}

export function getCurrentZoneCampaignBonuses(snapshot: AppSnapshot) {
  const guide = snapshot.currentGuideEntry;
  const rawZoneName = snapshot.currentZone.rawZoneName;
  const guideId = guide?.id ?? null;
  const explicitBonusIds = getGuideCampaignBonusIds(guide);
  const progress = snapshot.config.campaignBonusProgress ?? {};
  const isKhariCrossing = isKhariCrossingGuide(guide, rawZoneName);
  const isGalaiGates = isGalaiGatesGuide(guide, rawZoneName);
  const zoneNames = guideId
    ? new Set<string>()
    : new Set([normalizeZoneBonusName(guide?.zone_ru), normalizeZoneBonusName(rawZoneName)].filter(Boolean));

  const matchedBonuses = snapshot.campaignBonuses.filter((bonus) => {
    const isKhariBonus = isKhariCrossingCampaignBonus(bonus);

    // The Galai Gates / Ворота Галаи do not own the Khari Crossing campaign bonuses.
    if (isGalaiGates && isKhariBonus) {
      return false;
    }

    // Khari Crossing owns both +5% life and +2 weapon set passive points.
    if (isKhariCrossing && isKhariBonus) {
      return true;
    }

    if (guideId) {
      return bonus.zoneId === guideId || explicitBonusIds.has(bonus.id);
    }

    return explicitBonusIds.has(bonus.id) || zoneNames.has(normalizeZoneBonusName(bonus.zone_ru));
  });

  const uniqueBonuses = Array.from(new Map(matchedBonuses.map((bonus) => [bonus.id, bonus])).values());

  return uniqueBonuses
    .map((bonus) => ({ bonus, done: Boolean(progress[bonus.id]) }))
    .sort((left, right) => Number(left.done) - Number(right.done));
}

function getDetailLines(
  guide: GuideEntry | null,
  key: string,
  language: AppLanguage
): string[] {
  const details = getGuideView(guide, language)?.details;

  if (!details || Array.isArray(details) || typeof details !== 'object') {
    return [];
  }

  const value = (details as Record<string, unknown>)[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

export function getOverlaySpeedrunLines(
  guide: GuideEntry | null,
  language: AppLanguage
): string[] {
  const groups: Array<[string, string]> = [
    ['checkpoint', 'companion.detailsGroup.checkpoint'],
    ['town_plan', 'companion.detailsGroup.town'],
    ['navigation', 'companion.detailsGroup.navigation'],
    ['time_saves', 'companion.detailsGroup.time_saves'],
    ['opportunistic', 'companion.detailsGroup.opportunistic'],
    ['xp_strategy', 'common.xpNotes'],
    ['craft_plan', 'common.craftingTips']
  ];

  return groups
    .flatMap(([key, labelKey]) =>
      getDetailLines(guide, key, language)
        .slice(0, 1)
        .map((line) => `${translate(language, labelKey)}: ${line}`)
    )
    .slice(0, 3);
}


export function getChecklistItemTone(
  item: ChecklistItemDefinition
): string {
  if (
    item.type === 'reward' ||
    item.type === 'permanent_reward' ||
    item.type === 'passive' ||
    item.type === 'resistance' ||
    item.type === 'spirit' ||
    item.type === 'life' ||
    item.type === 'mana' ||
    item.type === 'crafting' ||
    item.type === 'currency'
  ) {
    return ' is-reward';
  }

  if (item.type === 'boss') {
    return ' is-boss';
  }

  if (!item.required || item.type === 'route_task') {
    return ' is-optional';
  }

  const normalized = item.text.toLocaleLowerCase('ru');
  const isReward =
    normalized.includes('награ') ||
    normalized.includes('пассив') ||
    normalized.includes('сопротив') ||
    normalized.includes('резист') ||
    normalized.includes('дух') ||
    normalized.includes('spirit') ||
    normalized.includes('gem') ||
    normalized.includes('камень') ||
    normalized.includes('+');
  const isBoss =
    normalized.includes('босс') ||
    normalized.includes('убить') ||
    normalized.includes('побед') ||
    normalized.includes('trial') ||
    normalized.includes('испытан');
  const isSkip =
    normalized.includes('скип') ||
    normalized.includes('не задерж') ||
    normalized.includes('не чист') ||
    normalized.includes('опционально');

  if (isReward) {
    return ' is-reward';
  }

  if (isBoss) {
    return ' is-boss';
  }

  if (isSkip) {
    return ' is-optional';
  }

  return '';
}
