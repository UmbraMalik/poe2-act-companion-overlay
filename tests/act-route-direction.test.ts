import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoutePath, insetMapPoint, normalizedName, resolveRouteDirection } from '../src/renderer/act-route-direction';
import { getGuideZones } from './test-utils';

test('route direction previews Acts 1–4 independently of the live zone', () => {
  const starts = [
    ['a1_clearfell', 'a1_grelwood'],
    ['a2_vastiri_outskirts', 'a2_ardura_caravan'],
    ['a3_sandswept_marsh', 'a3_ziggurat_encampment'],
    ['a4_kingsmarch', 'a4_whakapanu_island']
  ];
  const zones = getGuideZones();
  for (const [source, target] of starts) {
    const selected = zones.find((zone: any) => zone.id === source);
    const byName = new Map<string, { entry: { guide: typeof selected } }>(zones.filter((zone: any) => zone.act === selected.act)
      .map((guide: any) => [normalizedName(guide.zone_ru), { entry: { guide } }]));
    assert.deepEqual(resolveRouteDirection(selected, 'elsewhere', byName), { originId: source, nextId: target, isPreview: true });
    assert.deepEqual(resolveRouteDirection(selected, source, byName), { originId: source, nextId: target, isPreview: false });
    assert.equal(resolveRouteDirection(selected, null, byName).nextId, target);
  }
});

test('selection follows the guide without inventing cross-map or self links', () => {
  const zones = getGuideZones().filter((zone: any) => zone.act === 3);
  const byName = new Map<string, { entry: { guide: any } }>(zones.map((guide: any) => [normalizedName(guide.zone_ru), { entry: { guide } }]));
  const temple = zones.find((zone: any) => zone.id === 'a3_temple_of_chaos');
  assert.equal(resolveRouteDirection(temple, 'a3_sandswept_marsh', byName).nextId, 'a3_chimera_wetlands');
  const final = zones.find((zone: any) => zone.id === 'a3_black_chambers');
  assert.equal(resolveRouteDirection(final, null, byName).nextId, null);
  assert.equal(resolveRouteDirection({ ...temple, next_zone_ru: temple.zone_ru }, null, byName).nextId, null);
  assert.deepEqual(resolveRouteDirection(null, null, byName), { originId: null, nextId: null, isPreview: false });
});

test('arrow vertex is the exact midpoint of the original cubic in either direction', () => {
  for (const [from, to] of [[[13, 77], [24, 67]], [[48, 84], [30, 81]], [[84, 79], [64, 66]]] as const) {
    const base = buildRoutePath(from, to).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    const split = buildRoutePath(from, to, true).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    assert.equal(split.length, 14);
    const expected = [0, 1].map(i => (base[i] + 3 * base[i + 2] + 3 * base[i + 4] + base[i + 6]) / 8);
    assert.ok(Math.abs(split[6] - expected[0]) < 1e-9);
    assert.ok(Math.abs(split[7] - expected[1]) < 1e-9);
    assert.deepEqual(split.slice(0, 2), [insetMapPoint(from)[0] * 10, insetMapPoint(from)[1] * 7.4]);
    assert.deepEqual(split.slice(-2), base.slice(-2));
  }
});
