export type CompanionSection = 'zone' | 'route' | 'progress' | 'run';
export type CompanionNavigationTab = 'zone' | 'route' | 'timer' | 'actTimes' | 'reminders' | 'bonuses' | 'summary';

export interface CompanionNavigationState {
  activeTab: CompanionNavigationTab;
  lastTabs: Record<CompanionSection, CompanionNavigationTab>;
}

export const COMPANION_NAVIGATION_STORAGE_KEY = 'poe2-companion-navigation-v1';

export const COMPANION_SECTION_DEFAULT_TAB: Record<CompanionSection, CompanionNavigationTab> = {
  zone: 'zone',
  route: 'route',
  progress: 'bonuses',
  run: 'timer'
};

const TAB_TO_SECTION: Record<CompanionNavigationTab, CompanionSection> = {
  zone: 'zone',
  route: 'route',
  bonuses: 'progress',
  reminders: 'progress',
  timer: 'run',
  actTimes: 'run',
  summary: 'run'
};

const TABS = new Set<CompanionNavigationTab>(Object.keys(TAB_TO_SECTION) as CompanionNavigationTab[]);

export function isCompanionNavigationTab(value: unknown): value is CompanionNavigationTab {
  return typeof value === 'string' && TABS.has(value as CompanionNavigationTab);
}

export function getCompanionSection(tab: CompanionNavigationTab): CompanionSection {
  return TAB_TO_SECTION[tab];
}

export function createDefaultCompanionNavigationState(): CompanionNavigationState {
  return {
    activeTab: COMPANION_SECTION_DEFAULT_TAB.zone,
    lastTabs: { ...COMPANION_SECTION_DEFAULT_TAB }
  };
}

export function normalizeCompanionNavigationState(value: unknown): CompanionNavigationState {
  const defaults = createDefaultCompanionNavigationState();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaults;
  }

  const source = value as Record<string, unknown>;
  const activeTab = isCompanionNavigationTab(source.activeTab) ? source.activeTab : defaults.activeTab;
  const lastTabsSource = source.lastTabs && typeof source.lastTabs === 'object' && !Array.isArray(source.lastTabs)
    ? source.lastTabs as Record<string, unknown>
    : {};
  const lastTabs = { ...defaults.lastTabs };

  for (const section of Object.keys(lastTabs) as CompanionSection[]) {
    const candidate = lastTabsSource[section];
    if (isCompanionNavigationTab(candidate) && getCompanionSection(candidate) === section) {
      lastTabs[section] = candidate;
    }
  }

  lastTabs[getCompanionSection(activeTab)] = activeTab;

  return { activeTab, lastTabs };
}

export function updateCompanionNavigationState(
  state: CompanionNavigationState,
  activeTab: CompanionNavigationTab
): CompanionNavigationState {
  return {
    activeTab,
    lastTabs: {
      ...state.lastTabs,
      [getCompanionSection(activeTab)]: activeTab
    }
  };
}
