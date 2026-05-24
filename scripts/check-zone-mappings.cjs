const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDE_PATH = path.join(ROOT, 'src/data/guide.json');
const CAMPAIGN_BONUSES_PATH = path.join(ROOT, 'src/data/campaign-bonuses.json');
const DEFAULT_LOG_DIR = path.join(ROOT, 'tests/fixtures/poe2-logs');

function readArgValue(flagName) {
  const prefix = `${flagName}=`;
  const argWithEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (argWithEquals) {
    return argWithEquals.slice(prefix.length);
  }

  const argIndex = process.argv.indexOf(flagName);
  if (argIndex !== -1 && process.argv[argIndex + 1]) {
    return process.argv[argIndex + 1];
  }

  return null;
}

function resolveOptionalPath(input) {
  if (!input) {
    return null;
  }

  return path.resolve(ROOT, String(input));
}

function getLogPaths() {
  const logDir =
    resolveOptionalPath(readArgValue('--log-dir') ?? process.env.POE2_ZONE_MAPPING_LOG_DIR) ??
    DEFAULT_LOG_DIR;

  return {
    en:
      resolveOptionalPath(readArgValue('--en-log') ?? process.env.POE2_ZONE_MAPPING_EN_LOG) ??
      path.join(logDir, 'LatestClientEN.txt'),
    ru:
      resolveOptionalPath(readArgValue('--ru-log') ?? process.env.POE2_ZONE_MAPPING_RU_LOG) ??
      path.join(logDir, 'LatestClientRU.txt')
  };
}

const LOG_PATHS = getLogPaths();

const GENERATED_AREA_REGEX = /Generating level \d+ area "(?<scene>[^"]+)" with seed \d+/i;
const SCENE_SET_SOURCE_REGEX = /\[SCENE\]\s+Set Source\s+\[(?<scene>.*?)\]/i;
const ENTERED_AREA_PATTERNS = [
  /You have entered\s+(.+?)[.!]?$/i,
  /Entering area:\s*(.+?)[.!]?$/i,
  /\u0412\u044b \u0432\u043e\u0448\u043b\u0438 \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u044c:\s*(.+?)[.!]?$/i,
  /\u0412\u044b \u0432\u043e\u0448\u043b\u0438:\s*(.+?)[.!]?$/i,
  /\u0412\u0445\u043e\u0434 \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u044c:\s*(.+?)[.!]?$/i
];
const HOLD_PENDING_AREA_ID_SCENES = new Set([
  '(null)',
  '(unknown)',
  'null',
  'unknown',
  'act 1',
  'act 2',
  'act 3',
  'act 4',
  'act 5',
  '\u0430\u043a\u0442 1',
  '\u0430\u043a\u0442 2',
  '\u0430\u043a\u0442 3',
  '\u0430\u043a\u0442 4',
  '\u0430\u043a\u0442 5',
  'interlude',
  '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f'
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeText(input) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/['".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInternalAreaId(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function stripZoneEventPrefixes(input) {
  return String(input ?? '')
    .trim()
    .replace(/^(?:you have entered|entering area)\s*:?\s*/i, '')
    .replace(
      /^(?:\u0432\u044b \u0432\u043e\u0448\u043b\u0438 \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u044c|\u0432\u044b \u0432\u043e\u0448\u043b\u0438|\u0432\u0445\u043e\u0434 \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u044c)\s*:?\s*/i,
      ''
    )
    .trim();
}

function normalizeZoneLookup(zoneName) {
  return normalizeText(stripZoneEventPrefixes(String(zoneName ?? '')));
}

function getEntryAreaIds(entry) {
  const values = [...(entry.area_ids ?? []), ...(entry.areaIds ?? [])];
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function getEntryAliases(entry) {
  return [
    ...(entry.aliases ?? []),
    ...(entry.aliases_en ?? []),
    ...(entry.zone_aliases ?? [])
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => String(value ?? '').trim()).filter(Boolean);
}

function getGuideDetailTexts(details) {
  if (Array.isArray(details)) {
    return normalizeStringArray(details);
  }

  if (!details || typeof details !== 'object') {
    return [];
  }

  return Object.values(details).flatMap((value) => {
    if (Array.isArray(value)) {
      return normalizeStringArray(value);
    }

    if (typeof value === 'string') {
      const text = value.trim();
      return text ? [text] : [];
    }

    return [];
  });
}

function getGuideContentTexts(entry) {
  return [
    ...normalizeStringArray(entry.rewards),
    ...normalizeStringArray(entry.skip),
    ...normalizeStringArray(entry.important),
    ...normalizeStringArray(entry.after),
    ...normalizeStringArray(entry.boss_tips),
    ...normalizeStringArray(entry.xp_notes),
    ...normalizeStringArray(entry.crafting_tips),
    ...normalizeStringArray((entry.checklist ?? []).map((item) => item?.text)),
    ...getGuideDetailTexts(entry.details)
  ];
}

function getCampaignBonusEventZoneIds(bonus) {
  return (bonus.eventRules ?? [])
    .flatMap((rule) => rule?.zoneIds ?? [])
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizeZoneBonusName(value) {
  return normalizeText(value);
}

function entryAcceptsAreaId(entry, areaId) {
  if (!entry) {
    return false;
  }

  const normalizedAreaId = normalizeInternalAreaId(areaId);
  const entryAreaIds = getEntryAreaIds(entry).map((value) => normalizeInternalAreaId(value));
  return entryAreaIds.length === 0 || entryAreaIds.includes(normalizedAreaId);
}

function cleanRawZoneName(rawZoneName) {
  return String(rawZoneName ?? '')
    .trim()
    .replace(/[.!]+$/g, '')
    .trim();
}

function extractGeneratedAreaId(line) {
  const match = String(line ?? '').match(GENERATED_AREA_REGEX);
  return match?.groups?.scene ? cleanRawZoneName(match.groups.scene) : null;
}

function extractNamedZone(line) {
  const sceneMatch = String(line ?? '').match(SCENE_SET_SOURCE_REGEX);
  if (sceneMatch?.groups?.scene) {
    return cleanRawZoneName(sceneMatch.groups.scene);
  }

  for (const pattern of ENTERED_AREA_PATTERNS) {
    const match = String(line ?? '').match(pattern);
    if (match?.[1]) {
      return cleanRawZoneName(match[1]);
    }
  }

  return null;
}

function decodeLogFile(filePath) {
  const rawBytes = fs.readFileSync(filePath);
  const strippedBytes = Buffer.from([...rawBytes].filter((byte) => byte !== 0));
  return strippedBytes.toString('utf8').replace(/\u0000/g, '');
}

function extractAreaIdZoneMapFromLog(filePath) {
  const text = decodeLogFile(filePath);
  const lines = text.split(/\r?\n/);
  const pairs = new Map();
  let pendingAreaId = null;

  for (const line of lines) {
    const generatedAreaId = extractGeneratedAreaId(line);
    if (generatedAreaId) {
      pendingAreaId = generatedAreaId;
      continue;
    }

    const zoneName = extractNamedZone(line);
    if (!zoneName || !pendingAreaId) {
      continue;
    }

    if (HOLD_PENDING_AREA_ID_SCENES.has(normalizeText(zoneName))) {
      continue;
    }

    const previousZoneName = pairs.get(pendingAreaId);
    if (previousZoneName && previousZoneName !== zoneName) {
      throw new Error(
        `conflicting log mapping for ${pendingAreaId}: "${previousZoneName}" vs "${zoneName}"`
      );
    }

    pairs.set(pendingAreaId, zoneName);
    pendingAreaId = null;
  }

  return pairs;
}

const guideData = readJson(GUIDE_PATH);
const guideEntries = guideData.zones ?? guideData;
const campaignBonusData = readJson(CAMPAIGN_BONUSES_PATH);
const campaignBonuses = Array.isArray(campaignBonusData?.bonuses) ? campaignBonusData.bonuses : [];

const idMap = new Map();
const zoneRuMap = new Map();
const zoneEnMap = new Map();
const aliasMap = new Map();
const areaIdMap = new Map();

const normalizedNameOwners = new Map();
const normalizedAreaIdOwners = new Map();
const aliasCollisions = [];
const areaIdCollisions = [];

let aliasCount = 0;
let areaIdCount = 0;

for (const entry of guideEntries) {
  idMap.set(entry.id, entry);

  const lookupTexts = [
    ['zone_ru', entry.zone_ru],
    ['zone_en', entry.zone_en],
    ...getEntryAliases(entry).map((value) => ['alias', value])
  ];

  for (const [source, rawValue] of lookupTexts) {
    const normalizedKey = normalizeText(rawValue);
    if (!normalizedKey) {
      continue;
    }

    const owner = {
      id: entry.id,
      zone_ru: entry.zone_ru,
      zone_en: entry.zone_en,
      source,
      rawValue: String(rawValue)
    };
    const previous = normalizedNameOwners.get(normalizedKey);
    if (previous && previous.id !== owner.id) {
      aliasCollisions.push({
        normalizedAlias: normalizedKey,
        entryA: previous,
        entryB: owner
      });
      continue;
    }

    normalizedNameOwners.set(normalizedKey, owner);
  }

  const normalizedZoneRu = normalizeText(entry.zone_ru);
  if (normalizedZoneRu) {
    zoneRuMap.set(normalizedZoneRu, entry);
  }

  const normalizedZoneEn = normalizeText(entry.zone_en);
  if (normalizedZoneEn) {
    zoneEnMap.set(normalizedZoneEn, entry);
  }

  const aliases = getEntryAliases(entry);
  aliasCount += aliases.length;
  for (const alias of aliases) {
    const normalizedAlias = normalizeText(alias);
    if (normalizedAlias) {
      aliasMap.set(normalizedAlias, entry);
    }
  }

  const areaIds = getEntryAreaIds(entry);
  areaIdCount += areaIds.length;
  for (const areaId of areaIds) {
    const normalizedAreaId = normalizeInternalAreaId(areaId);
    if (!normalizedAreaId) {
      continue;
    }

    const owner = {
      id: entry.id,
      zone_ru: entry.zone_ru,
      zone_en: entry.zone_en,
      areaId
    };
    const previous = normalizedAreaIdOwners.get(normalizedAreaId);
    if (previous && previous.id !== owner.id) {
      areaIdCollisions.push({
        normalizedAreaId,
        entryA: previous,
        entryB: owner
      });
      continue;
    }

    normalizedAreaIdOwners.set(normalizedAreaId, owner);
    areaIdMap.set(normalizedAreaId, entry);
  }
}

function resolveGuide({ areaId = null, zoneName = null } = {}) {
  const rawZoneName = zoneName ?? areaId ?? null;
  const normalizedAreaId = normalizeInternalAreaId(areaId);
  if (normalizedAreaId) {
    const guide = areaIdMap.get(normalizedAreaId) ?? null;
    if (guide) {
      return {
        guide,
        matcherReason: 'internal_area',
        rawZoneName,
        normalizedZoneName: normalizedAreaId
      };
    }
  }

  const normalizedZoneName = normalizeZoneLookup(zoneName);
  if (!normalizedZoneName || HOLD_PENDING_AREA_ID_SCENES.has(normalizedZoneName)) {
    return {
      guide: null,
      matcherReason: 'none',
      rawZoneName,
      normalizedZoneName
    };
  }

  function finalizeTextMatch(guide, matcherReason) {
    if (!guide) {
      return null;
    }

    if (normalizedAreaId && !entryAcceptsAreaId(guide, normalizedAreaId)) {
      return {
        guide: null,
        matcherReason: 'none',
        rawZoneName,
        normalizedZoneName
      };
    }

    return {
      guide,
      matcherReason,
      rawZoneName,
      normalizedZoneName
    };
  }

  const zoneRuMatch = zoneRuMap.get(normalizedZoneName);
  if (zoneRuMatch) {
    return finalizeTextMatch(zoneRuMatch, 'zone_ru');
  }

  const zoneEnMatch = zoneEnMap.get(normalizedZoneName);
  if (zoneEnMatch) {
    return finalizeTextMatch(zoneEnMatch, 'zone_en');
  }

  const aliasMatch = aliasMap.get(normalizedZoneName);
  if (aliasMatch) {
    return finalizeTextMatch(aliasMatch, 'alias');
  }

  return {
    guide: null,
    matcherReason: 'none',
    rawZoneName,
    normalizedZoneName
  };
}

const failures = [];
let positiveAssertions = 0;
let negativeAssertions = 0;
let noGuideAssertions = 0;
let logAssertions = 0;
let contentAssertions = 0;

function fail(message) {
  failures.push(message);
}

function describeGuide(entry) {
  if (!entry) {
    return 'null';
  }

  return `${entry.id} (${entry.zone_ru} / ${entry.zone_en})`;
}

function expectGuide(label, input, expectedId) {
  positiveAssertions += 1;
  const result = resolveGuide(input);
  const actualId = result.guide?.id ?? null;
  if (actualId !== expectedId) {
    fail(`${label}: expected ${expectedId}, got ${actualId ?? 'null'}`);
  }
}

function expectNotGuide(label, input, forbiddenId) {
  negativeAssertions += 1;
  const result = resolveGuide(input);
  const actualId = result.guide?.id ?? null;
  if (actualId === forbiddenId) {
    fail(`${label}: must not resolve to ${forbiddenId}`);
  }
}

function expectNoGuide(label, input, expectedRawZoneName = null) {
  noGuideAssertions += 1;
  const result = resolveGuide(input);
  if (result.guide) {
    fail(`${label}: expected no guide, got ${result.guide.id}`);
  }
  if (expectedRawZoneName !== null && result.rawZoneName !== expectedRawZoneName) {
    fail(
      `${label}: expected raw zone name "${expectedRawZoneName}", got "${result.rawZoneName ?? 'null'}"`
    );
  }
}

function expectLogPair(logLabel, pairs, areaId, expectedZoneName) {
  if (!pairs || !expectedZoneName) {
    return;
  }

  logAssertions += 1;
  const actualZoneName = pairs.get(areaId) ?? null;
  if (actualZoneName !== expectedZoneName) {
    fail(
      `${logLabel} log ${areaId}: expected "${expectedZoneName}", got "${actualZoneName ?? 'null'}"`
    );
  }
}

function expectGuideFieldValue(label, entryId, fieldName, expectedValue) {
  contentAssertions += 1;
  const entry = idMap.get(entryId);
  if (!entry) {
    fail(`${label}: missing guide entry ${entryId}`);
    return;
  }

  const actualValue = entry[fieldName] ?? null;
  if (actualValue !== expectedValue) {
    fail(
      `${label}: expected ${entryId}.${fieldName}="${expectedValue}", got "${actualValue ?? 'null'}"`
    );
  }
}

function expectGuideAreaId(label, entryId, expectedAreaId) {
  contentAssertions += 1;
  const entry = idMap.get(entryId);
  if (!entry) {
    fail(`${label}: missing guide entry ${entryId}`);
    return;
  }

  const normalizedExpectedAreaId = normalizeInternalAreaId(expectedAreaId);
  const areaIds = getEntryAreaIds(entry).map((value) => normalizeInternalAreaId(value));
  if (!areaIds.includes(normalizedExpectedAreaId)) {
    fail(`${label}: expected ${entryId} area_ids to include ${expectedAreaId}`);
  }
}

function expectGuideContentIncludes(label, entryId, expectedText) {
  contentAssertions += 1;
  const entry = idMap.get(entryId);
  if (!entry) {
    fail(`${label}: missing guide entry ${entryId}`);
    return;
  }

  const normalizedExpected = normalizeText(expectedText);
  const texts = getGuideContentTexts(entry);
  const matched = texts.some((text) => normalizeText(text).includes(normalizedExpected));
  if (!matched) {
    fail(`${label}: expected ${entryId} content to include "${expectedText}"`);
  }
}

function expectGuideContentExcludes(label, entryId, forbiddenText) {
  contentAssertions += 1;
  const entry = idMap.get(entryId);
  if (!entry) {
    fail(`${label}: missing guide entry ${entryId}`);
    return;
  }

  const normalizedForbidden = normalizeText(forbiddenText);
  const texts = getGuideContentTexts(entry);
  const matched = texts.some((text) => normalizeText(text).includes(normalizedForbidden));
  if (matched) {
    fail(`${label}: expected ${entryId} content to exclude "${forbiddenText}"`);
  }
}

function expectCampaignBonusFieldValue(label, bonusId, fieldName, expectedValue) {
  contentAssertions += 1;
  const bonus = campaignBonuses.find((entry) => entry.id === bonusId) ?? null;
  if (!bonus) {
    fail(`${label}: missing campaign bonus ${bonusId}`);
    return;
  }

  const actualValue = bonus[fieldName] ?? null;
  if (actualValue !== expectedValue) {
    fail(
      `${label}: expected ${bonusId}.${fieldName}="${expectedValue}", got "${actualValue ?? 'null'}"`
    );
  }
}

function findCampaignBonusByContent({ title, sourceIncludes }) {
  const normalizedTitle = normalizeText(title);
  const normalizedSource = normalizeText(sourceIncludes);
  return (
    campaignBonuses.find(
      (bonus) =>
        normalizeText(bonus?.title) === normalizedTitle &&
        normalizeText(bonus?.source).includes(normalizedSource)
    ) ?? null
  );
}

function expectCampaignBonusOwnedBy(label, lookup, expectedZoneId, expectedZoneRu) {
  contentAssertions += 1;
  const bonus = findCampaignBonusByContent(lookup);
  if (!bonus) {
    fail(
      `${label}: missing campaign bonus title="${lookup.title}" source~="${lookup.sourceIncludes}"`
    );
    return;
  }

  if (bonus.zoneId !== expectedZoneId) {
    fail(`${label}: expected zoneId ${expectedZoneId}, got ${bonus.zoneId ?? 'null'}`);
  }
  if (expectedZoneRu && bonus.zone_ru !== expectedZoneRu) {
    fail(`${label}: expected zone_ru "${expectedZoneRu}", got "${bonus.zone_ru ?? 'null'}"`);
  }

  const expectedEventZoneId = normalizeInternalAreaId(expectedZoneId);
  const eventZoneIds = getCampaignBonusEventZoneIds(bonus);
  if (eventZoneIds.length === 0) {
    fail(`${label}: expected eventRules.zoneIds to include ${expectedZoneId}`);
    return;
  }

  const invalidEventZoneIds = eventZoneIds.filter(
    (zoneId) => normalizeInternalAreaId(zoneId) !== expectedEventZoneId
  );
  if (invalidEventZoneIds.length > 0) {
    fail(
      `${label}: expected all eventRules.zoneIds to be ${expectedZoneId}, got ${invalidEventZoneIds.join(', ')}`
    );
  }
}

function expectNoCampaignBonusOnZone(label, zoneId, forbiddenText) {
  contentAssertions += 1;
  const normalizedZoneId = normalizeInternalAreaId(zoneId);
  const normalizedForbidden = normalizeText(forbiddenText);
  const matchedBonus = campaignBonuses.find((bonus) => {
    if (normalizeInternalAreaId(bonus?.zoneId) !== normalizedZoneId) {
      return false;
    }

    const texts = [
      bonus?.zone_ru,
      bonus?.title,
      bonus?.source,
      ...(Array.isArray(bonus?.details) ? bonus.details : [])
    ];
    return texts.some((text) => normalizeText(text).includes(normalizedForbidden));
  });

  if (matchedBonus) {
    fail(
      `${label}: unexpected campaign bonus ${matchedBonus.id} on ${zoneId} matching "${forbiddenText}"`
    );
  }
}

function expectCampaignBonusZoneMatchesGuide(label, bonusId) {
  contentAssertions += 1;
  const bonus = campaignBonuses.find((entry) => entry.id === bonusId) ?? null;
  if (!bonus) {
    fail(`${label}: missing campaign bonus ${bonusId}`);
    return;
  }

  if (!bonus.zoneId) {
    fail(`${label}: ${bonusId} is missing zoneId`);
    return;
  }

  const guide = idMap.get(bonus.zoneId) ?? null;
  if (!guide) {
    fail(`${label}: ${bonusId} points to missing guide ${bonus.zoneId}`);
    return;
  }

  if (bonus.zone_ru !== guide.zone_ru) {
    fail(
      `${label}: expected ${bonusId}.zone_ru="${guide.zone_ru}", got "${bonus.zone_ru ?? 'null'}"`
    );
  }
}

function getCurrentZoneCampaignBonusIds({ guideId = null, rawZoneName = null } = {}) {
  const guide = guideId ? idMap.get(guideId) ?? null : null;
  const zoneNames = guideId
    ? new Set()
    : new Set(
        [normalizeZoneBonusName(guide?.zone_ru), normalizeZoneBonusName(rawZoneName)].filter(Boolean)
      );

  return campaignBonuses
    .filter((bonus) => {
      if (guideId) {
        return bonus.zoneId === guideId;
      }

      return zoneNames.has(normalizeZoneBonusName(bonus.zone_ru));
    })
    .map((bonus) => bonus.id);
}

function expectCurrentZoneContainsBonus(label, currentZone, expectedBonusId) {
  contentAssertions += 1;
  const bonusIds = getCurrentZoneCampaignBonusIds(currentZone);
  if (!bonusIds.includes(expectedBonusId)) {
    fail(
      `${label}: expected ${expectedBonusId} in [${bonusIds.join(', ') || 'none'}]`
    );
  }
}

function expectCurrentZoneExcludesBonus(label, currentZone, forbiddenBonusId) {
  contentAssertions += 1;
  const bonusIds = getCurrentZoneCampaignBonusIds(currentZone);
  if (bonusIds.includes(forbiddenBonusId)) {
    fail(
      `${label}: did not expect ${forbiddenBonusId} in [${bonusIds.join(', ')}]`
    );
  }
}

for (const collision of aliasCollisions) {
  fail(
    [
      `alias collision: ${collision.entryA.rawValue}`,
      `normalized alias: ${collision.normalizedAlias}`,
      `guide A: ${collision.entryA.id}`,
      `zone_ru A: ${collision.entryA.zone_ru}`,
      `zone_en A: ${collision.entryA.zone_en}`,
      `guide B: ${collision.entryB.id}`,
      `zone_ru B: ${collision.entryB.zone_ru}`,
      `zone_en B: ${collision.entryB.zone_en}`
    ].join('\n')
  );
}

for (const collision of areaIdCollisions) {
  fail(
    [
      `areaId collision: ${collision.entryA.areaId}`,
      `normalized areaId: ${collision.normalizedAreaId}`,
      `guide A: ${collision.entryA.id}`,
      `zone_ru A: ${collision.entryA.zone_ru}`,
      `zone_en A: ${collision.entryA.zone_en}`,
      `guide B: ${collision.entryB.id}`,
      `zone_ru B: ${collision.entryB.zone_ru}`,
      `zone_en B: ${collision.entryB.zone_en}`
    ].join('\n')
  );
}

for (const entry of guideEntries) {
  expectGuide(`${entry.id} zone_ru`, { zoneName: entry.zone_ru }, entry.id);
  expectGuide(`${entry.id} zone_en`, { zoneName: entry.zone_en }, entry.id);

  for (const alias of getEntryAliases(entry)) {
    expectGuide(`${entry.id} alias ${alias}`, { zoneName: alias }, entry.id);
  }

  for (const areaId of getEntryAreaIds(entry)) {
    expectGuide(`${entry.id} areaId ${areaId}`, { areaId }, entry.id);
  }
}

for (const bonus of campaignBonuses) {
  if (!bonus.zoneId) {
    continue;
  }

  expectCampaignBonusZoneMatchesGuide(`campaign bonus zone match ${bonus.id}`, bonus.id);
}

expectGuideFieldValue('P2_1 zone_en', 'interlude_khari_crossing', 'zone_en', 'The Khari Crossing');
expectGuideFieldValue(
  'P2_1 zone_ru',
  'interlude_khari_crossing',
  'zone_ru',
  '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
);
expectGuideAreaId('P2_1 areaId', 'interlude_khari_crossing', 'P2_1');
expectGuideContentIncludes(
  'P2_1 reward',
  'interlude_khari_crossing',
  '+5% \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u044f'
);
expectGuideContentIncludes(
  'P2_1 shrine wording',
  'interlude_khari_crossing',
  '\u0440\u0430\u0441\u043f\u043b\u0430\u0432\u043b\u0435\u043d\u043d\u0443\u044e \u0441\u0432\u044f\u0442\u044b\u043d\u044e'
);
expectGuideContentIncludes(
  'P2_1 detail wording',
  'interlude_khari_crossing',
  '\u0440\u0430\u0441\u043f\u043b\u0430\u0432\u043b\u0435\u043d\u043d\u0430\u044f \u0441\u0432\u044f\u0442\u044b\u043d\u044f \u0432 \u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u043e\u043c \u043f\u0435\u0440\u0435\u0432\u0430\u043b\u0435'
);

expectGuideFieldValue('P2_5 zone_en', 'interlude_galai_gates', 'zone_en', 'The Galai Gates');
expectGuideFieldValue(
  'P2_5 zone_ru',
  'interlude_galai_gates',
  'zone_ru',
  '\u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438'
);
expectGuideAreaId('P2_5 areaId', 'interlude_galai_gates', 'P2_5');
expectGuideContentIncludes(
  'P2_5 boss reward',
  'interlude_galai_gates',
  '\u0411\u043e\u0441\u0441 \u0412\u043e\u0440\u043d\u0430\u0441'
);
expectGuideContentExcludes(
  'P2_5 no Risu wording',
  'interlude_galai_gates',
  '\u0420\u0438\u0441\u0443'
);
expectGuideContentExcludes(
  'P2_5 no Khari shrine wording',
  'interlude_galai_gates',
  '\u0440\u0430\u0441\u043f\u043b\u0430\u0432\u043b\u0435\u043d\u043d\u0443\u044e \u0441\u0432\u044f\u0442\u044b\u043d\u044e'
);
expectGuideContentExcludes(
  'P2_5 no Khari life reward',
  'interlude_galai_gates',
  '+5% \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u044f'
);

expectCampaignBonusOwnedBy(
  'Khari life bonus ownership',
  {
    title: '+5% \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u044f',
    sourceIncludes:
      '\u0440\u0430\u0441\u043f\u043b\u0430\u0432\u043b\u0435\u043d\u043d\u0430\u044f \u0441\u0432\u044f\u0442\u044b\u043d\u044f'
  },
  'interlude_khari_crossing',
  '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
);
expectCampaignBonusFieldValue(
  'Khari life source label',
  'int2_khari_crossing_life_percent',
  'source',
  '\u0420\u0430\u0441\u043f\u043b\u0430\u0432\u043b\u0435\u043d\u043d\u0430\u044f \u0441\u0432\u044f\u0442\u044b\u043d\u044f'
);
expectCampaignBonusOwnedBy(
  'Khari weapon bonus ownership',
  {
    title:
      '+2 \u043f\u0430\u0441\u0441\u0438\u0432\u043d\u044b\u0445 \u043e\u0447\u043a\u0430 \u043d\u0430\u0431\u043e\u0440\u0430 \u043e\u0440\u0443\u0436\u0438\u044f',
    sourceIncludes: '\u0420\u0438\u0441\u0443'
  },
  'interlude_khari_crossing',
  '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
);
expectNoCampaignBonusOnZone(
  'P2_5 no Khari named campaign bonus',
  'interlude_galai_gates',
  '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
);
expectNoCampaignBonusOnZone(
  'P2_5 no Khari life campaign bonus',
  'interlude_galai_gates',
  '+5% \u043c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0437\u0434\u043e\u0440\u043e\u0432\u044c\u044f'
);
expectCurrentZoneContainsBonus(
  'P2_1 current zone keeps Khari life bonus',
  {
    guideId: 'interlude_khari_crossing',
    rawZoneName: 'The Khari Crossing'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneContainsBonus(
  'P2_1 current zone keeps Khari weapon bonus',
  {
    guideId: 'interlude_khari_crossing',
    rawZoneName: 'The Khari Crossing'
  },
  'int2_khari_crossing_aktu_anundr_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'P2_5 current zone excludes Khari weapon bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: 'The Galai Gates'
  },
  'int2_khari_crossing_aktu_anundr_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'P2_5 current zone excludes Khari life bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: 'The Galai Gates'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneExcludesBonus(
  'P2_5 stale raw Khari EN still excludes Khari life bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: 'The Khari Crossing'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneExcludesBonus(
  'P2_5 stale raw Khari RU still excludes Khari life bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneExcludesBonus(
  'P2_5 stale raw Khari EN still excludes Khari weapon bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: 'The Khari Crossing'
  },
  'int2_khari_crossing_aktu_anundr_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'P2_5 RU current zone excludes Khari life bonus',
  {
    guideId: 'interlude_galai_gates',
    rawZoneName: '\u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneContainsBonus(
  'P2_1 stale raw Galai EN still keeps Khari life bonus',
  {
    guideId: 'interlude_khari_crossing',
    rawZoneName: 'The Galai Gates'
  },
  'int2_khari_crossing_life_percent'
);
expectCurrentZoneContainsBonus(
  'P2_1 stale raw Galai EN still keeps Khari weapon bonus',
  {
    guideId: 'interlude_khari_crossing',
    rawZoneName: 'The Galai Gates'
  },
  'int2_khari_crossing_aktu_anundr_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'Qimah Reservoir excludes Qimah choice bonus',
  {
    guideId: 'i2_kima_reservoir',
    rawZoneName: 'Qimah Reservoir'
  },
  'int2_kima_pillar_choice'
);
expectCurrentZoneExcludesBonus(
  'Qimah Reservoir stale raw Qimah excludes Qimah choice bonus',
  {
    guideId: 'i2_kima_reservoir',
    rawZoneName: 'Qimah'
  },
  'int2_kima_pillar_choice'
);
expectCurrentZoneExcludesBonus(
  'Holten Estate excludes Holten runes bonus',
  {
    guideId: 'i_final_holten_estate',
    rawZoneName: 'Holten Estate'
  },
  'int1_holten_ferryman_runes_optional'
);
expectCurrentZoneExcludesBonus(
  'Holten Estate stale raw Holten excludes Holten runes bonus',
  {
    guideId: 'i_final_holten_estate',
    rawZoneName: 'Holten'
  },
  'int1_holten_ferryman_runes_optional'
);
expectCurrentZoneExcludesBonus(
  'Holten excludes Holten Estate passive bonus',
  {
    guideId: 'i_final_holten',
    rawZoneName: 'Holten'
  },
  'int3_final_zolin_zelina_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'Holten stale raw Holten Estate excludes Holten Estate passive bonus',
  {
    guideId: 'i_final_holten',
    rawZoneName: 'Holten Estate'
  },
  'int3_final_zolin_zelina_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'Kriar Peaks excludes Kriar Village spirit bonus',
  {
    guideId: 'i2_kriar_peaks',
    rawZoneName: 'Kriar Peaks'
  },
  'int3_mount_cryer_lythara_spirit'
);
expectCurrentZoneExcludesBonus(
  'Kriar Peaks stale raw Kriar Village excludes Kriar Village spirit bonus',
  {
    guideId: 'i2_kriar_peaks',
    rawZoneName: 'Kriar Village'
  },
  'int3_mount_cryer_lythara_spirit'
);
expectCurrentZoneExcludesBonus(
  'Kriar Village excludes Kriar Peaks unique bonus',
  {
    guideId: 'i2_mount_cryer',
    rawZoneName: 'Kriar Village'
  },
  'int3_kriar_peaks_unique_optional'
);
expectCurrentZoneExcludesBonus(
  'Kriar Village stale raw Kriar Peaks excludes Kriar Peaks unique bonus',
  {
    guideId: 'i2_mount_cryer',
    rawZoneName: 'Kriar Peaks'
  },
  'int3_kriar_peaks_unique_optional'
);
expectCurrentZoneContainsBonus(
  'Howling Caves keeps Yeti bonus',
  {
    guideId: 'i2_glacial_tarn',
    rawZoneName: 'Howling Caves'
  },
  'int3_howling_caves_yeti_weapon_points'
);
expectCurrentZoneContainsBonus(
  'Howling Caves stale raw Glacial Tarn still keeps Yeti bonus',
  {
    guideId: 'i2_glacial_tarn',
    rawZoneName: 'Glacial Tarn'
  },
  'int3_howling_caves_yeti_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'Glacial Tarn raw zone excludes Howling Caves Yeti bonus',
  {
    guideId: null,
    rawZoneName: 'Glacial Tarn'
  },
  'int3_howling_caves_yeti_weapon_points'
);
expectCurrentZoneExcludesBonus(
  'Ледниковое озеро raw zone excludes Howling Caves Yeti bonus',
  {
    guideId: null,
    rawZoneName: '\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e'
  },
  'int3_howling_caves_yeti_weapon_points'
);

const EXPECTED_LOG_CASES = [
  {
    areaId: 'P1_3',
    en: 'The Blackwood',
    ru: '\u0427\u0435\u0440\u043d\u043e\u043b\u0435\u0441\u044c\u0435',
    guideId: 'i_final_blackwood'
  },
  {
    areaId: 'P1_4',
    en: 'Holten',
    ru: '\u0425\u043e\u043b\u0442\u0435\u043d',
    guideId: 'i_final_holten'
  },
  {
    areaId: 'P1_6',
    en: 'Holten Estate',
    ru: '\u041f\u043e\u043c\u0435\u0441\u0442\u044c\u0435 \u0425\u043e\u043b\u0442\u0435\u043d',
    guideId: 'i_final_holten_estate'
  },
  {
    areaId: 'G3_12',
    en: null,
    ru: '\u0425\u0440\u0430\u043c \u041a\u043e\u043f\u0435\u043a\u0430',
    guideId: 'a3_temple_kopec'
  },
  {
    areaId: 'P2_3',
    en: 'Sel Khari Sanctuary',
    ru: '\u0425\u0440\u0430\u043c \u0421\u0435\u043b\u0445\u0430\u0440\u0438',
    guideId: 'interlude_selvari_sanctuary'
  },
  {
    areaId: 'P2_1',
    en: 'The Khari Crossing',
    ru: '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b',
    guideId: 'interlude_khari_crossing'
  },
  {
    areaId: 'P2_5',
    en: 'The Galai Gates',
    ru: '\u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438',
    guideId: 'interlude_galai_gates'
  },
  {
    areaId: 'P2_7',
    en: 'Qimah Reservoir',
    ru: '\u0412\u043e\u0434\u043e\u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u041a\u0438\u043c\u0430',
    guideId: 'i2_kima_reservoir'
  },
  {
    areaId: 'P2_6',
    en: 'Qimah',
    ru: null,
    guideId: 'i2_kima'
  },
  {
    areaId: 'P3_3',
    en: 'Glacial Tarn',
    ru: '\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e',
    guideId: 'interlude_glacial_tarn'
  },
  {
    areaId: 'P3_4',
    en: 'Howling Caves',
    ru: '\u0412\u043e\u044e\u0449\u0438\u0435 \u043f\u0435\u0449\u0435\u0440\u044b',
    guideId: 'i2_glacial_tarn'
  },
  {
    areaId: 'P3_5',
    en: 'Kriar Peaks',
    ru: '\u041f\u0438\u043a\u0438 \u041a\u0440\u0438\u0430\u0440',
    guideId: 'i2_kriar_peaks'
  },
  {
    areaId: 'P3_2',
    en: 'Kriar Village',
    ru: '\u0414\u0435\u0440\u0435\u0432\u043d\u044f \u041a\u0440\u0438\u0430\u0440',
    guideId: 'i2_mount_cryer'
  }
];

const extractedLogs = {};
const missingLogs = [];
for (const [label, filePath] of Object.entries(LOG_PATHS)) {
  if (!fs.existsSync(filePath)) {
    const missingLog = `${label.toUpperCase()}: ${filePath}`;
    missingLogs.push(missingLog);
    fail(`missing zone mapping log: ${missingLog}`);
    continue;
  }
  extractedLogs[label] = extractAreaIdZoneMapFromLog(filePath);
}

for (const zoneCase of EXPECTED_LOG_CASES) {
  expectLogPair('EN', extractedLogs.en, zoneCase.areaId, zoneCase.en);
  expectLogPair('RU', extractedLogs.ru, zoneCase.areaId, zoneCase.ru);

  if (zoneCase.guideId) {
    if (zoneCase.en) {
      expectGuide(`${zoneCase.areaId} EN`, {
        areaId: zoneCase.areaId,
        zoneName: zoneCase.en
      }, zoneCase.guideId);
    }
    if (zoneCase.ru) {
      expectGuide(`${zoneCase.areaId} RU`, {
        areaId: zoneCase.areaId,
        zoneName: zoneCase.ru
      }, zoneCase.guideId);
    }
    continue;
  }

  if (zoneCase.en) {
    expectNoGuide(`${zoneCase.areaId} EN no-guide`, {
      areaId: zoneCase.areaId,
      zoneName: zoneCase.en
    }, zoneCase.en);
  }
  if (zoneCase.ru) {
    expectNoGuide(`${zoneCase.areaId} RU no-guide`, {
      areaId: zoneCase.areaId,
      zoneName: zoneCase.ru
    }, zoneCase.ru);
  }
}

expectNotGuide('The Khari Crossing -> The Galai Gates', {
  zoneName: 'The Khari Crossing'
}, 'interlude_galai_gates');
expectNotGuide('\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b -> \u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438', {
  zoneName: '\u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b'
}, 'interlude_galai_gates');
expectNotGuide('The Galai Gates -> The Khari Crossing', {
  zoneName: 'The Galai Gates'
}, 'interlude_khari_crossing');
expectNotGuide('\u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438 -> \u041a\u0445\u0430\u0440\u0438\u0439\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u0435\u0432\u0430\u043b', {
  zoneName: '\u0412\u043e\u0440\u043e\u0442\u0430 \u0413\u0430\u043b\u0430\u0438'
}, 'interlude_khari_crossing');

expectNotGuide('Qimah Reservoir -> Qimah', {
  zoneName: 'Qimah Reservoir'
}, 'i2_kima');
expectNotGuide('\u0412\u043e\u0434\u043e\u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u041a\u0438\u043c\u0430 -> \u041a\u0438\u043c\u0430', {
  zoneName: '\u0412\u043e\u0434\u043e\u0445\u0440\u0430\u043d\u0438\u043b\u0438\u0449\u0435 \u041a\u0438\u043c\u0430'
}, 'i2_kima');
expectNotGuide('Qimah -> Qimah Reservoir', {
  zoneName: 'Qimah'
}, 'i2_kima_reservoir');

expectNotGuide('Holten Estate -> Holten', {
  zoneName: 'Holten Estate'
}, 'i_final_holten');
expectNotGuide('\u041f\u043e\u043c\u0435\u0441\u0442\u044c\u0435 \u0425\u043e\u043b\u0442\u0435\u043d -> \u0425\u043e\u043b\u0442\u0435\u043d', {
  zoneName: '\u041f\u043e\u043c\u0435\u0441\u0442\u044c\u0435 \u0425\u043e\u043b\u0442\u0435\u043d'
}, 'i_final_holten');
expectNotGuide('Holten -> Holten Estate', {
  zoneName: 'Holten'
}, 'i_final_holten_estate');

expectNotGuide('Glacial Tarn -> Howling Caves', {
  zoneName: 'Glacial Tarn'
}, 'i2_glacial_tarn');
expectNotGuide('\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e -> \u0412\u043e\u044e\u0449\u0438\u0435 \u043f\u0435\u0449\u0435\u0440\u044b', {
  zoneName: '\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e'
}, 'i2_glacial_tarn');

expectNotGuide('Kriar Peaks -> Kriar Village', {
  zoneName: 'Kriar Peaks'
}, 'i2_mount_cryer');
expectNotGuide('\u041f\u0438\u043a\u0438 \u041a\u0440\u0438\u0430\u0440 -> \u0414\u0435\u0440\u0435\u0432\u043d\u044f \u041a\u0440\u0438\u0430\u0440', {
  zoneName: '\u041f\u0438\u043a\u0438 \u041a\u0440\u0438\u0430\u0440'
}, 'i2_mount_cryer');
expectNotGuide('Kriar Village -> Kriar Peaks', {
  zoneName: 'Kriar Village'
}, 'i2_kriar_peaks');
expectNotGuide('\u0414\u0435\u0440\u0435\u0432\u043d\u044f \u041a\u0440\u0438\u0430\u0440 -> \u041f\u0438\u043a\u0438 \u041a\u0440\u0438\u0430\u0440', {
  zoneName: '\u0414\u0435\u0440\u0435\u0432\u043d\u044f \u041a\u0440\u0438\u0430\u0440'
}, 'i2_kriar_peaks');

expectGuide('Clearfell', { zoneName: 'Clearfell' }, 'a1_clearfell');
expectGuide('Clearfell Encampment', { zoneName: 'Clearfell Encampment' }, 'a1_clearfell_encampment');
expectNotGuide('Clearfell Encampment -> Clearfell', {
  zoneName: 'Clearfell Encampment'
}, 'a1_clearfell');
expectGuide('\u041b\u0430\u0433\u0435\u0440\u044c \u041a\u043b\u0438\u0440\u0444\u0435\u043b\u043b', {
  zoneName: '\u041b\u0430\u0433\u0435\u0440\u044c \u041a\u043b\u0438\u0440\u0444\u0435\u043b\u043b'
}, 'a1_clearfell_encampment');
expectGuide('Ardura Caravan', { zoneName: 'Ardura Caravan' }, 'a2_ardura_caravan');
expectGuide('Caravan', { zoneName: 'Caravan' }, 'a2_ardura_caravan');
expectGuide('The Ziggurat Encampment', { zoneName: 'The Ziggurat Encampment' }, 'a3_ziggurat_encampment');
expectGuide('Ziggurat', { zoneName: 'Ziggurat' }, 'a3_ziggurat_encampment');

expectGuide('areaId priority P2_1 beats stale The Galai Gates', {
  areaId: 'P2_1',
  zoneName: 'The Galai Gates'
}, 'interlude_khari_crossing');
expectGuide('areaId priority P2_5 beats stale The Khari Crossing', {
  areaId: 'P2_5',
  zoneName: 'The Khari Crossing'
}, 'interlude_galai_gates');
expectGuide('areaId priority P2_6 beats stale Qimah Reservoir', {
  areaId: 'P2_6',
  zoneName: 'Qimah Reservoir'
}, 'i2_kima');
expectGuide('areaId priority P2_7 beats stale Qimah', {
  areaId: 'P2_7',
  zoneName: 'Qimah'
}, 'i2_kima_reservoir');
expectGuide('areaId priority P1_4 beats stale Holten Estate', {
  areaId: 'P1_4',
  zoneName: 'Holten Estate'
}, 'i_final_holten');
expectGuide('areaId priority P1_6 beats stale Holten', {
  areaId: 'P1_6',
  zoneName: 'Holten'
}, 'i_final_holten_estate');
expectGuide('areaId priority P3_2 beats stale Kriar Peaks', {
  areaId: 'P3_2',
  zoneName: 'Kriar Peaks'
}, 'i2_mount_cryer');
expectGuide('areaId priority P3_5 beats stale Kriar Village', {
  areaId: 'P3_5',
  zoneName: 'Kriar Village'
}, 'i2_kriar_peaks');
expectGuide('areaId priority P3_3 beats stale Howling Caves', {
  areaId: 'P3_3',
  zoneName: 'Howling Caves'
}, 'interlude_glacial_tarn');
expectGuide('areaId priority P3_3 beats stale \u0412\u043e\u044e\u0449\u0438\u0435 \u043f\u0435\u0449\u0435\u0440\u044b', {
  areaId: 'P3_3',
  zoneName: '\u0412\u043e\u044e\u0449\u0438\u0435 \u043f\u0435\u0449\u0435\u0440\u044b'
}, 'interlude_glacial_tarn');

expectGuide('Pools of Khatal', { zoneName: 'Pools of Khatal' }, 'interlude_pools_of_khatal');
expectGuide('Etched Ravine', { zoneName: 'Etched Ravine' }, 'interlude_etched_ravine');
expectGuide('Glacial Tarn guide', {
  zoneName: 'Glacial Tarn'
}, 'interlude_glacial_tarn');
expectGuide('\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e guide', {
  zoneName: '\u041b\u0435\u0434\u043d\u0438\u043a\u043e\u0432\u043e\u0435 \u043e\u0437\u0435\u0440\u043e'
}, 'interlude_glacial_tarn');

if (failures.length > 0) {
  console.error('Zone mapping check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}\n`);
  }
  process.exit(1);
}

const summary = [
  'Zone mapping check passed.',
  `entries=${guideEntries.length}`,
  `aliases=${aliasCount}`,
  `areaIds=${areaIdCount}`,
  `positives=${positiveAssertions}`,
  `negatives=${negativeAssertions}`,
  `noGuide=${noGuideAssertions}`,
  `logPairs=${logAssertions}`,
  `content=${contentAssertions}`
];

if (missingLogs.length > 0) {
  summary.push(`missingLogs=${missingLogs.length}`);
  for (const missingLog of missingLogs) {
    summary.push(`missingLog:${missingLog}`);
  }
}

console.log(summary.join(' '));
