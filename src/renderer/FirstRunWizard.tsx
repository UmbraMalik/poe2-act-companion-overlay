import { useEffect, useMemo, useState } from 'react';
import { translate } from '../i18n/translations';
import type { AppLanguage, AppTheme, OverlaySnapshot } from '../shared/types';

interface FirstRunWizardProps {
  snapshot: OverlaySnapshot;
  language: AppLanguage;
}

const SETUP_WIZARD_STEP_COUNT = 4;

export function FirstRunWizard({ snapshot, language }: FirstRunWizardProps) {
  const [step, setStep] = useState(() => {
    const stored = Number(window.sessionStorage.getItem('poe2-setup-wizard-step'));
    return Number.isInteger(stored) && stored >= 0 && stored < SETUP_WIZARD_STEP_COUNT ? stored : 0;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const { config, currentGuideEntry, currentZone, runtime } = snapshot;
  const hasLogFile = Boolean(runtime.watchedLogPath ?? config.logFilePath);
  const logReady = hasLogFile && runtime.logFileExists;
  const zoneDetected = Boolean(currentGuideEntry ?? currentZone.rawZoneName);
  const hotkeysReady = [config.hotkeys.openCompanion, config.hotkeys.toggleTimerPause]
    .every((value) => value.trim().length > 0);

  useEffect(() => {
    window.sessionStorage.setItem('poe2-setup-wizard-step', String(step));
  }, [step]);

  const readiness = useMemo(() => [
    {
      id: 'log',
      label: translate(language, 'setupWizard.readyLog'),
      ready: logReady,
      detail: logReady
        ? runtime.watchedLogPath ?? config.logFilePath ?? ''
        : translate(language, 'setupWizard.readyLogPending')
    },
    {
      id: 'zone',
      label: translate(language, 'setupWizard.readyClient'),
      ready: zoneDetected,
      detail: zoneDetected
        ? currentGuideEntry?.zone_ru ?? currentZone.rawZoneName ?? ''
        : translate(language, 'setupWizard.readyClientPending')
    },
    {
      id: 'hotkeys',
      label: translate(language, 'setupWizard.readyHotkeys'),
      ready: hotkeysReady,
      detail: `${config.hotkeys.openCompanion} · ${config.hotkeys.toggleTimerPause}`
    }
  ], [
    config.hotkeys.openCompanion,
    config.hotkeys.toggleTimerPause,
    config.logFilePath,
    currentGuideEntry,
    currentZone.rawZoneName,
    hotkeysReady,
    language,
    logReady,
    runtime.watchedLogPath,
    zoneDetected
  ]);

  const runTask = async (name: string, action: () => Promise<unknown>) => {
    try {
      setBusy(name);
      await action();
    } finally {
      setBusy(null);
    }
  };

  const updateLanguage = (appLanguage: AppLanguage) => {
    void window.poe2Overlay.updateSettings({ appLanguage });
  };

  const updateTheme = (theme: AppTheme) => {
    void window.poe2Overlay.updateSettings({ theme, themePreferencePrompted: true });
  };

  const chooseLogFile = () => runTask('log', () => window.poe2Overlay.chooseLogFile());

  const completeWizard = (name: 'finish' | 'skip') => runTask(name, async () => {
    window.sessionStorage.removeItem('poe2-setup-wizard-step');
    await window.poe2Overlay.updateSettings({
      setupWizardCompleted: true,
      themePreferencePrompted: true
    });
  });

  const finish = () => completeWizard('finish');
  const skip = () => completeWizard('skip');

  return (
    <section className="overlay-setup-wizard" role="dialog" aria-modal="true" aria-labelledby="setup-wizard-title">
      <div className="overlay-setup-wizard-head">
        <div>
          <p className="eyebrow">{translate(language, 'setupWizard.kicker')}</p>
          <h2 id="setup-wizard-title">{translate(language, `setupWizard.step${step + 1}Title`)}</h2>
        </div>
        <span>{step + 1}/{SETUP_WIZARD_STEP_COUNT}</span>
      </div>

      <div className="overlay-setup-progress" aria-hidden="true">
        {Array.from({ length: SETUP_WIZARD_STEP_COUNT }, (_, index) => (
          <span key={index} className={index <= step ? 'is-active' : ''} />
        ))}
      </div>

      <div className="overlay-setup-wizard-body no-drag">
        {step === 0 && (
          <div className="overlay-setup-choice-stack">
            <p>{translate(language, 'setupWizard.appearanceBody')}</p>
            <div className="overlay-setup-choice-grid is-language">
              {(['ru', 'en'] as AppLanguage[]).map((appLanguage) => (
                <button
                  key={appLanguage}
                  type="button"
                  className={language === appLanguage ? 'is-selected' : ''}
                  onClick={() => updateLanguage(appLanguage)}
                >
                  {appLanguage.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="overlay-setup-choice-grid is-theme">
              {(['classic', 'dark_fantasy'] as AppTheme[]).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  className={config.theme === theme ? 'is-selected' : ''}
                  onClick={() => updateTheme(theme)}
                >
                  <strong>{translate(language, theme === 'classic' ? 'appTheme.classic' : 'appTheme.darkFantasy')}</strong>
                  <small>{translate(language, `setupWizard.theme.${theme}`)}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="overlay-setup-log-step">
            <p>{translate(language, 'setupWizard.logBody')}</p>
            <div className={`overlay-setup-status-card ${logReady ? 'is-ready' : 'is-pending'}`}>
              <span aria-hidden="true">{logReady ? '✓' : '○'}</span>
              <div>
                <strong>{logReady ? translate(language, 'setupWizard.logReady') : translate(language, 'setupWizard.logPending')}</strong>
                <small>{runtime.watchedLogPath ?? config.logFilePath ?? translate(language, 'overlay.onboardingPath')}</small>
              </div>
            </div>
            <button type="button" className="button-primary" disabled={busy !== null} onClick={() => void chooseLogFile()}>
              {busy === 'log' ? translate(language, 'common.loading') : translate(language, 'settings.chooseLogFile')}
            </button>
            <small>{translate(language, 'setupWizard.logHint')}</small>
          </div>
        )}

        {step === 2 && (
          <div className="overlay-setup-hotkeys">
            <p>{translate(language, 'setupWizard.hotkeysBody')}</p>
            <dl>
              <div><dt>{translate(language, 'settings.hotkeyPause')}</dt><dd>{config.hotkeys.toggleTimerPause}</dd></div>
              <div><dt>{translate(language, 'settings.hotkeyCompanion')}</dt><dd>{config.hotkeys.openCompanion}</dd></div>
            </dl>
            <small>{translate(language, 'setupWizard.hotkeysHint')}</small>
          </div>
        )}

        {step === 3 && (
          <div className="overlay-setup-ready-list">
            <p>{translate(language, 'setupWizard.readyBody')}</p>
            {readiness.map((item) => (
              <div key={item.id} className={item.ready ? 'is-ready' : 'is-pending'}>
                <span aria-hidden="true">{item.ready ? '✓' : '○'}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overlay-setup-wizard-actions no-drag">
        {step > 0 ? (
          <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => setStep((value) => value - 1)}>
            {translate(language, 'common.back')}
          </button>
        ) : (
          <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => void skip()}>
            {translate(language, 'setupWizard.skip')}
          </button>
        )}
        {step < SETUP_WIZARD_STEP_COUNT - 1 ? (
          <button type="button" className="button-primary" disabled={busy !== null} onClick={() => setStep((value) => value + 1)}>
            {translate(language, 'common.next')}
          </button>
        ) : (
          <button type="button" className="button-primary" disabled={busy !== null} onClick={() => void finish()}>
            {busy === 'finish' ? translate(language, 'common.loading') : translate(language, 'setupWizard.finish')}
          </button>
        )}
      </div>
    </section>
  );
}
