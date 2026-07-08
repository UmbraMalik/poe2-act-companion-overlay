import type { AppLanguage } from '../shared/types';

export type SettingsGroupId =
  | 'first_run'
  | 'log_detection'
  | 'overlay'
  | 'timer'
  | 'troubleshooting'
  | 'advanced';

export type SettingsSectionId =
  | 'settings-first-run'
  | 'settings-language'
  | 'settings-updates'
  | 'settings-log-file'
  | 'settings-live-update'
  | 'settings-timer'
  | 'settings-level-reminders'
  | 'settings-overlay'
  | 'settings-detail-panel'
  | 'settings-simulate'
  | 'settings-local-progress'
  | 'settings-advanced'
  | 'settings-developer';

type LocalizedText = Record<AppLanguage, string>;

type SettingsSectionDefinition = {
  id: SettingsSectionId;
  groupId: SettingsGroupId;
  label: LocalizedText;
  searchText: LocalizedText;
  devOnly?: boolean;
};

const GROUP_LABELS: Record<SettingsGroupId, LocalizedText> = {
  first_run: { ru: 'Первый запуск', en: 'First run' },
  log_detection: { ru: 'Лог-файл', en: 'Log detection' },
  overlay: { ru: 'Оверлей и панель', en: 'Overlay and panel' },
  timer: { ru: 'Таймер', en: 'Timer' },
  troubleshooting: { ru: 'Диагностика и сброс', en: 'Troubleshooting' },
  advanced: { ru: 'Расширенные', en: 'Advanced' }
};

const SEARCH_LABELS: Record<'label' | 'placeholder' | 'empty', LocalizedText> = {
  label: { ru: 'Поиск настроек', en: 'Search settings' },
  placeholder: { ru: 'Лог, таймер, оверлей...', en: 'Log, timer, overlay...' },
  empty: { ru: 'Ничего не найдено. Попробуй другой запрос.', en: 'No settings found. Try another search.' }
};

export const SETTINGS_SECTIONS: SettingsSectionDefinition[] = [
  {
    id: 'settings-first-run',
    groupId: 'first_run',
    label: { ru: 'Первый запуск', en: 'First run' },
    searchText: {
      ru: 'старт настройка путь лог выбрать файл зона переместить оверлей',
      en: 'start setup path log choose file zone move overlay'
    }
  },
  {
    id: 'settings-language',
    groupId: 'first_run',
    label: { ru: 'Язык', en: 'Language' },
    searchText: { ru: 'русский английский ru en локализация', en: 'russian english ru en localization' }
  },
  {
    id: 'settings-updates',
    groupId: 'first_run',
    label: { ru: 'Обновления', en: 'Updates' },
    searchText: { ru: 'релиз версия скачать установить github vpn', en: 'release version download install github vpn' }
  },
  {
    id: 'settings-log-file',
    groupId: 'log_detection',
    label: { ru: 'Файл лога', en: 'Log file' },
    searchText: { ru: 'client latestclient путь watcher чтение зона статус', en: 'client latestclient path watcher read zone status' }
  },
  {
    id: 'settings-live-update',
    groupId: 'log_detection',
    label: { ru: 'Тестовая строка лога', en: 'Dev log line' },
    searchText: { ru: 'append симуляция тестовая строка лог dev debug', en: 'append simulation test line log dev debug' },
    devOnly: true
  },
  {
    id: 'settings-timer',
    groupId: 'timer',
    label: { ru: 'Таймер забега', en: 'Run timer' },
    searchText: { ru: 'таймер старт лига отсчет акт пауза сброс', en: 'timer start league countdown act pause reset' }
  },
  {
    id: 'settings-level-reminders',
    groupId: 'timer',
    label: { ru: 'Напоминания уровней', en: 'Level reminders' },
    searchText: { ru: 'уровень напоминания вендор награда сброс', en: 'level reminders vendor reward reset' }
  },
  {
    id: 'settings-overlay',
    groupId: 'overlay',
    label: { ru: 'Оверлей', en: 'Overlay' },
    searchText: {
      ru: 'пресеты тихий маршрут спидран таймер прозрачность масштаб размер плотность эффекты тема секции хоткеи',
      en: 'presets quiet route speedrun timer opacity scale size density effects theme sections hotkeys'
    }
  },
  {
    id: 'settings-detail-panel',
    groupId: 'overlay',
    label: { ru: 'Подробная панель', en: 'Detail panel' },
    searchText: { ru: 'companion подробная панель поверх открыть', en: 'companion detail panel always on top open' }
  },
  {
    id: 'settings-simulate',
    groupId: 'troubleshooting',
    label: { ru: 'Симуляция зоны', en: 'Zone simulation' },
    searchText: { ru: 'симуляция зона dev debug тест', en: 'simulation zone dev debug test' },
    devOnly: true
  },
  {
    id: 'settings-local-progress',
    groupId: 'troubleshooting',
    label: { ru: 'Локальный прогресс', en: 'Local progress' },
    searchText: { ru: 'сброс прогресс маршрут бонусы история текущая зона', en: 'reset progress route bonuses history current zone' }
  },
  {
    id: 'settings-advanced',
    groupId: 'advanced',
    label: { ru: 'Производительность', en: 'Performance' },
    searchText: {
      ru: 'производительность realtime priority экстремальный режим отрисовка риск',
      en: 'performance realtime priority extreme rendering mode risk'
    }
  },
  {
    id: 'settings-developer',
    groupId: 'advanced',
    label: { ru: 'Для разработки', en: 'For development' },
    searchText: { ru: 'developer diagnostics dev panel debug layout диагностика', en: 'developer diagnostics dev panel debug layout' },
    devOnly: true
  }
];

export const SETTINGS_QUICK_LINKS = SETTINGS_SECTIONS.map(({ id, devOnly }) => ({ id, devOnly }));

export function normalizeSettingsSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function getSettingsGroupLabel(groupId: SettingsGroupId, language: AppLanguage): string {
  return GROUP_LABELS[groupId][language] ?? GROUP_LABELS[groupId].ru;
}

export function getSettingsSearchLabel(language: AppLanguage): string {
  return SEARCH_LABELS.label[language] ?? SEARCH_LABELS.label.ru;
}

export function getSettingsSearchPlaceholder(language: AppLanguage): string {
  return SEARCH_LABELS.placeholder[language] ?? SEARCH_LABELS.placeholder.ru;
}

export function getSettingsSearchEmptyText(language: AppLanguage): string {
  return SEARCH_LABELS.empty[language] ?? SEARCH_LABELS.empty.ru;
}

export function getSettingsSectionLabel(sectionId: SettingsSectionId, language: AppLanguage): string {
  const section = SETTINGS_SECTIONS.find((entry) => entry.id === sectionId);
  return section?.label[language] ?? section?.label.ru ?? sectionId;
}

export function getSettingsSearchResult(query: string, includeDevSections = false) {
  const normalizedQuery = normalizeSettingsSearchQuery(query);
  const matchingSections = SETTINGS_SECTIONS.filter((section) => {
    if (section.devOnly && !includeDevSections) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      section.id,
      section.groupId,
      section.label.ru,
      section.label.en,
      section.searchText.ru,
      section.searchText.en
    ].join(' ');

    return normalizeSettingsSearchQuery(haystack).includes(normalizedQuery);
  });

  return {
    isFiltering: normalizedQuery.length > 0,
    normalizedQuery,
    visibleGroupIds: new Set(matchingSections.map((section) => section.groupId)),
    visibleSectionIds: new Set(matchingSections.map((section) => section.id))
  };
}
