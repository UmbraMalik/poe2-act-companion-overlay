import { useEffect, useState, type ReactNode } from 'react';
import { UiIcon, type UiIconName } from './UiIcon';
import type { AppLanguage } from '../shared/types';
import type { CompanionNavigationTab, CompanionSection } from './companion-navigation-state';

export type { CompanionNavigationTab, CompanionSection } from './companion-navigation-state';

// Keep every destination visible. Selecting a group still restores its last-used tab.
const SECTION_TABS: Record<CompanionSection, CompanionNavigationTab[]> = {
  zone: ['zone'],
  route: ['route'],
  progress: ['bonuses', 'reminders'],
  run: ['timer', 'actTimes', 'summary']
};

const TAB_ICONS: Record<CompanionNavigationTab, UiIconName> = {
  zone: 'compass',
  route: 'map',
  bonuses: 'gift',
  reminders: 'bell',
  timer: 'timer',
  actTimes: 'chart',
  summary: 'flag'
};

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'poe2-companion-sidebar-collapsed-v1';


interface CompanionNavigationProps {
  activeSection: CompanionSection;
  activeTab: CompanionNavigationTab;
  language: AppLanguage;
  sectionLabels: Record<CompanionSection, string>;
  tabLabels: Record<CompanionNavigationTab, string>;
  onSectionChange: (section: CompanionSection) => void;
  onTabChange: (tab: CompanionNavigationTab) => void;
  children: ReactNode;
}

export function CompanionNavigation({
  activeSection,
  activeTab,
  language,
  sectionLabels,
  tabLabels,
  onSectionChange,
  onTabChange,
  children
}: CompanionNavigationProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage is optional; sidebar navigation must remain usable without it.
    }
  }, [collapsed]);

  const toggleLabel = language === 'ru'
    ? (collapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню')
    : (collapsed ? 'Expand sidebar' : 'Collapse sidebar');

  return (
    <section className={`settings-card companion-card companion-sidebar-layout${collapsed ? ' is-sidebar-collapsed' : ''}`}>
      <nav className="companion-sidebar" aria-label={language === 'ru' ? 'Навигация подробной панели' : 'Companion navigation'}>
        <div className="companion-sidebar-tools">
          <button
            type="button"
            className="companion-sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={toggleLabel}
            aria-pressed={collapsed}
            title={toggleLabel}
          >
            <UiIcon name={collapsed ? 'panel-expand' : 'panel-collapse'} size={18} />
            <span className="companion-sidebar-toggle-text">{language === 'ru' ? 'Свернуть' : 'Collapse'}</span>
          </button>
        </div>
        {(Object.keys(SECTION_TABS) as CompanionSection[]).map((section) => (
          <div className="companion-sidebar-group" key={section}>
            <button
              type="button"
              className={`companion-sidebar-heading${section === activeSection ? ' is-section-active' : ''}`}
              aria-label={sectionLabels[section]}
              onClick={() => onSectionChange(section)}
            >
              {sectionLabels[section]}
            </button>
            <div className="companion-sidebar-links">
              {SECTION_TABS[section].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  className={`companion-sidebar-link${tab === activeTab ? ' is-active' : ''}`}
                  aria-current={tab === activeTab ? 'page' : undefined}
                  aria-label={tabLabels[tab]}
                  title={tabLabels[tab]}
                  onClick={() => onTabChange(tab)}
                >
                  <UiIcon name={TAB_ICONS[tab]} size={17} className="companion-sidebar-tab-icon" />
                  <span className="companion-sidebar-tab-text">{tabLabels[tab]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="companion-content-pane">{children}</div>
    </section>
  );
}
