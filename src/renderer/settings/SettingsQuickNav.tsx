import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  getSettingsGroupLabel,
  getSettingsSectionLabel,
  SETTINGS_SECTIONS,
  type SettingsGroupId,
  type SettingsSectionId
} from '../settings-search';
import type { AppLanguage } from '../../shared/types';

type SettingsQuickNavEntry = {
  id: SettingsSectionId;
};

type SettingsQuickNavProps = {
  entries: SettingsQuickNavEntry[];
  language: AppLanguage;
  title: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
};

export function SettingsQuickNav({
  entries,
  language,
  title,
  searchLabel,
  searchPlaceholder,
  searchQuery,
  onSearchQueryChange
}: SettingsQuickNavProps) {
  const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId | null>(null);
  const groupedEntries = useMemo(() => {
    const visibleIds = new Set(entries.map((entry) => entry.id));
    const groups = new Map<SettingsGroupId, SettingsSectionId[]>();

    for (const section of SETTINGS_SECTIONS) {
      if (!visibleIds.has(section.id)) {
        continue;
      }
      const group = groups.get(section.groupId) ?? [];
      group.push(section.id);
      groups.set(section.groupId, group);
    }

    return Array.from(groups, ([id, sectionIds]) => ({ id, sectionIds }));
  }, [entries]);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>('.settings-content');
    if (!content) {
      return undefined;
    }

    const updateActiveSection = () => {
      const contentTop = content.getBoundingClientRect().top;
      const visibleSections = entries
        .map((entry) => document.getElementById(entry.id))
        .filter((section): section is HTMLElement => Boolean(section && !section.hidden));
      const current = visibleSections.reduce<HTMLElement | null>((active, section) => {
        if (section.getBoundingClientRect().top <= contentTop + 38) {
          return section;
        }
        return active;
      }, null) ?? visibleSections[0];

      setActiveSectionId((current?.id ?? null) as SettingsSectionId | null);
    };

    updateActiveSection();
    content.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => content.removeEventListener('scroll', updateActiveSection);
  }, [entries]);

  const jumpToSettingsSection = (event: MouseEvent<HTMLAnchorElement>, sectionId: SettingsSectionId) => {
    event.preventDefault();

    const content = event.currentTarget.closest('.settings-shell')?.querySelector<HTMLElement>('.settings-content');
    const target = document.getElementById(sectionId);
    if (!content || !target || target.hidden) {
      return;
    }

    const contentRect = content.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    content.scrollTo({
      top: Math.max(0, content.scrollTop + targetRect.top - contentRect.top - 12),
      behavior: 'smooth'
    });
    setActiveSectionId(sectionId);
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  return (
    <nav className="settings-card settings-quick-nav settings-sidebar-nav" aria-label={title}>
      <h2 className="settings-section-title">{title}</h2>
      <label className="settings-search-field">
        <span>{searchLabel}</span>
        <input
          type="search"
          value={searchQuery}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
      <div className="settings-quick-link-grid settings-sidebar-groups">
        {groupedEntries.map((group) => (
          <div className="settings-sidebar-group" key={group.id}>
            <h3 className="settings-sidebar-group-title">{getSettingsGroupLabel(group.id, language)}</h3>
            <div className="settings-sidebar-links">
              {group.sectionIds.map((sectionId) => (
                <a
                  key={sectionId}
                  className={`settings-quick-link${activeSectionId === sectionId ? ' is-active' : ''}`}
                  href={`#${sectionId}`}
                  aria-current={activeSectionId === sectionId ? 'location' : undefined}
                  onClick={(event) => jumpToSettingsSection(event, sectionId)}
                >
                  {getSettingsSectionLabel(sectionId, language)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
