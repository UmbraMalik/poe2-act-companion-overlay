import type {
  OverlayLayoutSection,
  AppConfig,
  OverlayMode,
  OverlayVisibleSections
} from '../shared/types';
import {
  getMatchingOverlayPreset,
  type OverlayPresetId
} from './overlay-presets';

export type OverlayDisplayIntent = 'normal' | 'speedrun' | 'timer_only' | 'custom';

export const OVERLAY_CONTENT_BLOCKS = [
  'nearby',
  'zoneInfo',
  'zoneBonuses',
  'league',
  'next',
  'skip',
  'speedrun',
  'important'
] as const;

export type OverlayContentBlock = typeof OVERLAY_CONTENT_BLOCKS[number];
export type OverlayCopyDensity = 'normal' | 'dense' | 'timer' | 'custom';

export interface OverlayContentPlan {
  intent: OverlayDisplayIntent;
  presetId: OverlayPresetId | null;
  visibleSections: OverlayVisibleSections;
  blockOrder: Record<OverlayContentBlock, number>;
  copyDensity: OverlayCopyDensity;
  maxChecklistItems: number | null;
}

// Presets may change visibility/density, but must not visually reorder the overlay.
// Keeping every block at neutral order preserves the existing DOM layout and footer position.
const STABLE_BLOCK_ORDER = OVERLAY_CONTENT_BLOCKS.reduce(
  (order, block) => ({
    ...order,
    [block]: 0
  }),
  {} as Record<OverlayContentBlock, number>
);

const COPY_DENSITY_BY_INTENT: Record<OverlayDisplayIntent, OverlayCopyDensity> = {
  normal: 'normal',
  speedrun: 'dense',
  timer_only: 'timer',
  custom: 'custom'
};

const MAX_CHECKLIST_ITEMS_BY_INTENT: Record<OverlayDisplayIntent, number | null> = {
  normal: null,
  speedrun: 4,
  timer_only: 0,
  custom: null
};

function cloneVisibleSections(sections: OverlayVisibleSections): OverlayVisibleSections {
  return { ...sections };
}

function buildBlockOrder(config: AppConfig): Record<OverlayContentBlock, number> {
  const sections: OverlayLayoutSection[] = ['zoneInfo', 'route', 'nearby', 'tips'];
  const selected = Array.isArray(config.overlayLayoutOrder) ? config.overlayLayoutOrder : sections;
  const order = [...new Set([...selected, ...sections])];
  const position = (section: OverlayLayoutSection) => 10 + 10 * order.indexOf(section);
  return {
    ...STABLE_BLOCK_ORDER,
    zoneInfo: position('zoneInfo'),
    next: position('route'),
    zoneBonuses: position('route'),
    nearby: position('nearby'),
    skip: position('tips'),
    speedrun: position('tips'),
    important: position('tips')
  };
}

function getIntentFromPreset(presetId: OverlayPresetId | null): OverlayDisplayIntent | null {
  if (presetId === 'timer_only') {
    return 'timer_only';
  }

  if (presetId === 'speedrun') {
    return 'speedrun';
  }

  if (presetId === 'quiet' || presetId === 'route') {
    return 'normal';
  }

  return null;
}

export function getOverlayDisplayIntent(
  config: AppConfig,
  runtimeOverlayMode?: OverlayMode | null
): { intent: OverlayDisplayIntent; presetId: OverlayPresetId | null } {
  if (
    runtimeOverlayMode === 'timer_only' ||
    config.mainOverlaySettings.overlayMode === 'timer_only' ||
    config.mainOverlaySettings.overlayTimerOnlyMode
  ) {
    return { intent: 'timer_only', presetId: 'timer_only' };
  }

  const presetId = getMatchingOverlayPreset(config);
  const presetIntent = getIntentFromPreset(presetId);

  return {
    intent: presetIntent ?? 'custom',
    presetId
  };
}

function applyPresetIntentVisibility(
  sections: OverlayVisibleSections,
  intent: OverlayDisplayIntent
): OverlayVisibleSections {
  if (intent === 'timer_only') {
    return {
      ...sections,
      nearby: false,
      zoneInfo: false,
      zoneBonuses: false,
      league: false,
      next: false,
      skip: false,
      speedrun: false,
      important: false
    };
  }

  if (intent === 'normal') {
    return {
      ...sections,
      speedrun: false
    };
  }

  if (intent === 'speedrun') {
    return {
      ...sections,
      nearby: false,
      league: false
    };
  }

  return sections;
}

export function buildOverlayContentPlan(params: {
  config: AppConfig;
  runtimeOverlayMode?: OverlayMode | null;
}): OverlayContentPlan {
  const { intent, presetId } = getOverlayDisplayIntent(
    params.config,
    params.runtimeOverlayMode
  );
  const visibleSections = applyPresetIntentVisibility(
    cloneVisibleSections(params.config.overlayVisibleSections),
    intent
  );

  return {
    intent,
    presetId,
    visibleSections,
    blockOrder: buildBlockOrder(params.config),
    copyDensity: COPY_DENSITY_BY_INTENT[intent],
    maxChecklistItems: MAX_CHECKLIST_ITEMS_BY_INTENT[intent]
  };
}
