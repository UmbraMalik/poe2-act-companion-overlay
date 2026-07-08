import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRouteCards,
  formatRouteFilterLabel,
  getRouteFilterEmptyText,
  getRouteFilterSummary,
  getRouteJumpDisabledReason,
  normalizeRouteSearchQuery,
  routeText,
  type RouteFilterCard
} from '../src/renderer/route-tab-search';

function card(
  id: string,
  status: RouteFilterCard['entry']['status'],
  options: {
    searchText?: string;
    hasBonusRewards?: boolean;
    missed?: boolean;
    next?: boolean;
  } = {}
): RouteFilterCard {
  return {
    entry: {
      guide: { id },
      status,
      missedItems: options.missed ? [{ id: `${id}-missed` }] : []
    },
    hasBonusRewards: Boolean(options.hasBonusRewards),
    isRouteNext: Boolean(options.next),
    searchText: options.searchText ?? id
  };
}

test('route tab search normalizes whitespace and casing', () => {
  assert.equal(normalizeRouteSearchQuery('  Act   TWO  '), 'act two');
});

test('route tab search matches route card text without mutating the source list', () => {
  const cards = [
    card('grelwood', 'current', { searchText: 'Act 1 Grelwood find the hooded one' }),
    card('red-vale', 'pending', { searchText: 'Act 1 Red Vale reward uncut gem' })
  ];

  const result = filterRouteCards(cards, { filterMode: 'all', query: 'uncut gem' });

  assert.deepEqual(result.map((entry) => entry.entry.guide.id), ['red-vale']);
  assert.equal(cards.length, 2);
});

test('route tab filters bonuses and missed rewards independently', () => {
  const cards = [
    card('bonus-zone', 'pending', { hasBonusRewards: true }),
    card('missed-zone', 'missed', { missed: true }),
    card('ordinary-zone', 'visited')
  ];

  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'bonuses', query: '' }).map((entry) => entry.entry.guide.id),
    ['bonus-zone']
  );
  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'missed', query: '' }).map((entry) => entry.entry.guide.id),
    ['missed-zone']
  );
});

test('route tab current-next filter keeps only current and next cards', () => {
  const cards = [
    card('current-zone', 'current'),
    card('next-zone', 'pending', { next: true }),
    card('later-zone', 'pending')
  ];

  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'current_next', query: '' }).map((entry) => entry.entry.guide.id),
    ['current-zone', 'next-zone']
  );
});

test('route tab search combines with active filters and can be empty', () => {
  const cards = [
    card('bonus-zone', 'pending', { hasBonusRewards: true, searchText: 'Act 2 bonus spirit' }),
    card('other-bonus', 'pending', { hasBonusRewards: true, searchText: 'Act 3 life reward' })
  ];

  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'bonuses', query: 'spirit' }).map((entry) => entry.entry.guide.id),
    ['bonus-zone']
  );
  assert.deepEqual(filterRouteCards(cards, { filterMode: 'missed', query: 'spirit' }), []);
});

test('route tab helper labels are localized', () => {
  assert.equal(formatRouteFilterLabel('current_act', 'ru'), 'Текущий акт');
  assert.equal(formatRouteFilterLabel('bonuses', 'en'), 'Zones with bonuses');
  assert.equal(formatRouteFilterLabel('missed', 'ru'), 'Пропущенные награды');
  assert.equal(routeText('empty', 'ru'), 'По этому запросу в маршруте ничего нет.');
});

test('route tab result summary explains active filters and counts', () => {
  assert.equal(
    getRouteFilterSummary({
      language: 'en',
      filterMode: 'bonuses',
      query: '',
      shownCount: 2,
      totalCount: 12,
      hasCurrentCard: false,
      hasNextCard: false
    }),
    'Showing zones with bonuses: 2 of 12.'
  );
  assert.equal(
    getRouteFilterSummary({
      language: 'ru',
      filterMode: 'current_next',
      query: '',
      shownCount: 1,
      totalCount: 10,
      hasCurrentCard: true,
      hasNextCard: false
    }),
    'Показана текущая карточка маршрута. Следующий шаг пока не найден.'
  );
});

test('route tab empty states distinguish search, missed, and missing current route card', () => {
  assert.equal(
    getRouteFilterEmptyText({
      language: 'en',
      filterMode: 'missed',
      query: '',
      shownCount: 0,
      totalCount: 8,
      hasCurrentCard: true,
      hasNextCard: true
    }),
    'No missed rewards in this view.'
  );
  assert.equal(
    getRouteFilterEmptyText({
      language: 'ru',
      filterMode: 'current_next',
      query: '',
      shownCount: 0,
      totalCount: 8,
      hasCurrentCard: false,
      hasNextCard: false
    }),
    'Текущая зона распознана, но карточка маршрута не найдена.'
  );
});

test('route tab jump disabled reasons are explicit', () => {
  assert.equal(getRouteJumpDisabledReason('current', 'en'), 'Current zone was not found in the route list.');
  assert.equal(getRouteJumpDisabledReason('next', 'ru'), 'Следующий шаг пока не найден.');
  assert.equal(getRouteJumpDisabledReason('missed', 'en'), 'No missed rewards to jump to.');
});
