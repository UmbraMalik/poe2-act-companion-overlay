import {
  useAppSnapshot
} from '../hooks';
import {
  getRequiredRewardLabelsForZone,
  getRouteActs
} from '../companion-helpers';
import {
  formatRecommendedLevelLabel
} from '../utils';
import {
  getGuideView,
  translateDataText
} from '../../i18n/data';
import {
  translate
} from '../../i18n/translations';
import {
  isLegacyInterludeAct
} from '../../shared/campaign-profile';
import {
  isEndgameT15Act
} from '../../shared/timers';
import {
  getRouteCampaignBonusModels,
  type RouteCardBonusModel
} from '../RouteCardBonuses';
import type {
  AppLanguage,
  CampaignProfile,
  GuideEntry,
  ZoneAct
} from '../../shared/types';

type RouteActOverview = ReturnType<typeof getRouteActs>;

type RouteZoneOverview = RouteActOverview[number]['zones'][number];

type RouteCardModel = {
  entry: RouteZoneOverview;
  allRouteLabels: string[];
  indexLabel: string;
  visibleRouteLabels: string[];
  hiddenRouteLabelsCount: number;
  statusLabel: string | null;
  routeCardTitle: string;
  recommendedLevelLabel: string;
  missedItemTexts: string[];
  isRouteNext: boolean;
  hasBonusRewards: boolean;
  bonusRewards: RouteCardBonusModel[];
  searchText: string;
};

const ROUTE_OVERVIEW_VISIBLE_ITEMS = 2;

function getRouteStatusLabel(
  status: 'current' | 'missed' | 'completed' | 'visited' | 'pending',
  language: AppLanguage
) {
  switch (status) {
    case 'current':
      return translate(language, 'companion.routeStatusCurrent');
    case 'missed':
      return translate(language, 'companion.routeStatusMissed');
    default:
      return null;
  }
}

function getGuideDetailsList(guide: GuideEntry, key: string): string[] {
  if (!guide.details || Array.isArray(guide.details)) {
    return [];
  }

  const value = (guide.details as Record<string, unknown>)[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getRouteFallbackLabels(guide: GuideEntry, language: AppLanguage): string[] {
  const guideView = getGuideView(guide, language);
  const localizedDetails = guideView?.details;
  const detailsRoute = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.route)
    ? localizedDetails.route.filter((item): item is string => typeof item === 'string')
    : [];
  const navigation = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.navigation)
    ? localizedDetails.navigation.filter((item): item is string => typeof item === 'string')
    : [];
  const craftPlan = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.craft_plan)
    ? localizedDetails.craft_plan.filter((item): item is string => typeof item === 'string')
    : [];
  const timeSaves = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.time_saves)
    ? localizedDetails.time_saves.filter((item): item is string => typeof item === 'string')
    : [];

  const candidates = [
    ...(guideView?.checklist ?? []).map((item) => item.text),
    ...detailsRoute,
    ...(guideView?.important ?? []),
    ...navigation,
    ...craftPlan,
    ...timeSaves,
    ...(guideView?.rewards ?? []).map((item) => translate(language, 'companion.routeRewardPrefix', { text: item })),
    guideView?.nextZoneName ? translate(language, 'companion.routeNextPrefix', { text: guideView.nextZoneName }) : ''
  ];

  const seen = new Set<string>();

  return candidates
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLocaleLowerCase(language === 'en' ? 'en' : 'ru');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

export function formatRouteCardTitle(guide: GuideEntry, language: AppLanguage): string {
  if (guide.id === 'interlude_level_52_power_spike') {
    return translate(language, 'companion.setup52');
  }

  return getGuideView(guide, language)?.zoneName ?? (language === 'en' ? guide.zone_en : guide.zone_ru);
}

export function formatActTitle(act: ZoneAct | null, language: AppLanguage, profile: CampaignProfile = 'legacy-0.5') {
  if (act === null) {
    return translate(language, 'companion.routeTitleFallback');
  }

  if (typeof act === 'number' && isEndgameT15Act(act, profile)) {
    return translate(language, 'route.endgameToT15');
  }

  return isLegacyInterludeAct(act, profile)
    ? translate(language, 'companion.interludes')
    : translate(language, 'route.act', { act });
}

export function getRouteOverviewFromActs(routeActs: RouteActOverview, act: ZoneAct | null) {
  return routeActs.find((entry) => entry.act === act)?.zones ?? [];
}

export function getRouteCardModels(
  routeZones: RouteZoneOverview[],
  snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>,
  language: AppLanguage
): RouteCardModel[] {
  return routeZones.map((entry, index) => {
    const rewardLabels = getRequiredRewardLabelsForZone(entry.guide, snapshot, language);
    const routeLabels = rewardLabels.length > 0
      ? rewardLabels
      : getRouteFallbackLabels(entry.guide, language);
    const routeGuideView = getGuideView(entry.guide, language);
    const missedItemTexts = entry.missedItems.slice(0, 2).map((item) => translateDataText(item.text, language));
    const routeCardTitle = formatRouteCardTitle(entry.guide, language);
    const recommendedLevelLabel = routeGuideView?.recommendedLevelLabel ?? formatRecommendedLevelLabel(entry.guide, language);
    const bonusRewards = getRouteCampaignBonusModels(entry.guide, snapshot, language);
    const hasBonusRewards = bonusRewards.length > 0;
    const guideRu = getGuideView(entry.guide, 'ru');
    const guideEn = getGuideView(entry.guide, 'en');
    const detailValues = (details: unknown): string[] => {
      if (!details || typeof details !== 'object' || Array.isArray(details)) return [];
      return Object.values(details).flatMap((value) => Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : []);
    };
    const searchText = [
      entry.guide.id, entry.guide.zone_ru, entry.guide.zone_en, ...(entry.guide.aliases ?? []),
      ...(entry.guide.aliases_en ?? []), ...(entry.guide.zone_aliases ?? []),
      formatActTitle(entry.guide.act, 'ru'), formatActTitle(entry.guide.act, 'en'), routeCardTitle,
      recommendedLevelLabel, ...routeLabels, ...missedItemTexts,
      ...entry.guide.priority, ...entry.guide.rewards, ...entry.guide.important,
      ...entry.guide.boss_tips ?? [], ...detailValues(entry.guide.details),
      ...guideRu?.checklist?.map((item) => item.text) ?? [],
      ...guideEn?.checklist?.map((item) => item.text) ?? [],
      ...guideRu?.important ?? [], ...guideEn?.important ?? [],
      ...bonusRewards.flatMap((bonus) => [bonus.title, bonus.source, bonus.categoryLabel])
    ].join(' ');

    return {
      entry,
      allRouteLabels: routeLabels,
      indexLabel: String(index + 1).padStart(2, '0'),
      visibleRouteLabels: routeLabels.slice(0, ROUTE_OVERVIEW_VISIBLE_ITEMS),
      hiddenRouteLabelsCount: Math.max(0, routeLabels.length - ROUTE_OVERVIEW_VISIBLE_ITEMS),
      statusLabel: getRouteStatusLabel(entry.status, language),
      routeCardTitle,
      recommendedLevelLabel,
      missedItemTexts,
      isRouteNext: entry.status === 'pending' && routeZones[index - 1]?.status === 'current',
      hasBonusRewards,
      bonusRewards,
      searchText
    };
  });
}
