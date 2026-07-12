import { useRef } from 'react';
import type { ZoneRecognitionView } from './log-health';

interface CompanionHeaderProps {
  appName: string;
  title: string;
  intro: string;
  status: ZoneRecognitionView;
  busy: boolean;
  labels: {
    info: string;
    community: string;
    support: string;
    settings: string;
    reportIssue: string;
    close: string;
    more: string;
  };
  onInfo: () => void;
  onCommunity: () => void;
  onSupport: () => void;
  onSettings: () => void;
  onReportIssue: () => void;
  onClose: () => void;
}

export function CompanionHeader({
  appName,
  title,
  intro,
  status,
  busy,
  labels,
  onInfo,
  onCommunity,
  onSupport,
  onSettings,
  onReportIssue,
  onClose
}: CompanionHeaderProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const runMenuAction = (action: () => void) => {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
    action();
  };

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
        <button className="companion-header-icon" type="button" title={labels.settings} aria-label={labels.settings} disabled={busy} onClick={onSettings}>⚙</button>
        <details ref={menuRef} className="companion-utility-menu">
          <summary className="companion-header-icon" title={labels.more} aria-label={labels.more}>⋯</summary>
          <div className="companion-utility-popover">
            <button type="button" disabled={busy} onClick={() => runMenuAction(onInfo)}>{labels.info}</button>
            <button type="button" disabled={busy} onClick={() => runMenuAction(onCommunity)}>{labels.community}</button>
            <button type="button" disabled={busy} onClick={() => runMenuAction(onSupport)}>{labels.support}</button>
            <button type="button" disabled={busy} onClick={() => runMenuAction(onReportIssue)}>{labels.reportIssue}</button>
          </div>
        </details>
        <button className="companion-header-icon is-close" type="button" title={labels.close} aria-label={labels.close} onClick={onClose}>×</button>
      </div>
    </header>
  );
}
