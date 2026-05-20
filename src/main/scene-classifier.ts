import townScenes from '../data/town-scenes.json';
import type { GuideEntry } from '../shared/types';

const TOWN_ZONE_HINTS = ['encampment', 'camp', 'town', 'hideout', 'лагерь', 'город', 'убежище'];

const NON_GAMEPLAY_SCENES = new Set([
  '(null)',
  '(unknown)',
  'null',
  'unknown',
  'акт 1',
  'акт 2',
  'акт 3',
  'акт 4',
  'акт 5',
  'логин',
  'login',
  'меню',
  'menu'
]);

const LOGIN_SCENE_HINTS = [
  'логин',
  'login',
  'меню',
  'menu',
  'character select',
  'character selection',
  'select character',
  'screen login',
  'login screen'
];

const PENDING_AREA_ID_HOLD_SCENES = new Set([
  '(null)',
  '(unknown)',
  'null',
  'unknown',
  'act 1',
  'act 2',
  'act 3',
  'act 4',
  'act 5',
  'акт 1',
  'акт 2',
  'акт 3',
  'акт 4',
  'акт 5',
  'interlude',
  'интерлюдия'
]);

const TOWN_SCENES = new Set(
  (Array.isArray(townScenes) ? townScenes : [])
    .map((entry) => normalizeSceneText(String(entry ?? '')))
    .filter(Boolean)
);

export function normalizeSceneText(input: unknown): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\u0451/g, 'е')
    .trim();
}

export function inferActHintFromInternalAreaId(areaId: unknown): number | null {
  const normalized = normalizeSceneText(areaId).replace(/^c_/, '');

  if (/^g1(?:_|$)/.test(normalized)) {
    return 1;
  }

  if (/^g2(?:_|$)/.test(normalized)) {
    return 2;
  }

  if (/^g3(?:_|$)/.test(normalized)) {
    return 3;
  }

  if (/^g4(?:_|$)/.test(normalized)) {
    return 4;
  }

  if (/^g5(?:_|$)/.test(normalized) || /^p[123](?:_|$)/.test(normalized)) {
    return 5;
  }

  return null;
}

export function isUnknownOrNullScene(rawSceneSource: unknown): boolean {
  const normalized = normalizeSceneText(rawSceneSource);
  return normalized === '(null)' || normalized === '(unknown)' || normalized === 'null' || normalized === 'unknown';
}

export function isActLabelScene(rawSceneSource: unknown): boolean {
  const normalized = normalizeSceneText(rawSceneSource);
  return /^акт\s+\d+$/.test(normalized) || /^act\s+\d+$/.test(normalized);
}

export function isLoginLikeScene(rawSceneSource: unknown): boolean {
  const normalized = normalizeSceneText(rawSceneSource);
  return Boolean(normalized) && LOGIN_SCENE_HINTS.some((hint) => normalized.includes(hint));
}

export function isTownSceneWithGuide(rawSceneSource: unknown, guide: GuideEntry | null | undefined): boolean {
  const normalized = normalizeSceneText(rawSceneSource);

  if (!normalized || guide) {
    return false;
  }

  if (TOWN_SCENES.has(normalized)) {
    return true;
  }

  return TOWN_ZONE_HINTS.some((hint) => normalized.includes(hint));
}

export function isValidGameplaySceneSource(
  rawSceneSource: unknown,
  guide: GuideEntry | null | undefined
): boolean {
  const normalized = normalizeSceneText(rawSceneSource);

  if (!normalized) {
    return false;
  }

  if (isTownSceneWithGuide(rawSceneSource, guide)) {
    return false;
  }

  if (guide) {
    return true;
  }

  if (NON_GAMEPLAY_SCENES.has(normalized)) {
    return false;
  }

  if (isActLabelScene(rawSceneSource) || isLoginLikeScene(rawSceneSource)) {
    return false;
  }

  return true;
}

export function shouldKeepPendingZoneAreaId(zoneName: unknown): boolean {
  return PENDING_AREA_ID_HOLD_SCENES.has(normalizeSceneText(zoneName));
}
