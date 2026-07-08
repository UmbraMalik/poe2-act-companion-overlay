import type { AppLanguage } from '../shared/types';

export type RouteFilterMode = 'all' | 'current_act' | 'bonuses' | 'missed' | 'current_next';

export type RouteFilterCard = {
  entry: {
    guide: { id: string };
    status: 'current' | 'missed' | 'completed' | 'visited' | 'pending';
    missedItems: unknown[];
  };
  hasBonusRewards: boolean;
  isRouteNext: boolean;
  searchText: string;
};

export const ROUTE_FILTER_MODES: RouteFilterMode[] = [
  'all',
  'current_act',
  'bonuses',
  'missed',
  'current_next'
];

const FILTER_LABELS: Record<RouteFilterMode, Record<AppLanguage, string>> = {
  all: { ru: 'Все', en: 'All' },
  current_act: { ru: 'Текущий акт', en: 'Current act' },
  bonuses: { ru: 'Зоны с бонусами', en: 'Zones with bonuses' },
  missed: { ru: 'Пропущенные награды', en: 'Missed rewards' },
  current_next: { ru: 'Сейчас / дальше', en: 'Current / next' }
};

const ROUTE_SEARCH_TEXT = {
  label: { ru: 'Поиск маршрута', en: 'Route search' },
  placeholder: { ru: 'Зона, акт, награда...', en: 'Zone, act, reward...' },
  empty: { ru: 'По этому запросу в маршруте ничего нет.', en: 'No route items match this view.' },
  emptyBonuses: { ru: 'В этом списке нет зон с бонусами.', en: 'No zones with bonuses in this view.' },
  emptyMissed: { ru: 'Пропущенных наград нет.', en: 'No missed rewards in this view.' },
  emptyCurrent: { ru: 'Текущая зона распознана, но карточка маршрута не найдена.', en: 'Current zone is recognized, but no route card was found.' },
  filters: { ru: 'Фильтры маршрута', en: 'Route filters' },
  jumps: { ru: 'Быстрые переходы', en: 'Route jumps' },
  quickJump: { ru: 'Быстрый переход', en: 'Quick jump' },
  current: { ru: 'К текущей зоне', en: 'Current zone' },
  next: { ru: 'К следующему шагу', en: 'Next step' },
  missed: { ru: 'К пропущенному', en: 'Missed rewards' },
  currentDisabled: { ru: 'Текущая зона не найдена в списке маршрута.', en: 'Current zone was not found in the route list.' },
  nextDisabled: { ru: 'Следующий шаг пока не найден.', en: 'Next route step was not found.' },
  missedDisabled: { ru: 'Пропущенных наград нет.', en: 'No missed rewards to jump to.' }
} satisfies Record<string, Record<AppLanguage, string>>;

export type RouteFilterResultState = {
  shownCount: number;
  totalCount: number;
  hasCurrentCard: boolean;
  hasNextCard: boolean;
};

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

export function getRouteFilterEmptyText(
  options: RouteFilterResultState & { filterMode: RouteFilterMode; query: string; language: AppLanguage }
): string {
  if (normalizeRouteSearchQuery(options.query)) {
    return routeText('empty', options.language);
  }
  if (options.filterMode === 'bonuses') {
    return routeText('emptyBonuses', options.language);
  }
  if (options.filterMode === 'missed') {
    return routeText('emptyMissed', options.language);
  }
  if (options.filterMode === 'current_next' && !options.hasCurrentCard) {
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
      return options.language === 'en' ? `Current act: ${count}.` : `Текущий акт: ${count}.`;
    case 'bonuses':
      return options.language === 'en' ? `Showing zones with bonuses: ${count}.` : `Зоны с бонусами: ${count}.`;
    case 'missed':
      return options.language === 'en' ? `Showing missed rewards: ${count}.` : `Пропущенные награды: ${count}.`;
    case 'current_next':
      if (!options.hasNextCard) {
        return options.language === 'en'
          ? 'Showing current route card. Next step is not known yet.'
          : 'Показана текущая карточка маршрута. Следующий шаг пока не найден.';
      }
      return options.language === 'en'
        ? `Showing current route card and next step: ${count}.`
        : `Показаны текущая карточка маршрута и следующий шаг: ${count}.`;
    default:
      return options.language === 'en' ? `All route cards: ${count}.` : `Все карточки маршрута: ${count}.`;
  }
}

export function getRouteJumpDisabledReason(
  kind: 'current' | 'next' | 'missed',
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
      (options.filterMode === 'missed' && card.entry.missedItems.length > 0) ||
      (options.filterMode === 'current_next' && (card.entry.status === 'current' || card.isRouteNext));

    if (!matchesFilter) {
      return false;
    }

    return normalizedQuery.length === 0 ||
      normalizeRouteSearchQuery(card.searchText).includes(normalizedQuery);
  });
}
