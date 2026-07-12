import type { ReactNode } from 'react';
import { SettingsWindowResizeGrip } from './settings/SettingsWindowResizeGrip';
import { SettingsWindowShellEffects } from './settings/SettingsWindowShellEffects';

interface UtilityWindowFrameProps {
  appName: string;
  title: string;
  intro: string;
  closeLabel: string;
  visualFxIntensity: string;
  themeClassName: string;
  pageClassName?: string;
  shellClassName?: string;
  children: ReactNode;
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function UtilityWindowFrame({
  appName,
  title,
  intro,
  closeLabel,
  visualFxIntensity,
  themeClassName,
  pageClassName,
  shellClassName,
  children
}: UtilityWindowFrameProps) {
  return (
    <main
      className={joinClassNames(
        'settings-page',
        'utility-window-page',
        `fx-${visualFxIntensity}`,
        themeClassName,
        pageClassName
      )}
    >
      <header className="settings-header window-drag-strip utility-window-header">
        <div className="settings-header-copy">
          <p className="eyebrow">{appName}</p>
          <h1>{title}</h1>
          <p className="helper-text settings-intro">{intro}</p>
        </div>
        <button
          className="button-secondary no-drag utility-window-close"
          type="button"
          onClick={() => window.close()}
        >
          {closeLabel}
        </button>
      </header>

      <section className={joinClassNames('settings-shell', 'utility-window-shell', shellClassName)}>
        {children}
      </section>

      <SettingsWindowShellEffects />
      <SettingsWindowResizeGrip />
    </main>
  );
}
