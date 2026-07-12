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
          <span className="companion-theme-toggle-indicator" aria-hidden="true" />
          <span className="companion-theme-option is-classic" aria-hidden="true">
            <svg
              className="companion-theme-icon companion-theme-icon-sun"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="3.6" />
              <path d="M12 2.4v2.1M12 19.5v2.1M2.4 12h2.1M19.5 12h2.1M5.2 5.2l1.5 1.5M17.3 17.3l1.5 1.5M18.8 5.2l-1.5 1.5M6.7 17.3l-1.5 1.5" />
            </svg>
          </span>
          <span className="companion-theme-option is-dark-fantasy" aria-hidden="true">
            <svg
              className="companion-theme-icon companion-theme-icon-moon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M20.7 14.3A8.7 8.7 0 0 1 9.7 3.3 8.8 8.8 0 1 0 20.7 14.3Z" />
            </svg>
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
