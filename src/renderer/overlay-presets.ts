import type {
  AppConfig,
  AppLanguage,
  MainOverlaySettings,
  OverlayDensity,
  OverlayScale,
  OverlayVisibleSections,
  SettingsPatch,
  VisualFxIntensity
} from '../shared/types';

export type OverlayPresetId = 'quiet' | 'route' | 'speedrun' | 'timer_only';

export type OverlayPresetPatch = {
  overlayOpacity: number;
  overlayScale: OverlayScale;
  overlayDensity: OverlayDensity;
  visualFxIntensity: VisualFxIntensity;
  overlayEffectsEnabled: boolean;
  overlayVisibleSections: OverlayVisibleSections;
  mainOverlaySettings: MainOverlaySettings;
  runTimerSettings: {
    showActTimer: boolean;
    showZoneTimer: boolean;
  };
};

export const OVERLAY_PRESET_IDS: OverlayPresetId[] = [
  'quiet',
  'route',
  'speedrun',
  'timer_only'
];

const OVERLAY_SECTION_KEYS: Array<keyof OverlayVisibleSections> = [
  'nearby',
  'zoneInfo',
  'zoneBonuses',
  'league',
  'next',
  'skip',
  'speedrun',
  'important',
  'rewards',
  'boss_tips',
  'xp_notes',
  'crafting_tips',
  'after'
];

const MAIN_OVERLAY_SETTING_KEYS: Array<keyof MainOverlaySettings> = [
  'showOverlaySkip',
  'showOverlayCriticalImportant',
  'showOverlayBossTip',
  'showOverlayVendorReminder',
  'showOverlayXpStatus',
  'showOverlayPowerSpike',
  'overlayMode',
  'overlayTimerOnlyMode'
];

export const OVERLAY_PRESET_PATCHES: Record<OverlayPresetId, OverlayPresetPatch> = {
  quiet: {
    overlayOpacity: 0.9,
    overlayScale: 90,
    overlayDensity: 'compact',
    visualFxIntensity: 'off',
    overlayEffectsEnabled: false,
    overlayVisibleSections: {
      nearby: false,
      zoneInfo: true,
      zoneBonuses: false,
      league: false,
      next: true,
      skip: false,
      speedrun: false,
      important: true,
      rewards: false,
      boss_tips: false,
      xp_notes: false,
      crafting_tips: false,
      after: false
    },
    mainOverlaySettings: {
      showOverlaySkip: false,
      showOverlayCriticalImportant: true,
      showOverlayBossTip: false,
      showOverlayVendorReminder: false,
      showOverlayXpStatus: false,
      showOverlayPowerSpike: false,
      overlayMode: 'full',
      overlayTimerOnlyMode: false
    },
    runTimerSettings: {
      showActTimer: false,
      showZoneTimer: false
    }
  },
  route: {
    overlayOpacity: 0.96,
    overlayScale: 90,
    overlayDensity: 'normal',
    visualFxIntensity: 'normal',
    overlayEffectsEnabled: true,
    overlayVisibleSections: {
      nearby: true,
      zoneInfo: true,
      zoneBonuses: true,
      league: true,
      next: true,
      skip: true,
      speedrun: false,
      important: true,
      rewards: true,
      boss_tips: true,
      xp_notes: true,
      crafting_tips: true,
      after: false
    },
    mainOverlaySettings: {
      showOverlaySkip: true,
      showOverlayCriticalImportant: true,
      showOverlayBossTip: true,
      showOverlayVendorReminder: true,
      showOverlayXpStatus: true,
      showOverlayPowerSpike: true,
      overlayMode: 'full',
      overlayTimerOnlyMode: false
    },
    runTimerSettings: {
      showActTimer: true,
      showZoneTimer: true
    }
  },
  speedrun: {
    overlayOpacity: 0.92,
    overlayScale: 90,
    overlayDensity: 'normal',
    visualFxIntensity: 'off',
    overlayEffectsEnabled: false,
    overlayVisibleSections: {
      nearby: false,
      zoneInfo: true,
      zoneBonuses: true,
      league: false,
      next: true,
      skip: true,
      speedrun: true,
      important: true,
      rewards: true,
      boss_tips: true,
      xp_notes: false,
      crafting_tips: false,
      after: false
    },
    mainOverlaySettings: {
      showOverlaySkip: true,
      showOverlayCriticalImportant: true,
      showOverlayBossTip: true,
      showOverlayVendorReminder: true,
      showOverlayXpStatus: false,
      showOverlayPowerSpike: true,
      overlayMode: 'full',
      overlayTimerOnlyMode: false
    },
    runTimerSettings: {
      showActTimer: true,
      showZoneTimer: true
    }
  },
  timer_only: {
    overlayOpacity: 0.92,
    overlayScale: 90,
    overlayDensity: 'normal',
    visualFxIntensity: 'off',
    overlayEffectsEnabled: false,
    overlayVisibleSections: {
      nearby: false,
      zoneInfo: false,
      zoneBonuses: false,
      league: false,
      next: false,
      skip: false,
      speedrun: false,
      important: false,
      rewards: false,
      boss_tips: false,
      xp_notes: false,
      crafting_tips: false,
      after: false
    },
    mainOverlaySettings: {
      showOverlaySkip: false,
      showOverlayCriticalImportant: false,
      showOverlayBossTip: false,
      showOverlayVendorReminder: false,
      showOverlayXpStatus: false,
      showOverlayPowerSpike: false,
      overlayMode: 'timer_only',
      overlayTimerOnlyMode: true
    },
    runTimerSettings: {
      showActTimer: true,
      showZoneTimer: true
    }
  }
};

const LABELS: Record<AppLanguage, Record<OverlayPresetId | 'custom' | 'title' | 'current', string>> = {
  ru: {
    title: 'Пресеты оверлея',
    current: 'Сейчас',
    custom: 'Свои настройки',
    quiet: 'Quiet',
    route: 'Route',
    speedrun: 'Speedrun',
    timer_only: 'Timer only'
  },
  en: {
    title: 'Overlay presets',
    current: 'Current',
    custom: 'Custom',
    quiet: 'Quiet',
    route: 'Route',
    speedrun: 'Speedrun',
    timer_only: 'Timer only'
  }
};

function getLabels(language: AppLanguage) {
  return LABELS[language === 'en' ? 'en' : 'ru'];
}

function clonePresetPatch(preset: OverlayPresetPatch): OverlayPresetPatch {
  return {
    ...preset,
    overlayVisibleSections: {
      ...preset.overlayVisibleSections
    },
    mainOverlaySettings: {
      ...preset.mainOverlaySettings
    },
    runTimerSettings: {
      ...preset.runTimerSettings
    }
  };
}

function matchesPreset(config: AppConfig, preset: OverlayPresetPatch): boolean {
  return config.overlayOpacity === preset.overlayOpacity &&
    config.overlayScale === preset.overlayScale &&
    config.overlayDensity === preset.overlayDensity &&
    config.visualFxIntensity === preset.visualFxIntensity &&
    config.overlayEffectsEnabled === preset.overlayEffectsEnabled &&
    OVERLAY_SECTION_KEYS.every((key) => config.overlayVisibleSections[key] === preset.overlayVisibleSections[key]) &&
    MAIN_OVERLAY_SETTING_KEYS.every((key) => config.mainOverlaySettings[key] === preset.mainOverlaySettings[key]) &&
    config.runTimerSettings.showActTimer === preset.runTimerSettings.showActTimer &&
    config.runTimerSettings.showZoneTimer === preset.runTimerSettings.showZoneTimer;
}

export function buildOverlayPresetPatch(presetId: OverlayPresetId): SettingsPatch {
  return clonePresetPatch(OVERLAY_PRESET_PATCHES[presetId]);
}

export function getMatchingOverlayPreset(config: AppConfig): OverlayPresetId | null {
  return OVERLAY_PRESET_IDS.find((presetId) => matchesPreset(config, OVERLAY_PRESET_PATCHES[presetId])) ?? null;
}

export function formatOverlayPresetLabel(presetId: OverlayPresetId, language: AppLanguage): string {
  return getLabels(language)[presetId];
}

export function formatOverlayPresetTitle(language: AppLanguage): string {
  return getLabels(language).title;
}

export function formatOverlayPresetState(presetId: OverlayPresetId | null, language: AppLanguage): string {
  const labels = getLabels(language);
  return `${labels.current}: ${presetId ? labels[presetId] : labels.custom}`;
}
