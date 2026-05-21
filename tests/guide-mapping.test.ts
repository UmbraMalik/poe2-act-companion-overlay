import test from 'node:test';
import assert from 'node:assert/strict';
import type { GuideEntry } from '../src/shared/types';
import {
  findPotentiallySimilarZones,
  getGuideZones,
  getZoneAliases,
  getZoneAreaIds,
  loadGuideService,
  loadMainModule,
  normalizeAreaId
} from './helpers/zoneTestUtils';

function assertZoneResolvedByAreaId(
  service: ReturnType<typeof loadGuideService>,
  areaId: string,
  expectedZone: GuideEntry
): void {
  const match = service.resolveZoneMatch({
    rawLine: areaId,
    extractedInternalAreaId: areaId,
    extractedZoneName: expectedZone.zone_en
  });
  assert.equal(match?.guide?.id, expectedZone.id, `${areaId} expected ${expectedZone.id} but got ${match?.guide?.id ?? 'null'}`);
}

test('every guide zone resolves back to itself by area id, RU name, EN name and aliases', () => {
  const service = loadGuideService();

  for (const zone of getGuideZones()) {
    for (const areaId of getZoneAreaIds(zone)) {
      assertZoneResolvedByAreaId(service, areaId, zone);
    }

    assert.equal(service.findByZoneName(zone.zone_ru)?.id, zone.id, `${zone.id}: RU name must resolve to itself`);
    assert.equal(service.findByZoneName(zone.zone_en)?.id, zone.id, `${zone.id}: EN name must resolve to itself`);

    for (const alias of getZoneAliases(zone)) {
      assert.equal(service.findByZoneName(alias)?.id, zone.id, `${zone.id}: alias "${alias}" must resolve to itself`);
    }
  }
});

test('all area ids are unique and map to exactly one guide zone', () => {
  const seen = new Map<string, string>();

  for (const zone of getGuideZones()) {
    for (const areaId of getZoneAreaIds(zone)) {
      const normalized = normalizeAreaId(areaId);
      const previous = seen.get(normalized);
      assert.ok(!previous || previous === zone.id, `${areaId} expected ${previous} but got ${zone.id}`);
      seen.set(normalized, zone.id);
    }
  }

  assert.ok(seen.size >= 75, 'expected full normalized campaign area-id coverage');
});

test('every guide areaId infers the expected act across guide-covered prefixes', () => {
  const { inferActHintFromInternalAreaId } = loadMainModule();
  const seenPrefixes = new Set<string>();

  for (const zone of getGuideZones()) {
    for (const areaId of getZoneAreaIds(zone)) {
      const normalized = normalizeAreaId(areaId);
      const prefixMatch = normalized.match(/^(g[1-5]|p[1-3])(?:_|$)/);
      if (!prefixMatch) {
        continue;
      }

      seenPrefixes.add(prefixMatch[1]);
      assert.equal(
        inferActHintFromInternalAreaId(areaId),
        Number(zone.act),
        `${areaId} should infer Act ${zone.act}`
      );
    }
  }

  assert.deepEqual(
    [...seenPrefixes].sort(),
    ['g1', 'g2', 'g3', 'g4', 'p1', 'p2', 'p3'],
    'expected guide data to cover all shipped gameplay prefixes; G5 is covered by explicit act-hint cases and no-guide fixtures'
  );
});

test('inferActHintFromInternalAreaId covers G1-G5 and P1-P3 prefixes', () => {
  const { inferActHintFromInternalAreaId } = loadMainModule();

  const cases = [
    ['G1_11', 1],
    ['G2_12_2', 2],
    ['G3_17', 3],
    ['G4_11_2', 4],
    ['G5_demo', 5],
    ['P1_4', 5],
    ['P2_6', 5],
    ['P3_5', 5]
  ] as const;

  for (const [areaId, act] of cases) {
    assert.equal(inferActHintFromInternalAreaId(areaId), act, `${areaId} should infer Act ${act}`);
  }
});

test('Act 1 critical internal area ids stay mapped to the correct zones', () => {
  const service = loadGuideService();
  const cases = [
    ['G1_5', 'a1_red_vale', 'Красная Долина'],
    ['G1_6', 'a1_grim_tangle', 'Мрачные заросли'],
    ['G1_8', 'a1_mausoleum', 'Мавзолей претора'],
    ['G1_9', 'a1_tomb_of_the_consort', 'Супружеская гробница'],
    ['G1_11', 'a1_hunting_grounds', 'Охотничьи угодья'],
    ['G1_12', 'a1_freythorn', 'Фрейторн'],
    ['G1_13_1', 'a1_ogham_farmlands', 'Фермерские земли Огама'],
    ['G1_13_2', 'a1_ogham_village', 'Деревня Огам'],
    ['G1_14', 'a1_manor_ramparts', 'Стены замка'],
    ['G1_15', 'a1_ogham_manor', 'Замок Огам']
  ] as const;

  for (const [areaId, expectedId, expectedRu] of cases) {
    const match = service.resolveZoneMatch({
      rawLine: areaId,
      extractedInternalAreaId: areaId,
      extractedZoneName: expectedRu
    });
    assert.equal(match?.guide?.id, expectedId, `${areaId} expected ${expectedId}`);
    assert.equal(match?.guide?.zone_ru, expectedRu, `${areaId} expected ${expectedRu}`);
  }
});

test('Act 2 Keth and Titan route internal area ids stay mapped to the correct RU zones', () => {
  const service = loadGuideService();
  const cases = [
    ['G2_4_1', 'a2_keth', 'Кет'],
    ['G2_6', 'a2_valley_titans', 'Долина Титанов'],
    ['G2_4_2', 'a2_lost_city', 'Затерянный город'],
    ['G2_4_3', 'a2_buried_shrines', 'Захоронённые святилища'],
    ['G2_7', 'a2_titan_grotto', 'Грот Титанов'],
    ['G2_13', 'a2_trial_of_the_sekhemas', 'Испытание Сехем']
  ] as const;

  for (const [areaId, expectedId, expectedRu] of cases) {
    const match = service.resolveZoneMatch({
      rawLine: areaId,
      extractedInternalAreaId: areaId,
      extractedZoneName: expectedRu
    });
    assert.equal(match?.guide?.id, expectedId, `${areaId} expected ${expectedId}`);
    assert.equal(match?.guide?.zone_ru, expectedRu, `${areaId} expected ${expectedRu}`);
  }
});

test('areaId takes priority over fuzzy/name matching for ambiguous zones', () => {
  const service = loadGuideService();

  const huntingVsFarmlands = service.resolveZoneMatch({
    rawLine: 'G1_11',
    extractedInternalAreaId: 'G1_11',
    extractedZoneName: 'Фермерские земли Огама'
  });
  assert.equal(huntingVsFarmlands?.guide?.id, 'a1_hunting_grounds');

  const khariVsGalai = service.resolveZoneMatch({
    rawLine: 'P2_1',
    extractedInternalAreaId: 'P2_1',
    extractedZoneName: 'Ворота Галаи'
  });
  assert.equal(khariVsGalai?.guide?.id, 'interlude_khari_crossing');
});

test('known regression pairs stay separated and do not cross-map', () => {
  const service = loadGuideService();
  const cases = [
    ['P2_6', 'Qimah'],
    ['P2_7', 'Qimah Reservoir'],
    ['P1_4', 'Holten'],
    ['P1_6', 'Holten Estate'],
    ['P3_2', 'Kriar Village'],
    ['P3_5', 'Kriar Peaks'],
    ['P3_4', 'Howling Caves'],
    ['G1_11', 'Hunting Grounds'],
    ['G1_13_1', 'Ogham Farmlands'],
    ['P2_1', 'The Khari Crossing']
  ] as const;

  for (const [areaId, expectedZoneEn] of cases) {
    const zone = service.resolveZoneMatch({
      rawLine: areaId,
      extractedInternalAreaId: areaId,
      extractedZoneName: expectedZoneEn
    })?.guide;
    assert.equal(zone?.zone_en, expectedZoneEn, `${areaId} must resolve to ${expectedZoneEn}`);
  }

  assert.notEqual(
    service.findByZoneName('Охотничьи угодья')?.id,
    service.findByZoneName('Фермерские земли Огама')?.id
  );
  assert.notEqual(
    service.findByZoneName('Ворота Галаи')?.id,
    service.findByZoneName('Кхарийский перевал')?.id
  );
  assert.equal(service.findByZoneName('The Galai Gates')?.id, 'interlude_galai_gates');
});

test('automatically detected similar zones still resolve correctly by exact area id', () => {
  const service = loadGuideService();
  const pairs = findPotentiallySimilarZones();
  assert.ok(pairs.length >= 4, 'expected similar-zone pairs across the campaign');

  for (const pair of pairs) {
    for (const zone of [pair.left, pair.right]) {
      for (const areaId of getZoneAreaIds(zone)) {
        assertZoneResolvedByAreaId(service, areaId, zone);
      }
    }
  }
});

test('explicit no-guide English names stay unmapped to guide cards', () => {
  const service = loadGuideService();
  for (const rawZoneName of ['The Glade', 'Uncharted Vault', 'Forgotten Causeway']) {
    const match = service.resolveZoneMatch({
      rawLine: rawZoneName,
      extractedInternalAreaId: null,
      extractedZoneName: rawZoneName
    });
    assert.equal(match?.guide ?? null, null, `${rawZoneName} must stay no-guide`);
  }
});
