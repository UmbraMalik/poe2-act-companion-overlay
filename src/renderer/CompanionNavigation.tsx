import type { ReactNode } from 'react';
import type { CompanionNavigationTab, CompanionSection } from './companion-navigation-state';

export type { CompanionNavigationTab, CompanionSection } from './companion-navigation-state';

// Keep every destination visible. Selecting a group still restores its last-used tab.
const SECTION_TABS: Record<CompanionSection, CompanionNavigationTab[]> = {
  zone: ['zone'],
  route: ['route'],
  progress: ['bonuses', 'reminders'],
  run: ['timer', 'actTimes', 'summary']
};

interface CompanionNavigationProps {
  activeSection: CompanionSection;
  activeTab: CompanionNavigationTab;
  sectionLabels: Record<CompanionSection, string>;
  tabLabels: Record<CompanionNavigationTab, string>;
  onSectionChange: (section: CompanionSection) => void;
  onTabChange: (tab: CompanionNavigationTab) => void;
  children: ReactNode;
}

export function CompanionNavigation({
  activeSection,
  activeTab,
  sectionLabels,
  tabLabels,
  onSectionChange,
  onTabChange,
  children
}: CompanionNavigationProps) {
  return (
    <section className="settings-card companion-card companion-sidebar-layout">
      <nav className="companion-sidebar" aria-label={sectionLabels[activeSection]}>
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
                  onClick={() => onTabChange(tab)}
                >
                  {tabLabels[tab]}
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
