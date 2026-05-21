import type { GuideDataFile, GuideEntry } from '../../src/shared/types';
import { createMockUserDataPath, installElectronMock } from './electron-mock';
import { readJson } from './loadJson';

export interface SimilarZonePair {
  left: GuideEntry;
  right: GuideEntry;
  reason: 'substring-en' | 'substring-ru';
}

export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[‘’`´]/g, "'")
    .replace(/[«»]/g, '"')
    .replace(/[".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAreaId(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/^c_/, '');
}

export function getGuideData(): GuideDataFile {
  return readJson<GuideDataFile>('src/data/guide.json');
}

export function getGuideZones(): GuideEntry[] {
  return getGuideData().zones;
}

export function getZonesByAct(): Map<number, GuideEntry[]> {
  const result = new Map<number, GuideEntry[]>();
  for (const zone of getGuideZones()) {
    const act = Number(zone.act);
    const bucket = result.get(act) ?? [];
    bucket.push(zone);
    result.set(act, bucket);
  }
  return result;
}

export function getZoneAreaIds(zone: GuideEntry): string[] {
  return [...(zone.area_ids ?? []), ...(zone.areaIds ?? [])];
}

export function getZoneAliases(zone: GuideEntry): string[] {
  return [...(zone.aliases ?? []), ...(zone.aliases_en ?? []), ...(zone.zone_aliases ?? [])];
}

export function getZoneById(id: string): GuideEntry | null {
  return getGuideZones().find((zone) => zone.id === id) ?? null;
}

export function findPotentiallySimilarZones(zones = getGuideZones()): SimilarZonePair[] {
  const pairs: SimilarZonePair[] = [];

  for (let index = 0; index < zones.length; index += 1) {
    for (let nextIndex = index + 1; nextIndex < zones.length; nextIndex += 1) {
      const left = zones[index];
      const right = zones[nextIndex];
      const leftEn = normalizeText(left.zone_en);
      const rightEn = normalizeText(right.zone_en);
      const leftRu = normalizeText(left.zone_ru);
      const rightRu = normalizeText(right.zone_ru);

      if (leftEn && rightEn && (leftEn.includes(rightEn) || rightEn.includes(leftEn))) {
        pairs.push({ left, right, reason: 'substring-en' });
        continue;
      }

      if (leftRu && rightRu && (leftRu.includes(rightRu) || rightRu.includes(leftRu))) {
        pairs.push({ left, right, reason: 'substring-ru' });
      }
    }
  }

  return pairs;
}

export function loadGuideService(): {
  getAll: () => GuideEntry[];
  findById: (id: string | null | undefined) => GuideEntry | null;
  findByZoneName: (zoneName: string | null | undefined) => GuideEntry | null;
  resolveZoneMatch: (input: {
    rawLine?: string | null;
    extractedInternalAreaId?: string | null;
    extractedZoneName?: string | null;
  }) => {
    guide: GuideEntry | null;
    rawZoneName: string;
    extractedInternalAreaId: string | null;
    extractedZoneName: string | null;
    matcherReason: string;
  } | null;
} {
  installElectronMock();
  const { GuideService } = require('../../src/main/services/guide-service') as typeof import('../../src/main/services/guide-service');
  const service = new GuideService();
  service.load();
  return service;
}

export function loadMainModule(): typeof import('../../src/main/main') {
  installElectronMock();
  return require('../../src/main/main') as typeof import('../../src/main/main');
}

export function createTestAppInstance(): InstanceType<typeof import('../../src/main/main').PoeOverlayApp> {
  const { PoeOverlayApp } = loadMainModule();
  createMockUserDataPath();
  const app = new PoeOverlayApp();
  (app as unknown as { loadGuide: () => void }).loadGuide();
  return app as InstanceType<typeof PoeOverlayApp>;
}

export function applyAppLogLine(
  app: {
    processRunTimerActivityFromLogLine: (line: string, source: 'bootstrap' | 'append') => void;
    processLevelUpFromLogLine: (line: string, source: 'bootstrap' | 'append') => void;
    applyCampaignBonusMatchesFromLogLine: (line: string, source: 'bootstrap' | 'append') => void;
  },
  line: string,
  source: 'bootstrap' | 'append' = 'append'
): void {
  app.processRunTimerActivityFromLogLine(line, source);
  app.processLevelUpFromLogLine(line, source);
  app.applyCampaignBonusMatchesFromLogLine(line, source);
}

export function applyAppLogLines(
  app: Parameters<typeof applyAppLogLine>[0],
  lines: string[],
  source: 'bootstrap' | 'append' = 'append'
): void {
  for (const line of lines) {
    applyAppLogLine(app, line, source);
  }
}
