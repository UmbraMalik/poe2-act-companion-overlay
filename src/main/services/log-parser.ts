import ruLogPatterns from '../../data/log-patterns.ru.json';
import enLogPatterns from '../../data/log-patterns.en.json';

export interface ParsedSceneSourceEvent {
  rawZoneName: string;
}

export interface ParsedLevelUpEvent {
  level: number;
}

export type PermanentRewardKey =
  | 'coldResistance10'
  | 'lightningResistance10'
  | 'fireResistance10'
  | 'resistance5'
  | 'life20'
  | 'life5'
  | 'mana5'
  | 'flatMana'
  | 'spirit30'
  | 'spirit40'
  | 'passivePoints'
  | 'weaponSetPassivePoints'
  | 'charmSlot'
  | 'charmChargeGain'
  | 'flaskLifeRecovery'
  | 'stunThreshold'
  | 'elementalAilmentThreshold'
  | 'unknownReward';

export interface ParsedPermanentRewardEvent {
  rewardKey: PermanentRewardKey;
  matchedKeywords: string[];
  amount?: number;
  element?: string;
  sourceText: string;
}

export type ParsedLogEvent =
  | { type: 'scene_source'; scene: ParsedSceneSourceEvent }
  | { type: 'level_up'; level: ParsedLevelUpEvent }
  | { type: 'permanent_reward'; reward: ParsedPermanentRewardEvent }
  | { type: 'player_death'; player: string }
  | { type: 'client_restart' }
  | { type: 'none' };



function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

const logPatterns = {
  scene: {
    enter: uniqueStrings([
      ...(ruLogPatterns.scene?.enter ?? []),
      ...(enLogPatterns.scene?.enter ?? [])
    ]),
    ignoreScenes: uniqueStrings([
      ...(ruLogPatterns.scene?.ignoreScenes ?? []),
      ...(enLogPatterns.scene?.ignoreScenes ?? [])
    ])
  },
  events: {
    clientRestart: uniqueStrings([
      ...(ruLogPatterns.events?.clientRestart ?? []),
      ...(enLogPatterns.events?.clientRestart ?? [])
    ]),
    levelUp: uniqueStrings([
      ...(ruLogPatterns.events?.levelUp ?? []),
      ...(enLogPatterns.events?.levelUp ?? [])
    ]),
    playerDeath: uniqueStrings([
      ...(ruLogPatterns.events?.playerDeath ?? []),
      ...(enLogPatterns.events?.playerDeath ?? [])
    ]),
    rewardResistance: uniqueStrings([
      ...(ruLogPatterns.events?.rewardResistance ?? []),
      ...(enLogPatterns.events?.rewardResistance ?? [])
    ]),
    rewardSpirit: uniqueStrings([
      ...(ruLogPatterns.events?.rewardSpirit ?? []),
      ...(enLogPatterns.events?.rewardSpirit ?? [])
    ]),
    rewardLife: uniqueStrings([
      ...(ruLogPatterns.events?.rewardLife ?? []),
      ...(enLogPatterns.events?.rewardLife ?? [])
    ]),
    rewardLifePercent: uniqueStrings([
      ...((ruLogPatterns.events as Record<string, string[]>).rewardLifePercent ?? []),
      ...((enLogPatterns.events as Record<string, string[]>).rewardLifePercent ?? [])
    ]),
    rewardManaPercent: uniqueStrings([
      ...(ruLogPatterns.events?.rewardManaPercent ?? []),
      ...(enLogPatterns.events?.rewardManaPercent ?? [])
    ]),
    rewardPassivePoints: uniqueStrings([
      ...(ruLogPatterns.events?.rewardPassivePoints ?? []),
      ...(enLogPatterns.events?.rewardPassivePoints ?? [])
    ]),
    rewardWeaponSetPoints: uniqueStrings([
      ...(ruLogPatterns.events?.rewardWeaponSetPoints ?? []),
      ...(enLogPatterns.events?.rewardWeaponSetPoints ?? [])
    ]),
    rewardCharm: uniqueStrings([
      ...(ruLogPatterns.events?.rewardCharm ?? []),
      ...(enLogPatterns.events?.rewardCharm ?? [])
    ]),
    rewardFlaskRecovery: uniqueStrings([
      ...(ruLogPatterns.events?.rewardFlaskRecovery ?? []),
      ...(enLogPatterns.events?.rewardFlaskRecovery ?? [])
    ]),
    rewardStunThreshold: uniqueStrings([
      ...(ruLogPatterns.events?.rewardStunThreshold ?? []),
      ...(enLogPatterns.events?.rewardStunThreshold ?? [])
    ]),
    rewardElementalAilmentThreshold: uniqueStrings([
      ...((ruLogPatterns.events as Record<string, string[]>).rewardElementalAilmentThreshold ?? []),
      ...((enLogPatterns.events as Record<string, string[]>).rewardElementalAilmentThreshold ?? [])
    ])
  }
};

const SCENE_SOURCE_REGEXES = logPatterns.scene.enter.map((pattern) => new RegExp(pattern, 'i'));
const GENERATED_AREA_REGEX = /Generating level \d+ area "(?<scene>[^"]+)" with seed \d+/i;
const SCENE_SET_SOURCE_REGEX = /\[SCENE\]\s+Set Source\s+\[(?<scene>.*?)\]/i;

const ENTERED_AREA_PATTERNS = [
  /You have entered\s+(.+?)[.!]?$/i,
  /Entering area:\s*(.+?)[.!]?$/i,
  /Вы вошли в область:\s*(.+?)[.!]?$/i,
  /Вы вошли:\s*(.+?)[.!]?$/i,
  /Вход в область:\s*(.+?)[.!]?$/i
];
const IGNORED_SCENE_SOURCES = new Set(
  logPatterns.scene.ignoreScenes.map((entry) => normalizeText(entry))
);

function makeRegex(pattern: string): RegExp {
  return new RegExp(pattern, 'i');
}

function firstMatch(patterns: string[], line: string): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = line.match(makeRegex(pattern));
    if (match) {
      return match;
    }
  }

  return null;
}

export function normalizePoeMarkup(line: string): string {
  return line.replace(/\[[^\]|]+\|([^\]]+)\]/g, '$1');
}

export function normalizeText(line: string): string {
  return normalizePoeMarkup(String(line ?? ''))
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[‘’`´]/g, "'")
    .replace(/[«»]/g, '"')
    .replace(/[".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORMALIZED_LOG_TIMESTAMP_RE = /^\d{4}[/-]\d{1,2}[/-]\d{1,2}\s+\d{1,2}\s+\d{1,2}\s+\d{1,2}\s+/;
const NORMALIZED_REWARD_PREFIXES = [
  /^quest\s+reward\s+/,
  /^reward\s+/,
  /^награда\s+за\s+задание\s+/,
  /^награда\s+/
];

function stripNormalizedRewardPrefixes(line: string): string {
  let next = line.trim();
  let previous = '';

  while (next && next !== previous) {
    previous = next;
    next = next.replace(NORMALIZED_LOG_TIMESTAMP_RE, '').trim();
    for (const prefix of NORMALIZED_REWARD_PREFIXES) {
      next = next.replace(prefix, '').trim();
    }
  }

  return next;
}

function cleanRawZoneName(rawZoneName: string): string {
  return rawZoneName.trim().replace(/[.!]+$/g, '').trim();
}

export function extractGeneratedAreaId(line: string): string | null {
  const generatedAreaMatch = line.match(GENERATED_AREA_REGEX);
  const rawScene = generatedAreaMatch?.groups?.scene;
  return rawScene ? cleanRawZoneName(rawScene) : null;
}

export function extractNamedZoneFromLine(line: string): string | null {
  const sceneMatch = line.match(SCENE_SET_SOURCE_REGEX);
  const rawScene = sceneMatch?.groups?.scene;
  if (rawScene) {
    return cleanRawZoneName(rawScene);
  }

  for (const pattern of ENTERED_AREA_PATTERNS) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return cleanRawZoneName(match[1]);
    }
  }

  return null;
}

export function parseSceneSource(line: string): ParsedSceneSourceEvent | null {
  const generatedAreaId = extractGeneratedAreaId(line);
  if (generatedAreaId && !IGNORED_SCENE_SOURCES.has(normalizeText(generatedAreaId))) {
    return { rawZoneName: generatedAreaId };
  }

  const namedZone = extractNamedZoneFromLine(line);
  if (namedZone && !IGNORED_SCENE_SOURCES.has(normalizeText(namedZone))) {
    return { rawZoneName: namedZone };
  }

  return null;
}

export function parseLevelUp(line: string): ParsedLevelUpEvent | null {
  const directMatch = firstMatch(logPatterns.events.levelUp, line);
  const directLevel = directMatch?.groups?.level ?? directMatch?.[1];
  const normalized = normalizeText(line);
  const fallbackMatch = normalized.match(/достигает\s+(\d{1,3})\s+уровня/) ?? normalized.match(/is now level\s+(\d{1,3})/);
  const rawLevel = directLevel ?? fallbackMatch?.[1];

  if (!rawLevel) {
    return null;
  }

  const level = Number(rawLevel);
  if (!Number.isFinite(level) || level < 1 || level > 100) {
    return null;
  }

  return { level };
}

export function parsePlayerDeath(line: string): { player: string } | null {
  const match = firstMatch(logPatterns.events.playerDeath, line);
  const player = match?.groups?.player ?? match?.[1];
  return player ? { player } : null;
}

export function parseClientRestart(line: string): boolean {
  return logPatterns.events.clientRestart.some((pattern) => makeRegex(pattern).test(line));
}

function includesAll(line: string, required: string[]): boolean {
  return required.every((phrase) => line.includes(normalizeText(phrase)));
}

function includesAny(line: string, candidates: string[]): string[] {
  return candidates.filter((phrase) => line.includes(normalizeText(phrase)));
}

function getNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function createReward(
  rewardKey: PermanentRewardKey,
  matchedKeywords: string[],
  line: string,
  options: { amount?: number; element?: string } = {}
): ParsedPermanentRewardEvent {
  return {
    rewardKey,
    matchedKeywords: [...new Set(matchedKeywords.filter(Boolean))],
    sourceText: normalizePoeMarkup(line),
    ...options
  };
}

function parseStandaloneRewardPhrase(line: string): ParsedPermanentRewardEvent | null {
  const candidate = stripNormalizedRewardPrefixes(normalizeText(line));
  if (!candidate) {
    return null;
  }

  let match = candidate.match(/^\+(\d+)%?\s+to\s+cold\s+resistance$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 10) {
      return createReward('coldResistance10', ['+10% to Cold Resistance', 'cold resistance'], line, {
        amount,
        element: 'cold'
      });
    }
  }

  match = candidate.match(/^\+(\d+)%?\s+to\s+lightning\s+resistance$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 10) {
      return createReward(
        'lightningResistance10',
        ['+10% to Lightning Resistance', 'lightning resistance'],
        line,
        {
          amount,
          element: 'lightning'
        }
      );
    }
  }

  match = candidate.match(/^\+(\d+)%?\s+to\s+fire\s+resistance$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 10) {
      return createReward('fireResistance10', ['+10% to Fire Resistance', 'fire resistance'], line, {
        amount,
        element: 'fire'
      });
    }
  }

  match = candidate.match(/^\+(\d+)%?\s+(?:to\s+)?all\s+elemental\s+resistances?$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount) {
      return createReward(
        'resistance5',
        ['all elemental resistance', '+5% to all elemental resistances'],
        line,
        {
          amount,
          element: 'all elemental'
        }
      );
    }
  }

  match = candidate.match(/^\+(\d+)\s+(?:to\s+)?spirit$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 30 || amount === 40) {
      return createReward(amount === 40 ? 'spirit40' : 'spirit30', [`+${amount} Spirit`, 'spirit'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^(\d+)%\s+increased\s+maximum\s+life$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 5) {
      return createReward('life5', [`${amount}% increased maximum Life`, 'maximum life'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^\+(\d+)\s+(?:to\s+)?maximum\s+life$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 20) {
      return createReward('life20', [`+${amount} maximum Life`, 'maximum life'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^(\d+)%\s+increased\s+maximum\s+mana$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount === 5) {
      return createReward('mana5', [`${amount}% increased maximum Mana`, 'maximum mana'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^\+(\d+)\s+(?:to\s+)?maximum\s+mana$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount) {
      return createReward('flatMana', [`+${amount} maximum Mana`, 'maximum mana'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^(?:(\d+)\s+)?weapon\s+set\s+passive\s+skill\s+points$/i);
  if (match) {
    const amount = getNumber(match[1]) ?? 2;
    if (amount) {
      return createReward(
        'weaponSetPassivePoints',
        [`${amount} Weapon Set Passive Skill Points`, 'weapon set passive skill points'],
        line,
        { amount }
      );
    }
  }

  match = candidate.match(/^(?:(\d+)\s+)?пассивн(?:ых|ые)\s+очк(?:а|и)\s+набора\s+оружия$/i);
  if (match) {
    const amount = getNumber(match[1]) ?? 2;
    if (amount) {
      return createReward(
        'weaponSetPassivePoints',
        [`${amount} passive weapon set points`, 'пассивных очка набора оружия'],
        line,
        { amount }
      );
    }
  }

  match = candidate.match(/^(?:(\d+)\s+)?passive\s+skill\s+points$/i);
  if (match) {
    const amount = getNumber(match[1]) ?? 2;
    if (amount) {
      return createReward('passivePoints', [`${amount} Passive Skill Points`, 'passive skill points'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^(?:(\d+)\s+)?пассивн(?:ых|ые)\s+очк(?:а|и)$/i);
  if (match) {
    const amount = getNumber(match[1]) ?? 2;
    if (amount) {
      return createReward('passivePoints', [`${amount} passive points`, 'пассивных очка'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^\+(\d+)\s+charm\s+slots?$/i);
  if (match) {
    return createReward('charmSlot', ['+1 Charm Slot', 'charm slot'], line, {
      amount: getNumber(match[1])
    });
  }

  match = candidate.match(/^(\d+)%\s+increased\s+life\s+recovery\s+from\s+flasks$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount) {
      return createReward(
        'flaskLifeRecovery',
        [`${amount}% increased Life Recovery from Flasks`, 'life recovery from flasks'],
        line,
        { amount }
      );
    }
  }

  match = candidate.match(/^(\d+)%\s+increased\s+stun\s+threshold$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount) {
      return createReward('stunThreshold', [`${amount}% increased Stun Threshold`, 'stun threshold'], line, {
        amount
      });
    }
  }

  match = candidate.match(/^(\d+)%\s+increased\s+elemental\s+ailment\s+threshold$/i);
  if (match) {
    const amount = getNumber(match[1]);
    if (amount) {
      return createReward(
        'elementalAilmentThreshold',
        [`${amount}% increased Elemental Ailment Threshold`, 'elemental ailment threshold'],
        line,
        { amount }
      );
    }
  }

  return null;
}

export function parsePermanentReward(line: string): ParsedPermanentRewardEvent | null {
  const normalized = normalizeText(line);
  const standaloneReward = parseStandaloneRewardPhrase(line);
  if (standaloneReward) {
    return standaloneReward;
  }
  const gotReward = normalized.includes('получил') || normalized.includes('получили') || normalized.includes('has received') || normalized.includes('have received') || normalized.includes('you have received');

  const resistanceMatch = firstMatch(logPatterns.events.rewardResistance, line);
  if (resistanceMatch?.groups) {
    const amount = getNumber(resistanceMatch.groups.amount);
    const element = normalizeText(resistanceMatch.groups.element ?? '');
    const elementLabel = element.includes('холод') || element.includes('cold')
      ? 'холоду'
      : element.includes('молн') || element.includes('lightning')
        ? 'молнии'
        : element.includes('огн') || element.includes('fire')
          ? 'огню'
          : element;

    if (amount === 10 && (element.includes('холод') || element.includes('cold'))) {
      return createReward('coldResistance10', ['+10% сопротивления холоду', 'сопротивлению холоду', 'холоду'], line, { amount, element: elementLabel });
    }

    if (amount === 10 && (element.includes('молн') || element.includes('lightning'))) {
      return createReward('lightningResistance10', ['+10% сопротивления молнии', 'сопротивлению молнии', 'молнии'], line, { amount, element: elementLabel });
    }

    if (amount === 10 && (element.includes('огн') || element.includes('fire'))) {
      return createReward('fireResistance10', ['+10% сопротивления огню', 'сопротивлению огню', 'огню'], line, { amount, element: elementLabel });
    }

    return createReward('resistance5', [`+${amount ?? ''}% сопротивления ${elementLabel}`.trim(), `сопротивлению ${elementLabel}`.trim()], line, { amount, element: elementLabel });
  }

  const resistanceBase = gotReward ? ['+10'] : ['получил', '+10'];
  const coldMatches = includesAny(normalized, [
    'сопротивлению холоду',
    'сопротивление холоду',
    'сопротивления холоду',
    'to cold resistance',
    'cold resistance'
  ]);
  if (includesAll(normalized, resistanceBase) && coldMatches.length > 0) {
    return createReward('coldResistance10', ['+10% сопротивления холоду', ...coldMatches], line, { amount: 10, element: 'холоду' });
  }

  const lightningMatches = includesAny(normalized, [
    'сопротивлению молнии',
    'сопротивление молнии',
    'сопротивления молнии',
    'to lightning resistance',
    'lightning resistance'
  ]);
  if (includesAll(normalized, resistanceBase) && lightningMatches.length > 0) {
    return createReward('lightningResistance10', ['+10% сопротивления молнии', ...lightningMatches], line, { amount: 10, element: 'молнии' });
  }

  const fireMatches = includesAny(normalized, [
    'сопротивлению огню',
    'сопротивление огню',
    'сопротивления огню',
    'to fire resistance',
    'fire resistance'
  ]);
  if (includesAll(normalized, resistanceBase) && fireMatches.length > 0) {
    return createReward('fireResistance10', ['+10% сопротивления огню', ...fireMatches], line, { amount: 10, element: 'огню' });
  }

  const allElementalResistanceMatch = line.match(/\+(\d+)%.*сопротивлени[яю]\s+всем.*(?:\[ElementalDamage\|стихиям\]|стихиям|стихиям?)/i);
  if (allElementalResistanceMatch || (
    normalized.includes('получил') &&
    normalized.includes('+5') &&
    (normalized.includes('сопротивлению всем') || normalized.includes('сопротивления всем')) &&
    (normalized.includes('стихия') || normalized.includes('elemental'))
  )) {
    const amount = getNumber(allElementalResistanceMatch?.[1]) ?? 5;
    return createReward('resistance5', [
      `+${amount}% ко всем сопротивлениям стихий`,
      'сопротивлению всем стихиям',
      'стихиям'
    ], line, { amount, element: 'всем стихиям' });
  }

  const spiritMatch = firstMatch(logPatterns.events.rewardSpirit, line);
  const spiritFallbackMatch =
    gotReward ? (normalized.match(/\+(\d+)\s+к\s+духу/) ?? normalized.match(/\+(\d+)\s+(?:to\s+)?spirit/)) : null;
  if (spiritMatch?.groups || spiritFallbackMatch) {
    const amount = getNumber(spiritMatch?.groups?.amount ?? spiritFallbackMatch?.[1]) ?? 30;
    return createReward(amount >= 40 ? 'spirit40' : 'spirit30', [`+${amount} духа`, 'дух'], line, { amount });
  }

  const lifePercentMatch = firstMatch(logPatterns.events.rewardLifePercent, line);
  const lifePercentFallbackMatch =
    gotReward ? (normalized.match(/\+(\d+)%\s+к\s+максимуму\s+здоровья/) ?? normalized.match(/(\d+)%\s+increased\s+maximum\s+life/)) : null;
  if (lifePercentMatch?.groups || lifePercentFallbackMatch) {
    const amount = getNumber(lifePercentMatch?.groups?.amount ?? lifePercentFallbackMatch?.[1]) ?? 5;
    return createReward('life5', [`+${amount}% к максимуму здоровья`, 'maximum life'], line, { amount });
  }

  const lifeMatch = firstMatch(logPatterns.events.rewardLife, line);
  const lifeFallbackMatch =
    gotReward ? (normalized.match(/\+(\d+)\s+к\s+максимуму\s+здоровья/) ?? normalized.match(/\+(\d+)\s+to\s+maximum\s+life/)) : null;
  if (lifeMatch?.groups || lifeFallbackMatch) {
    const amount = getNumber(lifeMatch?.groups?.amount ?? lifeFallbackMatch?.[1]) ?? 20;
    return createReward('life20', [`+${amount} максимум здоровья`, 'максимум здоровья'], line, { amount });
  }

  const manaMatch = firstMatch(logPatterns.events.rewardManaPercent, line);
  const manaFallbackMatch =
    gotReward ? (normalized.match(/\+(\d+)%\s+к\s+максимуму\s+маны/) ?? normalized.match(/(\d+)%\s+increased\s+maximum\s+mana/)) : null;
  if (manaMatch?.groups || manaFallbackMatch) {
    const amount = getNumber(manaMatch?.groups?.amount ?? manaFallbackMatch?.[1]) ?? 5;
    return createReward('mana5', [`+${amount}% максимум маны`, 'максимум маны'], line, { amount });
  }

  const passiveMatch = firstMatch(logPatterns.events.rewardPassivePoints, line);
  if (passiveMatch?.groups || normalized.includes('вы получили очков пассивных умений') || normalized.includes('you have received') && normalized.includes('passive skill points') && !normalized.includes('weapon set')) {
    const amount = getNumber(passiveMatch?.groups?.points) ?? 2;
    return createReward('passivePoints', [`${amount} пассивных очка`, 'пассивные очки', 'пассивных умений'], line, { amount });
  }

  const weaponSetMatch = firstMatch(logPatterns.events.rewardWeaponSetPoints, line);
  if (weaponSetMatch?.groups || normalized.includes('очк') && normalized.includes('для набора оружия') || normalized.includes('weapon set passive skill points')) {
    const amount = getNumber(weaponSetMatch?.groups?.points) ?? 2;
    return createReward('weaponSetPassivePoints', [`${amount} очка для набора оружия`, 'набор оружия'], line, { amount });
  }

  if (firstMatch(logPatterns.events.rewardCharm, line) || (gotReward && normalized.includes('charm'))) {
    if (normalized.includes('+1') || normalized.includes('ячей') || normalized.includes('slot')) {
      return createReward('charmSlot', ['+1 ячейка оберегов', 'charm slot'], line);
    }

    return createReward('charmChargeGain', ['зарядов оберегов', 'charm charges'], line);
  }

  const flaskFallbackMatch = normalized.match(/(\d+)%\s+increased\s+life\s+recovery\s+from\s+flasks/);
  if (flaskFallbackMatch) {
    const amount = getNumber(flaskFallbackMatch[1]) ?? 30;
    return createReward(
      'flaskLifeRecovery',
      [`${amount}% increased Life Recovery from Flasks`, 'life recovery from flasks'],
      line,
      { amount }
    );
  }

  const flaskMatch = firstMatch(logPatterns.events.rewardFlaskRecovery, line);
  if (flaskMatch?.groups || normalized.includes('восстановления здоровья') && normalized.includes('флакон') || normalized.includes('life recovery') && normalized.includes('flask')) {
    const amount = getNumber(flaskMatch?.groups?.amount) ?? 30;
    return createReward('flaskLifeRecovery', [`${amount}% восстановление здоровья от флаконов`, 'флаконы', 'восстановление здоровья'], line, { amount });
  }

  const stunFallbackMatch = normalized.match(/(\d+)%\s+increased\s+stun\s+threshold/);
  if (stunFallbackMatch) {
    const amount = getNumber(stunFallbackMatch[1]) ?? 25;
    return createReward('stunThreshold', [`${amount}% increased Stun Threshold`, 'stun threshold'], line, {
      amount
    });
  }

  const elementalAilmentMatch = firstMatch(logPatterns.events.rewardElementalAilmentThreshold, line);
  const elementalAilmentFallbackMatch = normalized.match(/(\d+)%\s+increased\s+elemental\s+ailment\s+threshold/);
  if (elementalAilmentMatch?.groups || elementalAilmentFallbackMatch) {
    const amount = getNumber(elementalAilmentMatch?.groups?.amount ?? elementalAilmentFallbackMatch?.[1]) ?? 30;
    return createReward(
      'elementalAilmentThreshold',
      [`${amount}% increased Elemental Ailment Threshold`, 'elemental ailment threshold'],
      line,
      { amount }
    );
  }

  const stunMatch = firstMatch(logPatterns.events.rewardStunThreshold, line);
  if (stunMatch?.groups || normalized.includes('порога оглушения') || normalized.includes('stun threshold')) {
    const amount = getNumber(stunMatch?.groups?.amount) ?? 25;
    return createReward('stunThreshold', [`${amount}% порог оглушения`, 'порог оглушения'], line, { amount });
  }

  return null;
}

export function parseLogLine(line: string): ParsedLogEvent {
  if (parseClientRestart(line)) {
    return { type: 'client_restart' };
  }

  const scene = parseSceneSource(line);
  if (scene) {
    return { type: 'scene_source', scene };
  }

  const level = parseLevelUp(line);
  if (level) {
    return { type: 'level_up', level };
  }

  const reward = parsePermanentReward(line);
  if (reward) {
    return { type: 'permanent_reward', reward };
  }

  const death = parsePlayerDeath(line);
  if (death) {
    return { type: 'player_death', player: death.player };
  }

  return { type: 'none' };
}
