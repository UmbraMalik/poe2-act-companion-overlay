import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRouteCards,
  formatRouteFilterLabel,
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
  assert.equal(formatRouteFilterLabel('bonuses', 'en'), 'Bonuses only');
  assert.equal(routeText('empty', 'ru'), 'По этому запросу в маршруте ничего нет.');
});
