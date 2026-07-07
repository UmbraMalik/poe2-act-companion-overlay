import type {
  ChecklistDetectedBy,
  ChecklistItemDefinition,
  ChecklistItemProgress,
  ChecklistItemState,
  ChecklistItemType,
  ChecklistViewItem,
  CurrentZoneState,
  GuideEntry,
  GuideZoneProgress
} from './types';

interface KeywordGroup {
  phrases: string[];
  type: ChecklistItemType;
  required: boolean;
}

export const GENERAL_LOG_REWARD_KEYWORDS = [
  'сопротивление холоду',
  'сопротивления холоду',
  'сопротивлению холоду',
  '+10% к сопротивлению холоду',
  'cold resistance',
  '+10% to cold resistance',
  'сопротивление молнии',
  'сопротивления молнии',
  'сопротивлению молнии',
  '+10% к сопротивлению молнии',
  'lightning resistance',
  '+10% to lightning resistance',
  'сопротивление огню',
  'сопротивления огню',
  'сопротивлению огню',
  '+10% к сопротивлению огню',
  'fire resistance',
  '+10% to fire resistance',
  'дух',
  'spirit',
  'пассив',
  'пассивных',
  'пассивное умение',
  'passive skill point',
  'weapon set passive skill point',
  'максимум здоровья',
  'maximum life',
  'максимум маны',
  'maximum mana',
  'сфера ювелира',
  'сфера царей',
  'сфера алхимии',
  'экзальт',
  'руна'
] as const;

const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    phrases: [
      'сопротивление холоду',
      'сопротивления холоду',
      'сопротивлению холоду',
      '+10% к сопротивлению холоду'
    ],
    type: 'resistance',
    required: true
  },
  {
    phrases: [
      'сопротивление молнии',
      'сопротивления молнии',
      'сопротивлению молнии',
      '+10% к сопротивлению молнии'
    ],
    type: 'resistance',
    required: true
  },
  {
    phrases: [
      'сопротивление огню',
      'сопротивления огню',
      'сопротивлению огню',
      '+10% к сопротивлению огню'
    ],
    type: 'resistance',
    required: true
  },
  {
    phrases: ['дух', 'камень духа'],
    type: 'spirit',
    required: true
  },
  {
    phrases: ['пассив', 'пассивных', 'пассивное умение'],
    type: 'passive',
    required: true
  },
  {
    phrases: ['максимум здоровья'],
    type: 'life',
    required: true
  },
  {
    phrases: ['максимум маны'],
    type: 'mana',
    required: true
  },
  {
    phrases: ['сфера ювелира', 'сфера царей', 'сфера алхимии', 'экзальт'],
    type: 'currency',
    required: false
  },
  {
    phrases: ['руна'],
    type: 'crafting',
    required: false
  }
];

const QUEST_ITEM_HINTS = [
  'квестовый предмет',
  'письмо',
  'сердце',
  'реликв',
  'ядро души',
  'ключ',
  'горн',
  'жемчужин'
];

const CRAFTING_HINTS = [
  'верстак',
  'руна',
  'точиль',
  'обрывки брони',
  'сфера ремесленника',
  'инструменты кузнеца',
  'кузнечные инструменты'
];

const MISSED_TYPES = new Set<ChecklistItemType>([
  'permanent_reward',
  'passive',
  'resistance',
  'spirit',
  'life',
  'mana'
]);

export function normalizeMatchText(input: string): string {
  return String(input ?? '')
    .replace(/\[[^\]|]+\|([^\]]+)\]/g, '$1')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/['".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemMatchToken(token: string): string {
  return token
    .replace(/[ьъ]$/g, '')
    .replace(
      /(иями|ями|ами|ого|ему|ому|его|ыми|ими|иях|ах|ях|ов|ев|ий|ый|ой|ая|яя|ое|ее|ую|юю|ом|ем|ам|ям|у|ю|а|я|е|и|ы|о)$/g,
      ''
    );
}

function getMatchTokens(input: string): string[] {
  return normalizeMatchText(input)
    .split(' ')
    .map((token) => stemMatchToken(token))
    .filter((token) => token.length >= 3);
}

export function hasKeywordSignal(haystack: string, keyword: string): boolean {
  const normalizedHaystack = normalizeMatchText(haystack);
  const normalizedKeyword = normalizeMatchText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (
    normalizedHaystack.includes(normalizedKeyword) ||
    normalizedKeyword.includes(normalizedHaystack)
  ) {
    return true;
  }

  const haystackTokens = new Set(getMatchTokens(normalizedHaystack));
  const keywordTokens = getMatchTokens(normalizedKeyword);

  return keywordTokens.length > 0
    ? keywordTokens.every((token) => haystackTokens.has(token))
    : false;
}

function createChecklistItemId(
  zoneId: string,
  bucket: string,
  index: number,
  text: string
): string {
  const slug = normalizeMatchText(text)
    .replace(/[^a-z0-9а-я]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

  return `${zoneId}_${bucket}_${index + 1}${slug ? `_${slug}` : ''}`;
}

function inferChecklistItemType(text: string): {
  type: ChecklistItemType;
  required: boolean;
  phrases: string[];
} {
  const normalizedText = normalizeMatchText(text);
  const matchingGroups = KEYWORD_GROUPS.filter((group) =>
    group.phrases.some((phrase) => hasKeywordSignal(normalizedText, phrase))
  );

  if (matchingGroups.length > 0) {
    const primary = matchingGroups[0]!;
    return {
      type:
        primary.type === 'currency' || primary.type === 'crafting'
          ? primary.type
          : primary.type === 'resistance' ||
              primary.type === 'spirit' ||
              primary.type === 'passive' ||
              primary.type === 'life' ||
              primary.type === 'mana'
            ? primary.type
            : 'permanent_reward',
      required: primary.required,
      phrases: matchingGroups.flatMap((group) => group.phrases)
    };
  }

  if (
    normalizedText.startsWith('убить ') ||
    normalizedText.includes(' убить ') ||
    normalizedText.includes('босса')
  ) {
    return {
      type: 'boss',
      required: true,
      phrases: []
    };
  }

  if (QUEST_ITEM_HINTS.some((hint) => normalizedText.includes(hint))) {
    return {
      type: 'reward',
      required: true,
      phrases: []
    };
  }

  if (CRAFTING_HINTS.some((hint) => normalizedText.includes(hint))) {
    return {
      type: 'crafting',
      required: false,
      phrases: CRAFTING_HINTS
    };
  }

  return {
    type: 'route_task',
    required: false,
    phrases: []
  };
}

function createChecklistItem(
  zoneId: string,
  bucket: string,
  index: number,
  text: string,
  guideKeywords: string[],
  forceType?: ChecklistItemType,
  forceRequired?: boolean
): ChecklistItemDefinition {
  const inferred = inferChecklistItemType(text);
  const autoCompleteKeywords = new Set<string>([text, ...inferred.phrases]);

  for (const keyword of guideKeywords) {
    if (hasKeywordSignal(text, keyword) || hasKeywordSignal(keyword, text)) {
      autoCompleteKeywords.add(keyword);
    }
  }

  return {
    id: createChecklistItemId(zoneId, bucket, index, text),
    text,
    type: forceType ?? inferred.type,
    required: forceRequired ?? inferred.required,
    autoCompleteKeywords: [...autoCompleteKeywords].filter(Boolean),
    linkedChecklistItemIds: []
  };
}

export function buildChecklistDefinition(guide: GuideEntry): ChecklistItemDefinition[] {
  const explicitChecklist = guide.checklist ?? [];
  const guideKeywords = Array.isArray(guide.keywords_done) ? guide.keywords_done : [];

  if (explicitChecklist.length > 0) {
    return explicitChecklist.map((item, index) => {
      const inferred = inferChecklistItemType(item.text);
      const autoCompleteKeywords = new Set<string>([
        item.text,
        ...(item.autoCompleteKeywords ?? []),
        ...inferred.phrases
      ]);

      for (const keyword of guideKeywords) {
        if (
          hasKeywordSignal(item.text, keyword) ||
          hasKeywordSignal(keyword, item.text)
        ) {
          autoCompleteKeywords.add(keyword);
        }
      }

      return {
        id:
          item.id ||
          createChecklistItemId(guide.id, 'checklist', index, item.text),
        text: item.text,
        type: item.type ?? inferred.type,
        required: item.required ?? inferred.required,
        autoCompleteKeywords: [...autoCompleteKeywords].filter(Boolean),
        autoCompleteMode: item.autoCompleteMode,
        linkedChecklistItemIds: item.linkedChecklistItemIds ?? []
      };
    });
  }

  const items: ChecklistItemDefinition[] = [];
  const seenTexts = new Set<string>();

  const pushUniqueItem = (
    bucket: string,
    index: number,
    text: string,
    forceType?: ChecklistItemType,
    forceRequired?: boolean
  ) => {
    const normalizedText = normalizeMatchText(text);
    const alreadyRepresented = items.some(
      (item) =>
        hasKeywordSignal(item.text, text) || hasKeywordSignal(text, item.text)
    );

    if (!normalizedText || seenTexts.has(normalizedText) || alreadyRepresented) {
      return;
    }

    seenTexts.add(normalizedText);
    items.push(
      createChecklistItem(
        guide.id,
        bucket,
        index,
        text,
        guideKeywords,
        forceType,
        forceRequired
      )
    );
  };

  guide.priority.forEach((text, index) => {
    const inferred = inferChecklistItemType(text);
    pushUniqueItem(
      'priority',
      index,
      text,
      inferred.type === 'route_task' ? 'route_task' : inferred.type,
      inferred.required
    );
  });

  guide.rewards.forEach((text, index) => {
    const inferred = inferChecklistItemType(text);
    pushUniqueItem(
      'reward',
      index,
      text,
      inferred.type === 'route_task'
        ? 'reward'
        : inferred.required
          ? 'permanent_reward'
          : inferred.type,
      inferred.required
    );
  });

  guide.important.forEach((text, index) => {
    const inferred = inferChecklistItemType(text);
    if (!inferred.required) {
      return;
    }

    pushUniqueItem(
      'important',
      index,
      text,
      inferred.type === 'route_task' || inferred.type === 'reward'
        ? 'permanent_reward'
        : inferred.type,
      true
    );
  });

  guideKeywords.forEach((text, index) => {
    const inferred = inferChecklistItemType(text);
    pushUniqueItem(
      'keyword',
      index,
      text,
      inferred.type === 'route_task' ? 'reward' : inferred.type,
      inferred.required
    );
  });

  return items;
}

export function shouldItemBeMissed(item: ChecklistItemDefinition): boolean {
  return MISSED_TYPES.has(item.type);
}

export function getChecklistItemProgress(
  zoneProgress: GuideZoneProgress | undefined,
  itemId: string
): ChecklistItemProgress | null {
  return zoneProgress?.itemStates[itemId] ?? null;
}

function resolveStoredState(
  progress: ChecklistItemProgress | null
): ChecklistItemState | null {
  if (!progress) {
    return null;
  }

  // The overlay stays a reminder, not a punishment system:
  // show only soft positive states from real/manual events, never missed warnings.
  if (progress.state === 'done' || progress.state === 'likely_done') {
    return progress.state;
  }

  return null;
}

export function buildChecklistViewItems(
  guide: GuideEntry | null,
  zoneProgress: GuideZoneProgress | undefined
): ChecklistViewItem[] {
  if (!guide) {
    return [];
  }

  const checklist = buildChecklistDefinition(guide);
  const storedStates = checklist.map((item) =>
    resolveStoredState(getChecklistItemProgress(zoneProgress, item.id))
  );
  const firstPendingIndex = storedStates.findIndex((state) => state === null);

  return checklist.map((item, index) => {
    const progress = getChecklistItemProgress(zoneProgress, item.id);
    const storedState = storedStates[index];
    const displayState =
      storedState ??
      (index === firstPendingIndex ? 'current' : 'pending');

    return {
      ...item,
      displayState,
      detectedBy: progress?.detectedBy ?? null,
      timestamp: progress?.timestamp ?? null,
      originalIndex: index
    };
  });
}

export function sortChecklistViewItems(items: ChecklistViewItem[]): ChecklistViewItem[] {
  return [...items].sort((left, right) => {
    if (left.displayState === 'current' && right.displayState !== 'current') {
      return -1;
    }

    if (right.displayState === 'current' && left.displayState !== 'current') {
      return 1;
    }

    return left.originalIndex - right.originalIndex;
  });
}


export function matchChecklistItemIdsFromLine(
  line: string,
  guide: GuideEntry | null
): { itemIds: string[]; matchedKeywords: string[] } {
  if (!guide) {
    return { itemIds: [], matchedKeywords: [] };
  }

  const checklist = buildChecklistDefinition(guide);
  const matchedKeywords = new Set<string>();
  const itemIds = checklist
    .filter((item) => {
      const candidates = [item.text, ...item.autoCompleteKeywords];
      const matches = candidates.filter((keyword) => hasKeywordSignal(line, keyword));

      for (const match of matches) {
        matchedKeywords.add(match);
      }

      return matches.length > 0;
    })
    .map((item) => item.id);

  return {
    itemIds: [...new Set(itemIds)],
    matchedKeywords: [...matchedKeywords]
  };
}


export function matchChecklistItemIdsFromKeywords(
  guide: GuideEntry | null,
  keywords: string[]
): { itemIds: string[]; matchedKeywords: string[] } {
  if (!guide || keywords.length === 0) {
    return { itemIds: [], matchedKeywords: [] };
  }

  const checklist = buildChecklistDefinition(guide);
  const matchedKeywords = new Set<string>();
  const itemIds = checklist
    .filter((item) => {
      const candidates = [item.text, ...item.autoCompleteKeywords];
      const matches = keywords.filter((keyword) =>
        candidates.some(
          (candidate) =>
            hasKeywordSignal(candidate, keyword) || hasKeywordSignal(keyword, candidate)
        )
      );

      for (const match of matches) {
        matchedKeywords.add(match);
      }

      return matches.length > 0;
    })
    .map((item) => item.id);

  return {
    itemIds: [...new Set(itemIds)],
    matchedKeywords: [...matchedKeywords]
  };
}


export function summarizeMissedWarning(items: string[]): string {
  return items.join(', ');
}

export function getChecklistBadges(guide: GuideEntry | null): string[] {
  if (!guide) {
    return [];
  }

  const badges: string[] = [];

  if (guide.skip.length > 0) {
    badges.push('есть skip');
  }

  if (guide.important.length > 0) {
    badges.push('есть важное');
  }

  if (guide.after.length > 0) {
    badges.push('есть после');
  }

  return badges;
}

export function getCurrentChecklistItem(
  guide: GuideEntry | null,
  zoneProgress: GuideZoneProgress | undefined
): ChecklistViewItem | null {
  return (
    buildChecklistViewItems(guide, zoneProgress).find(
      (item) => item.displayState === 'current'
    ) ?? null
  );
}

export function getMissableUncheckedItems(
  _guide: GuideEntry | null,
  _zoneProgress: GuideZoneProgress | undefined
): ChecklistItemDefinition[] {
  // Missed reward warnings were too noisy and unreliable for this workflow.
  // Keep the guide as a reminder, not as a pass/fail tracker.
  return [];
}


export function getChecklistStateForZone(
  guide: GuideEntry | null,
  zoneProgress: GuideZoneProgress | undefined,
  itemId: string
): ChecklistItemState {
  return (
    buildChecklistViewItems(guide, zoneProgress).find((item) => item.id === itemId)
      ?.displayState ?? 'pending'
  );
}

export function getVisibleHudChecklist(
  guide: GuideEntry | null,
  zoneProgress: GuideZoneProgress | undefined,
  limit = 4
): { visibleItems: ChecklistViewItem[]; hiddenCount: number; totalCount: number } {
  const sortedItems = sortChecklistViewItems(
    buildChecklistViewItems(guide, zoneProgress)
  );
  const visibleItems = sortedItems.slice(0, limit);

  return {
    visibleItems,
    hiddenCount: Math.max(0, sortedItems.length - visibleItems.length),
    totalCount: sortedItems.length
  };
}

export function findZoneProgressForCurrentZone(
  currentZone: CurrentZoneState,
  zoneProgress: Record<string, GuideZoneProgress>
): GuideZoneProgress | undefined {
  const guideId = currentZone.guide?.id;
  return guideId ? zoneProgress[guideId] : undefined;
}
