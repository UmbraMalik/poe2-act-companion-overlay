import { useEffect, useRef, useState } from 'react';
import type { ZoneRecognitionView } from './log-health';
import type { AppTheme } from '../shared/types';

interface CompanionHeaderProps {
  appName: string;
  title: string;
  intro: string;
  status: ZoneRecognitionView;
  theme: AppTheme;
  busy: boolean;
  labels: {
    info: string;
    community: string;
    support: string;
    settings: string;
    reportIssue: string;
    close: string;
    more: string;
    themeToggle: string;
  };
  onInfo: () => void;
  onCommunity: () => void;
  onSupport: () => void;
  onSettings: () => void;
  onToggleTheme: () => void;
  onReportIssue: () => void;
  onClose: () => void;
}

export function CompanionHeader({
  appName,
  title,
  intro,
  status,
  theme,
  busy,
  labels,
  onInfo,
  onCommunity,
  onSupport,
  onSettings,
  onToggleTheme,
  onReportIssue,
  onClose
}: CompanionHeaderProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const runMenuAction = (action: () => void) => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
    setMenuOpen(false);
    action();
  };

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const closeMenu = () => {
      if (menuRef.current) {
        menuRef.current.open = false;
      }
      setMenuOpen(false);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      closeMenu();
      menuRef.current?.querySelector<HTMLElement>('summary')?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', closeMenu);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', closeMenu);
    };
  }, [menuOpen]);

  return (
    <header className="settings-header window-drag-strip companion-header">
      <div className="settings-header-copy companion-header-copy">
        <p className="eyebrow">{appName}</p>
        <h1>{title}</h1>
        <p className="helper-text settings-intro">{intro}</p>
      </div>
      <div className="companion-header-tools no-drag">
        <div className={`companion-log-pill tone-${status.tone}`} title={status.detail}>
          <span aria-hidden="true" />
          <div><strong>{status.label}</strong><small>{status.detail}</small></div>
        </div>
        <button
          className={`companion-theme-toggle is-${theme === 'dark_fantasy' ? 'dark-fantasy' : 'classic'}`}
          type="button"
          title={labels.themeToggle}
          aria-label={labels.themeToggle}
          aria-pressed={theme === 'dark_fantasy'}
          disabled={busy}
          onClick={onToggleTheme}
        >
          <span className="companion-theme-option is-classic" aria-hidden="true">
            <span className="companion-theme-sun" />
          </span>
          <span className="companion-theme-option is-dark-fantasy" aria-hidden="true">
            <span className="companion-theme-moon" />
          </span>
        </button>
        <button className="companion-header-icon is-settings" type="button" title={labels.settings} aria-label={labels.settings} disabled={busy} onClick={onSettings}>
          <span aria-hidden="true">⚙</span>
        </button>
        <details
          ref={menuRef}
          className="companion-utility-menu"
          onToggle={(event) => setMenuOpen(event.currentTarget.open)}
        >
          <summary
            className="companion-header-icon"
            title={labels.more}
            aria-label={labels.more}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true">⋯</span>
          </summary>
          <div className="companion-utility-popover" role="menu">
            <button type="button" role="menuitem" disabled={busy} onClick={() => runMenuAction(onInfo)}>{labels.info}</button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => runMenuAction(onCommunity)}>{labels.community}</button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => runMenuAction(onSupport)}>{labels.support}</button>
            <button type="button" role="menuitem" disabled={busy} onClick={() => runMenuAction(onReportIssue)}>{labels.reportIssue}</button>
          </div>
        </details>
        <button className="companion-header-icon is-close" type="button" title={labels.close} aria-label={labels.close} onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </header>
  );
}
