import type { ReactNode } from 'react';

export type CompanionSection = 'zone' | 'route' | 'progress' | 'run';
export type CompanionNavigationTab = 'zone' | 'route' | 'timer' | 'actTimes' | 'reminders' | 'bonuses' | 'summary';

interface CompanionNavigationProps {
  activeSection: CompanionSection;
  activeTab: CompanionNavigationTab;
  sectionLabels: Record<CompanionSection, string>;
  subTabs: Array<{ id: CompanionNavigationTab; label: string }>;
  onSectionChange: (section: CompanionSection) => void;
  onTabChange: (tab: CompanionNavigationTab) => void;
  children: ReactNode;
}

export function CompanionNavigation({
  activeSection,
  activeTab,
  sectionLabels,
  subTabs,
  onSectionChange,
  onTabChange,
  children
}: CompanionNavigationProps) {
  return (
    <section className="settings-card companion-card">
      <nav className="companion-tab-row companion-primary-nav" aria-label="Primary">
        {(Object.keys(sectionLabels) as CompanionSection[]).map((section) => (
          <button
            key={section}
            type="button"
            className={section === activeSection ? 'button-primary' : 'button-secondary'}
            onClick={() => onSectionChange(section)}
          >
            {sectionLabels[section]}
          </button>
        ))}
      </nav>
      {subTabs.length > 0 && (
        <nav
          className={`companion-subtab-row is-count-${subTabs.length}`}
          aria-label={sectionLabels[activeSection]}
        >
          {subTabs.map((tab) => {
            const isActive = tab.id === activeTab;

            return (
              <button
                key={tab.id}
                type="button"
                className={isActive ? 'is-active' : ''}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}
      {children}
    </section>
  );
}
