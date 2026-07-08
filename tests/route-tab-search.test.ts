import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRouteCards,
  formatRouteFilterLabel,
  getRouteFilterEmptyText,
  getRouteFilterSummary,
  getRouteJumpDisabledReason,
  getStructuredRouteBonusIds,
  normalizeRouteSearchQuery,
  ROUTE_FILTER_MODES,
  routeText,
  type RouteFilterCard
} from '../src/renderer/route-tab-search';

function card(
  id: string,
  status: RouteFilterCard['entry']['status'],
  options: {
    searchText?: string;
    hasBonusRewards?: boolean;
  } = {}
): RouteFilterCard {
  return {
    entry: {
      guide: { id },
      status
    },
    hasBonusRewards: Boolean(options.hasBonusRewards),
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

test('route tab filter options no longer expose unsupported missed or next modes', () => {
  assert.deepEqual(ROUTE_FILTER_MODES, ['all', 'current_act', 'bonuses', 'current_zone']);
  assert.equal(ROUTE_FILTER_MODES.includes('missed' as never), false);
  assert.equal(ROUTE_FILTER_MODES.includes('current_next' as never), false);
});

test('route tab bonus filter only keeps cards with structured bonus metadata', () => {
  const cards = [
    card('bonus-zone', 'pending', { hasBonusRewards: true }),
    card('manual-unchecked-bonus-zone', 'pending', { hasBonusRewards: true }),
    card('ordinary-missed-zone', 'missed'),
    card('ordinary-zone', 'visited')
  ];

  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'bonuses', query: '' }).map((entry) => entry.entry.guide.id),
    ['bonus-zone', 'manual-unchecked-bonus-zone']
  );
});

test('route tab current zone filter keeps only the current card', () => {
  const cards = [
    card('current-zone', 'current'),
    card('visited-zone', 'visited'),
    card('later-zone', 'pending')
  ];

  assert.deepEqual(
    filterRouteCards(cards, { filterMode: 'current_zone', query: '' }).map((entry) => entry.entry.guide.id),
    ['current-zone']
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
  assert.deepEqual(filterRouteCards(cards, { filterMode: 'current_zone', query: 'spirit' }), []);
});

test('route tab structured bonus helper uses campaign bonus ids and zone ids only', () => {
  const campaignBonuses = [
    { id: 'bonus-by-zone', zoneId: 'structured-zone' },
    { id: 'bonus-by-explicit-id', zoneId: 'other-zone' }
  ];

  assert.deepEqual(getStructuredRouteBonusIds({ id: 'structured-zone' }, campaignBonuses), ['bonus-by-zone']);
  assert.deepEqual(
    getStructuredRouteBonusIds({ id: 'explicit-zone', campaign_bonus_ids: ['bonus-by-explicit-id', 'missing'] }, campaignBonuses),
    ['bonus-by-explicit-id']
  );
  assert.deepEqual(getStructuredRouteBonusIds({ id: 'ordinary-route-note-zone' }, campaignBonuses), []);
});

test('route tab helper labels are localized', () => {
  assert.equal(formatRouteFilterLabel('current_act', 'ru'), 'Текущий акт');
  assert.equal(formatRouteFilterLabel('bonuses', 'en'), 'Zones with bonuses');
  assert.equal(formatRouteFilterLabel('current_zone', 'ru'), 'Текущая зона');
  assert.equal(routeText('empty', 'ru'), 'Поиск ничего не нашёл.');
});

test('route tab result summary explains active filters and counts', () => {
  assert.equal(
    getRouteFilterSummary({
      language: 'en',
      filterMode: 'bonuses',
      query: '',
      shownCount: 2,
      totalCount: 12,
      hasCurrentCard: false
    }),
    'Showing zones with bonuses: 2 of 12.'
  );
  assert.equal(
    getRouteFilterSummary({
      language: 'ru',
      filterMode: 'current_zone',
      query: '',
      shownCount: 1,
      totalCount: 10,
      hasCurrentCard: true
    }),
    'Показана текущая зона маршрута.'
  );
});

test('route tab empty states distinguish search, bonus, and missing current route card', () => {
  assert.equal(
    getRouteFilterEmptyText({
      language: 'en',
      filterMode: 'bonuses',
      query: '',
      shownCount: 0,
      totalCount: 8,
      hasCurrentCard: true
    }),
    'No zones with bonuses in this view.'
  );
  assert.equal(
    getRouteFilterEmptyText({
      language: 'ru',
      filterMode: 'current_zone',
      query: '',
      shownCount: 0,
      totalCount: 8,
      hasCurrentCard: false
    }),
    'Текущая зона не найдена в маршруте.'
  );
});

test('route tab current jump disabled reason is explicit', () => {
  assert.equal(getRouteJumpDisabledReason('current', 'en'), 'Current zone was not found in the list.');
});
