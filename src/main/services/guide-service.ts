import { existsSync, readFileSync } from 'node:fs';
import type {
  GuideDataFile,
  GuideEntry,
  LevelReminder,
  PowerSpike,
  ZoneMatcherReason
} from '../../shared/types';
import { extractGeneratedAreaId, extractNamedZoneFromLine } from './log-parser';
import { resolveRuntimePath } from './runtime-paths';

export type ZoneEventSource = 'internal-area-id' | 'entered-zone-name';

export interface ExtractedZoneMatch {
  rawLine: string;
  rawZoneName: string;
  extractedInternalAreaId: string | null;
  extractedZoneName: string | null;
  normalizedZoneName: string | null;
  source: ZoneEventSource;
  guide: GuideEntry | null;
  matcherReason: ZoneMatcherReason;
}

type GuideEntryWithAreaIds = GuideEntry & {
  area_ids?: string[];
  areaIds?: string[];
};

interface InternalAreaAliasesFile {
  knownTownAreaIds?: string[];
}

interface InternalAreaLookupResult {
  normalizedInternalAreaId: string | null;
  mappedValue: string | null;
  guide: GuideEntry | null;
  mappingHit: boolean;
}

interface ZoneNameMatchResult {
  guide: GuideEntry | null;
  matcherReason: ZoneMatcherReason;
  normalizedZoneName: string | null;
}

function normalizeText(input: string): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/['".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInternalAreaId(input: string | null | undefined): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function stripZoneEventPrefixes(input: string): string {
  return String(input ?? '')
    .trim()
    .replace(/^(?:you have entered|entering area)\s*:?\s*/i, '')
    .replace(/^(?:Р’С‹ РІРѕС€Р»Рё РІ РѕР±Р»Р°СЃС‚СЊ|Р’С‹ РІРѕС€Р»Рё|Р’С…РѕРґ РІ РѕР±Р»Р°СЃС‚СЊ)\s*:?\s*/i, '')
    .trim();
}

function buildZoneLookupCandidates(zoneName: string | null | undefined): string[] {
  const normalizedBase = normalizeText(stripZoneEventPrefixes(String(zoneName ?? '')));
  if (!normalizedBase) {
    return [];
  }

  return [normalizedBase];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((entry) => String(entry ?? '').trim()).filter(Boolean))];
}

function getEntryAreaIds(entry: GuideEntryWithAreaIds): string[] {
  return normalizeStringArray(entry.area_ids ?? entry.areaIds ?? []);
}

function entryAcceptsAreaId(
  entry: GuideEntry | null | undefined,
  areaId: string | null | undefined
): boolean {
  if (!entry) {
    return false;
  }

  const normalizedAreaId = normalizeInternalAreaId(areaId);
  const entryAreaIds = getEntryAreaIds(entry as GuideEntryWithAreaIds).map((value) =>
    normalizeInternalAreaId(value)
  );
  return entryAreaIds.length === 0 || entryAreaIds.includes(normalizedAreaId);
}

function asArray(value: unknown): GuideEntry[] {
  if (Array.isArray(value)) {
    return value as GuideEntry[];
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.zones, obj.entries, obj.guide, obj.acts];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate as GuideEntry[];
      }
    }
  }

  return [];
}

function asGuideDataFile(value: unknown): GuideDataFile {
  if (Array.isArray(value)) {
    return {
      zones: value as GuideEntry[],
      global_reminders: {
        vendor_checkpoints: []
      }
    };
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return {
      zones: asArray(value),
      global_reminders: {
        vendor_checkpoints: Array.isArray(obj.global_reminders)
          ? []
          : Array.isArray(
                (obj.global_reminders as Record<string, unknown> | undefined)
                  ?.vendor_checkpoints
              )
            ? (((obj.global_reminders as Record<string, unknown>).vendor_checkpoints ??
                []) as LevelReminder[])
            : []
      }
    };
  }

  return {
    zones: [],
    global_reminders: {
      vendor_checkpoints: []
    }
  };
}

function normalizeEntry(
  entry: GuideEntryWithAreaIds,
  index: number
): GuideEntryWithAreaIds {
  const zoneRu = entry.zone_ru ?? entry.zone_en ?? `Зона ${index + 1}`;
  const zoneEn = entry.zone_en ?? entry.zone_ru ?? `zone_${index + 1}`;

  return {
    ...entry,
    id: entry.id ?? normalizeText(zoneEn || zoneRu).replace(/\s+/g, '_'),
    zone_ru: zoneRu,
    zone_en: zoneEn,
    recommended_level: entry.recommended_level ?? null,
    recommended_level_label:
      entry.recommended_level_label ??
      (entry.recommended_level == null ? '?' : String(entry.recommended_level)),
    is_good_xp_zone: Boolean(entry.is_good_xp_zone),
    priority: Array.isArray(entry.priority) ? entry.priority : [],
    rewards: Array.isArray(entry.rewards) ? entry.rewards : [],
    skip: Array.isArray(entry.skip) ? entry.skip : [],
    important: Array.isArray(entry.important) ? entry.important : [],
    after: Array.isArray(entry.after) ? entry.after : [],
    boss_tips: Array.isArray(entry.boss_tips) ? entry.boss_tips : [],
    xp_notes: Array.isArray(entry.xp_notes) ? entry.xp_notes : [],
    crafting_tips: Array.isArray(entry.crafting_tips) ? entry.crafting_tips : [],
    details: entry.details ?? [],
    next_zone_ru: entry.next_zone_ru ?? '',
    keywords_done: Array.isArray(entry.keywords_done) ? entry.keywords_done : [],
    checklist: Array.isArray(entry.checklist) ? entry.checklist : [],
    aliases: normalizeStringArray(entry.aliases),
    aliases_en: normalizeStringArray(entry.aliases_en),
    zone_aliases: normalizeStringArray(entry.zone_aliases),
    area_ids: getEntryAreaIds(entry)
  } as GuideEntryWithAreaIds;
}

export class GuideService {
  private entries: GuideEntry[] = [];
  private powerSpikes: PowerSpike[] = [];
  private source: GuideDataFile = {
    zones: [],
    global_reminders: {
      vendor_checkpoints: []
    }
  };
  private loadedAt: string | null = null;
  private idMap = new Map<string, GuideEntry>();
  private zoneRuMap = new Map<string, GuideEntry>();
  private zoneEnMap = new Map<string, GuideEntry>();
  private aliasMap = new Map<string, GuideEntry>();
  private internalAreaMap = new Map<string, GuideEntry>();
  private internalAreaTargetMap = new Map<string, string>();
  private knownTownAreaIds = new Set<string>();
  private vendorCheckpointMap = new Map<string, LevelReminder>();
  private vendorCheckpointByLevel = new Map<number, LevelReminder>();

  load(): GuideEntry[] {
    const guidePath = resolveRuntimePath('src', 'data', 'guide.json');
    const powerSpikesPath = resolveRuntimePath('src', 'data', 'power-spikes.json');
    const internalAreaAliasesPath = resolveRuntimePath('src', 'data', 'internal-area-aliases.en.json');
    if (!existsSync(guidePath)) {
      throw new Error(`Guide not found at ${guidePath}`);
    }

    const raw = readFileSync(guidePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    const source = asGuideDataFile(parsed);
    const entries = source.zones.map((entry, index) => normalizeEntry(entry, index));
    const vendorCheckpoints = (source.global_reminders?.vendor_checkpoints ?? [])
      .filter((entry): entry is LevelReminder => Boolean(entry?.id))
      .map((entry) => ({
        id: entry.id,
        level: Number(entry.level) || 0,
        type: entry.type ?? 'vendor',
        title: entry.title ?? `Проверь торговцев на ${entry.level} уровне`,
        items: Array.isArray(entry.items) ? entry.items.filter(Boolean) : []
      }));

    this.source = {
      zones: entries,
      global_reminders: {
        vendor_checkpoints: vendorCheckpoints
      }
    };
    this.entries = entries;
    this.loadedAt = new Date().toISOString();
    this.idMap = new Map(entries.map((entry) => [entry.id, entry]));
    this.zoneRuMap = new Map(entries.map((entry) => [normalizeText(entry.zone_ru), entry]));
    this.zoneEnMap = new Map(entries.map((entry) => [normalizeText(entry.zone_en), entry]));
    this.aliasMap = new Map();
    this.internalAreaMap = new Map();
    this.internalAreaTargetMap = new Map();
    this.knownTownAreaIds = new Set();

    for (const entry of entries) {
      for (const alias of [
        ...(entry.aliases ?? []),
        ...(entry.aliases_en ?? []),
        ...(entry.zone_aliases ?? [])
      ]) {
        const normalizedAlias = normalizeText(alias);
        if (normalizedAlias) {
          this.aliasMap.set(normalizedAlias, entry);
        }
      }

      for (const areaId of getEntryAreaIds(entry as GuideEntryWithAreaIds)) {
        const normalizedAreaId = normalizeInternalAreaId(areaId);
        if (!normalizedAreaId) {
          continue;
        }

        const previousGuideId = this.internalAreaTargetMap.get(normalizedAreaId);
        if (previousGuideId && previousGuideId !== entry.id) {
          console.warn('[GuideService] Duplicate area_id mapping in guide.json', {
            areaId,
            normalizedAreaId,
            previousGuideId,
            nextGuideId: entry.id
          });
        }

        this.internalAreaTargetMap.set(normalizedAreaId, entry.id);
        this.internalAreaMap.set(normalizedAreaId, entry);
      }
    }

    if (existsSync(internalAreaAliasesPath)) {
      const aliases = JSON.parse(readFileSync(internalAreaAliasesPath, 'utf8')) as InternalAreaAliasesFile;
      for (const townAreaId of aliases.knownTownAreaIds ?? []) {
        const normalizedTownAreaId = normalizeInternalAreaId(townAreaId);
        if (normalizedTownAreaId) {
          this.knownTownAreaIds.add(normalizedTownAreaId);
        }
      }
    }

    this.vendorCheckpointMap = new Map(vendorCheckpoints.map((entry) => [entry.id, entry]));
    this.vendorCheckpointByLevel = new Map(
      vendorCheckpoints.map((entry) => [entry.level, entry])
    );
    this.powerSpikes = existsSync(powerSpikesPath)
      ? ((JSON.parse(readFileSync(powerSpikesPath, 'utf8')) as unknown[]) ?? [])
          .filter((entry): entry is PowerSpike => Boolean((entry as PowerSpike | null)?.id))
          .map((entry) => ({
            id: entry.id,
            level: Number(entry.level) || 0,
            title: entry.title ?? `Скачок силы на ${entry.level} уровне`,
            items: Array.isArray(entry.items) ? entry.items.filter(Boolean) : [],
            profiles: Array.isArray(entry.profiles) ? entry.profiles.filter(Boolean) : undefined
          }))
      : [];

    return this.getAll();
  }

  getAll(): GuideEntry[] {
    return [...this.entries];
  }

  getLoadedAt(): string | null {
    return this.loadedAt;
  }

  getSource(): GuideDataFile {
    return {
      zones: this.getAll(),
      global_reminders: {
        vendor_checkpoints: this.getVendorCheckpoints()
      }
    };
  }

  getVendorCheckpoints(): LevelReminder[] {
    return [...this.vendorCheckpointMap.values()];
  }

  getPowerSpikes(): PowerSpike[] {
    return [...this.powerSpikes];
  }

  findVendorCheckpointById(id: string | null | undefined): LevelReminder | null {
    if (!id) {
      return null;
    }

    return this.vendorCheckpointMap.get(id) ?? null;
  }

  findVendorCheckpointByLevel(level: number | null | undefined): LevelReminder | null {
    if (typeof level !== 'number' || !Number.isFinite(level)) {
      return null;
    }

    return this.vendorCheckpointByLevel.get(level) ?? null;
  }

  findById(id: string | null | undefined): GuideEntry | null {
    if (!id) {
      return null;
    }

    return this.idMap.get(id) ?? null;
  }

  findByZoneName(zoneName: string | null | undefined): GuideEntry | null {
    return this.matchByZoneName(zoneName).guide;
  }

  private resolveGuideReference(reference: string | null | undefined): GuideEntry | null {
    const trimmedReference = String(reference ?? '').trim();
    if (!trimmedReference) {
      return null;
    }

    const directIdMatch =
      this.idMap.get(trimmedReference) ?? this.idMap.get(trimmedReference.toLowerCase());
    if (directIdMatch) {
      return directIdMatch;
    }

    const normalizedReference = normalizeText(trimmedReference);
    return (
      this.zoneRuMap.get(normalizedReference) ??
      this.zoneEnMap.get(normalizedReference) ??
      this.aliasMap.get(normalizedReference) ??
      null
    );
  }

  private resolveInternalAreaGuide(areaId: string | null | undefined): InternalAreaLookupResult {
    const normalizedInternalAreaId = normalizeInternalAreaId(areaId);
    if (!normalizedInternalAreaId) {
      return {
        normalizedInternalAreaId: null,
        mappedValue: null,
        guide: null,
        mappingHit: false
      };
    }

    const guide = this.internalAreaMap.get(normalizedInternalAreaId) ?? null;
    const mappedValue =
      this.internalAreaTargetMap.get(normalizedInternalAreaId) ?? guide?.id ?? null;
    return {
      normalizedInternalAreaId,
      mappedValue,
      guide,
      mappingHit: mappedValue !== null
    };
  }

  private logInternalAreaLookup(
    extractedInternalAreaId: string,
    result: InternalAreaLookupResult
  ): void {
    console.info('[GuideService] Internal area lookup', {
      extractedInternalAreaId,
      normalizedInternalAreaId: result.normalizedInternalAreaId,
      mappingHit: result.mappingHit,
      mappingMiss: !result.mappingHit,
      mappedValue: result.mappedValue,
      matchedGuideZoneId: result.guide?.id ?? null,
      matchedGuideZoneRu: result.guide?.zone_ru ?? null
    });
  }

  private matchByZoneNameDetailed(zoneName: string | null | undefined): ZoneNameMatchResult {
    if (!zoneName) {
      return {
        guide: null,
        matcherReason: 'none',
        normalizedZoneName: null
      };
    }

    const internalAreaMatch = this.resolveInternalAreaGuide(zoneName);
    if (internalAreaMatch.guide) {
      return {
        guide: internalAreaMatch.guide,
        matcherReason: 'internal_area',
        normalizedZoneName: internalAreaMatch.normalizedInternalAreaId
      };
    }

    const normalizedCandidates = buildZoneLookupCandidates(zoneName);
    const normalizedZoneName = normalizedCandidates[0] ?? null;

    for (const candidate of normalizedCandidates) {
      const zoneRuMatch = this.zoneRuMap.get(candidate);
      if (zoneRuMatch) {
        return {
          guide: zoneRuMatch,
          matcherReason: 'zone_ru',
          normalizedZoneName
        };
      }
    }

    for (const candidate of normalizedCandidates) {
      const zoneEnMatch = this.zoneEnMap.get(candidate);
      if (zoneEnMatch) {
        return {
          guide: zoneEnMatch,
          matcherReason: 'zone_en',
          normalizedZoneName
        };
      }
    }

    for (const candidate of normalizedCandidates) {
      const aliasMatch = this.aliasMap.get(candidate);
      if (aliasMatch) {
        return {
          guide: aliasMatch,
          matcherReason: 'alias',
          normalizedZoneName
        };
      }
    }

    return {
      guide: null,
      matcherReason: 'none',
      normalizedZoneName
    };
  }

  matchByZoneName(zoneName: string | null | undefined): {
    guide: GuideEntry | null;
    matcherReason: ZoneMatcherReason;
  } {
    const result = this.matchByZoneNameDetailed(zoneName);
    return {
      guide: result.guide,
      matcherReason: result.matcherReason
    };
  }

  resolveZoneMatch(input: {
    rawLine?: string | null;
    extractedInternalAreaId?: string | null;
    extractedZoneName?: string | null;
  }): ExtractedZoneMatch | null {
    const rawLine = String(input.rawLine ?? '').trim();
    const extractedInternalAreaId =
      String(input.extractedInternalAreaId ?? '').trim() || null;
    const extractedZoneName = String(input.extractedZoneName ?? '').trim() || null;
    const rawZoneName = extractedZoneName ?? extractedInternalAreaId;
    if (!rawZoneName) {
      return null;
    }

    const normalizedRawZoneName = normalizeText(rawZoneName);
    const ignoredSceneSources = new Set([
      '(null)',
      '(unknown)',
      'null',
      'unknown',
      '',
      '\u0430\u043a\u0442 1',
      '\u0430\u043a\u0442 2',
      '\u0430\u043a\u0442 3',
      '\u0430\u043a\u0442 4',
      '\u0430\u043a\u0442 5',
      'акт 1',
      'акт 2',
      'акт 3',
      'акт 4',
      'акт 5',
      'act 1',
      'act 2',
      'act 3',
      'act 4',
      'act 5',
      'interlude',
      '\u0438\u043d\u0442\u0435\u0440\u043b\u044e\u0434\u0438\u044f'
    ]);

    if (ignoredSceneSources.has(normalizedRawZoneName)) {
      return null;
    }

    const zoneMatch = extractedInternalAreaId
      ? (() => {
          const internalAreaLookup = this.resolveInternalAreaGuide(extractedInternalAreaId);
          this.logInternalAreaLookup(extractedInternalAreaId, internalAreaLookup);
          if (internalAreaLookup.guide) {
            return {
              guide: internalAreaLookup.guide,
              matcherReason: 'internal_area' as ZoneMatcherReason,
              normalizedZoneName: internalAreaLookup.normalizedInternalAreaId
            };
          }

          const textMatch = this.matchByZoneNameDetailed(rawZoneName);
          if (
            textMatch.guide &&
            entryAcceptsAreaId(textMatch.guide, extractedInternalAreaId)
          ) {
            return textMatch;
          }

          return {
            guide: null,
            matcherReason: 'none' as ZoneMatcherReason,
            normalizedZoneName: textMatch.normalizedZoneName
          };
        })()
      : this.matchByZoneNameDetailed(rawZoneName);

    return {
      rawLine,
      rawZoneName,
      extractedInternalAreaId,
      extractedZoneName,
      normalizedZoneName: zoneMatch.normalizedZoneName,
      source: extractedInternalAreaId ? 'internal-area-id' : 'entered-zone-name',
      guide: zoneMatch.guide,
      matcherReason: zoneMatch.matcherReason
    };
  }

  extractZoneMatchFromLine(line: string): ExtractedZoneMatch | null {
    const rawLine = String(line ?? '').trim();
    const extractedInternalAreaId = extractGeneratedAreaId(rawLine)?.trim() ?? null;
    const extractedZoneName = extractNamedZoneFromLine(rawLine)?.trim() ?? null;

    if (extractedInternalAreaId && !extractedZoneName) {
      return null;
    }

    if (extractedInternalAreaId || extractedZoneName) {
      return this.resolveZoneMatch({
        rawLine,
        extractedInternalAreaId,
        extractedZoneName
      });
    }

    const directZoneMatch = this.matchByZoneNameDetailed(rawLine);
    if (!directZoneMatch.guide) {
      return null;
    }

    return {
      rawLine,
      rawZoneName: rawLine,
      extractedInternalAreaId: null,
      extractedZoneName: rawLine,
      normalizedZoneName: directZoneMatch.normalizedZoneName,
      source: 'entered-zone-name',
      guide: directZoneMatch.guide,
      matcherReason: directZoneMatch.matcherReason
    };
  }
}
