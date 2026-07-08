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
  bonuses: { ru: 'Бонусы', en: 'Bonuses only' },
  missed: { ru: 'Пропущено', en: 'Missed rewards' },
  current_next: { ru: 'Сейчас / дальше', en: 'Current / next' }
};

const ROUTE_SEARCH_TEXT = {
  label: { ru: 'Поиск маршрута', en: 'Route search' },
  placeholder: { ru: 'Зона, акт, награда...', en: 'Zone, act, reward...' },
  empty: { ru: 'По этому запросу в маршруте ничего нет.', en: 'No route items match this view.' },
  filters: { ru: 'Фильтры маршрута', en: 'Route filters' },
  jumps: { ru: 'Быстрые переходы', en: 'Route jumps' },
  current: { ru: 'К текущей зоне', en: 'Current zone' },
  next: { ru: 'К следующему шагу', en: 'Next step' },
  missed: { ru: 'К пропущенному', en: 'Missed rewards' }
} satisfies Record<string, Record<AppLanguage, string>>;

export function normalizeRouteSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function routeText(key: keyof typeof ROUTE_SEARCH_TEXT, language: AppLanguage): string {
  return ROUTE_SEARCH_TEXT[key][language] ?? ROUTE_SEARCH_TEXT[key].ru;
}

export function formatRouteFilterLabel(filterMode: RouteFilterMode, language: AppLanguage): string {
  return FILTER_LABELS[filterMode][language] ?? FILTER_LABELS[filterMode].ru;
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
