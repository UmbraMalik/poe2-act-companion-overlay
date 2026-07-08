import type { AppLanguage } from '../shared/types';

export type RouteFilterMode = 'all' | 'current_act' | 'bonuses' | 'current_zone';

export type RouteFilterCard = {
  entry: {
    guide: { id: string };
    status: 'current' | 'missed' | 'completed' | 'visited' | 'pending';
  };
  hasBonusRewards: boolean;
  searchText: string;
};

type RouteBonusGuide = {
  id: string;
  campaign_bonus_ids?: unknown;
  campaignBonusIds?: unknown;
};

type RouteBonusDefinition = {
  id: string;
  zoneId?: string | null;
};

export const ROUTE_FILTER_MODES: RouteFilterMode[] = [
  'all',
  'current_act',
  'bonuses',
  'current_zone'
];

const FILTER_LABELS: Record<RouteFilterMode, Record<AppLanguage, string>> = {
  all: { ru: 'Все', en: 'All' },
  current_act: { ru: 'Текущий акт', en: 'Current act' },
  bonuses: { ru: 'Зоны с бонусами', en: 'Zones with bonuses' },
  current_zone: { ru: 'Текущая зона', en: 'Current zone' }
};

const ROUTE_SEARCH_TEXT = {
  label: { ru: 'Поиск маршрута', en: 'Route search' },
  placeholder: { ru: 'Зона, акт, награда...', en: 'Zone, act, reward...' },
  empty: { ru: 'Поиск ничего не нашёл.', en: 'Search found no route zones.' },
  emptyBonuses: { ru: 'В этом списке нет зон с бонусами.', en: 'No zones with bonuses in this view.' },
  emptyCurrent: { ru: 'Текущая зона не найдена в маршруте.', en: 'Current zone was not found in the route.' },
  filters: { ru: 'Фильтры маршрута', en: 'Route filters' },
  jumps: { ru: 'Быстрые переходы', en: 'Route jumps' },
  quickJump: { ru: 'Быстрый переход', en: 'Quick jump' },
  current: { ru: 'К текущей зоне', en: 'Current zone' },
  currentDisabled: { ru: 'Текущая зона не найдена в списке.', en: 'Current zone was not found in the list.' }
} satisfies Record<string, Record<AppLanguage, string>>;

export type RouteFilterResultState = {
  shownCount: number;
  totalCount: number;
  hasCurrentCard: boolean;
};

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export function normalizeRouteSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function routeText(key: keyof typeof ROUTE_SEARCH_TEXT, language: AppLanguage): string {
  return ROUTE_SEARCH_TEXT[key][language] ?? ROUTE_SEARCH_TEXT[key].ru;
}

export function formatRouteFilterLabel(filterMode: RouteFilterMode, language: AppLanguage): string {
  return FILTER_LABELS[filterMode][language] ?? FILTER_LABELS[filterMode].ru;
}

function formatRouteResultCount(shownCount: number, totalCount: number, language: AppLanguage): string {
  return language === 'en'
    ? `${shownCount} of ${totalCount}`
    : `${shownCount} из ${totalCount}`;
}

export function getStructuredRouteBonusIds(
  guide: RouteBonusGuide,
  campaignBonuses: readonly RouteBonusDefinition[]
): string[] {
  const knownBonusIds = new Set(campaignBonuses.map((bonus) => bonus.id));
  const bonusIds = new Set<string>();

  for (const bonusId of [
    ...getStringArray(guide.campaign_bonus_ids),
    ...getStringArray(guide.campaignBonusIds)
  ]) {
    if (knownBonusIds.has(bonusId)) {
      bonusIds.add(bonusId);
    }
  }

  for (const bonus of campaignBonuses) {
    if (bonus.zoneId === guide.id) {
      bonusIds.add(bonus.id);
    }
  }

  return [...bonusIds];
}

export function getRouteFilterEmptyText(
  options: RouteFilterResultState & { filterMode: RouteFilterMode; query: string; language: AppLanguage }
): string {
  if (normalizeRouteSearchQuery(options.query)) {
    return routeText('empty', options.language);
  }
  if (options.filterMode === 'bonuses') {
    return routeText('emptyBonuses', options.language);
  }
  if (options.filterMode === 'current_zone' && !options.hasCurrentCard) {
    return routeText('emptyCurrent', options.language);
  }
  return routeText('empty', options.language);
}

export function getRouteFilterSummary(
  options: RouteFilterResultState & { filterMode: RouteFilterMode; query: string; language: AppLanguage }
): string {
  if (options.shownCount === 0) {
    return getRouteFilterEmptyText(options);
  }
  const count = formatRouteResultCount(options.shownCount, options.totalCount, options.language);
  if (normalizeRouteSearchQuery(options.query)) {
    return options.language === 'en' ? `Search result: ${count}.` : `Результат поиска: ${count}.`;
  }
  switch (options.filterMode) {
    case 'current_act':
      return options.language === 'en' ? `Current act: ${count} zones.` : `Показан текущий акт: ${count} зон.`;
    case 'bonuses':
      return options.language === 'en' ? `Showing zones with bonuses: ${count}.` : `Зоны с бонусами: ${count}.`;
    case 'current_zone':
      return options.language === 'en'
        ? 'Showing the current route zone.'
        : 'Показана текущая зона маршрута.';
    default:
      return options.language === 'en' ? `Showing ${count} zones.` : `Показано ${count} зон.`;
  }
}

export function getRouteJumpDisabledReason(
  kind: 'current',
  language: AppLanguage
): string {
  return routeText(`${kind}Disabled` as keyof typeof ROUTE_SEARCH_TEXT, language);
}

export function filterRouteCards<T extends RouteFilterCard>(
  cards: T[],
  options: { filterMode: RouteFilterMode; query: string }
): T[] {
  const normalizedQuery = normalizeRouteSearchQuery(options.query);

  return cards.filter((card) => {
    const matchesFilter =
      options.filterMode === 'all' ||
      options.filterMode === 'current_act' ||
      (options.filterMode === 'bonuses' && card.hasBonusRewards) ||
      (options.filterMode === 'current_zone' && card.entry.status === 'current');

    if (!matchesFilter) {
      return false;
    }

    return normalizedQuery.length === 0 ||
      normalizeRouteSearchQuery(card.searchText).includes(normalizedQuery);
  });
}
