// @ts-nocheck
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function readJson(relativePath) {
  return JSON.parse(readFileSync(join(process.cwd(), relativePath), 'utf8'));
}

export function readText(relativePath) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\u0451/g, '\u0435')
    .replace(/[‘’`´]/g, "'")
    .replace(/[«»]/g, '"')
    .replace(/[".,:;!?()[\]{}\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAreaId(value) {
  return String(value ?? '').trim().toLowerCase().replace(/^c_/, '');
}

export function getGuideZones() {
  const raw = readJson('src/data/guide.json');
  return Array.isArray(raw) ? raw : raw.zones ?? [];
}

export function getCampaignBonuses() {
  const raw = readJson('src/data/campaign-bonuses.json');
  return raw.bonuses ?? [];
}

export function getZoneById(id) {
  return getGuideZones().find((zone) => zone.id === id) ?? null;
}

export function getZoneByAreaId(areaId) {
  const normalized = normalizeAreaId(areaId);
  return getGuideZones().find((zone) => {
    const ids = [...(zone.area_ids ?? []), ...(zone.areaIds ?? [])];
    return ids.some((candidate) => normalizeAreaId(candidate) === normalized);
  }) ?? null;
}

export function readMainProcessSource() {
  const mainDir = join(process.cwd(), 'src/main');
  const appModules = readdirSync(mainDir)
    .filter((fileName) => /^app-.*\.ts$/.test(fileName))
    .sort()
    .map((fileName) => `src/main/${fileName}`);

  return ['src/main/main.ts', ...appModules].map(readText).join('\n');
}
