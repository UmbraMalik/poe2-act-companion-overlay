import { useRef, type MouseEvent } from 'react';
import { getSettingsSectionLabel, type SettingsSectionId } from '../settings-search';
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
  const quickNavRef = useRef<HTMLElement | null>(null);

  const jumpToSettingsSection = (event: MouseEvent<HTMLAnchorElement>, sectionId: SettingsSectionId) => {
    event.preventDefault();

    const shell = event.currentTarget.closest<HTMLElement>('.settings-shell');
    const target = document.getElementById(sectionId);
    if (!shell || !target) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const quickNavHeight = quickNavRef.current?.getBoundingClientRect().height ?? 0;
    const nextTop = shell.scrollTop + targetRect.top - shellRect.top - quickNavHeight - 14;

    shell.scrollTo({
      top: Math.max(0, nextTop),
      behavior: 'smooth'
    });

    window.history.replaceState(null, '', `#${sectionId}`);
  };

  return (
    <nav ref={quickNavRef} className="settings-card settings-quick-nav" aria-label={title}>
      <h2 className="settings-section-title">{title}</h2>
      <div className="settings-quick-link-grid">
        {entries.map((entry) => (
          <a
            key={entry.id}
            className="settings-quick-link"
            href={`#${entry.id}`}
            onClick={(event) => jumpToSettingsSection(event, entry.id)}
          >
            {getSettingsSectionLabel(entry.id, language)}
          </a>
        ))}
      </div>
      <label className="settings-search-field">
        <span>{searchLabel}</span>
        <input
          type="search"
          value={searchQuery}
          placeholder={searchPlaceholder}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
      </label>
    </nav>
  );
}
