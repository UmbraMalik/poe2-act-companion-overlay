import { useEffect, useMemo, useState } from 'react';
import { translate } from '../i18n/translations';
import type { AppLanguage, AppTheme, CampaignLeague, OverlaySnapshot } from '../shared/types';
import { UiIcon } from './UiIcon';

interface FirstRunWizardProps {
  snapshot: OverlaySnapshot;
  language: AppLanguage;
}

interface CampaignLeaguePromptProps {
  snapshot: OverlaySnapshot;
  language: AppLanguage;
}

const SETUP_WIZARD_STEP_COUNT = 5;
const CAMPAIGN_LEAGUE_OPTIONS: CampaignLeague[] = [
  'forbidden_rites',
  'runes_of_aldur',
  'standard'
];

function getCampaignLeagueLabel(language: AppLanguage, league: CampaignLeague): string {
  return translate(language, `setupWizard.leagueOptions.${league}`);
}

function CampaignLeagueChoices({
  language,
  selectedLeague,
  disabled,
  onChange
}: {
  language: AppLanguage;
  selectedLeague: CampaignLeague | null;
  disabled?: boolean;
  onChange: (league: CampaignLeague) => void;
}) {
  return (
    <div className="overlay-setup-choice-grid is-league">
      {CAMPAIGN_LEAGUE_OPTIONS.map((league) => (
        <button
          key={league}
          type="button"
          className={selectedLeague === league ? 'is-selected' : ''}
          aria-pressed={selectedLeague === league}
          disabled={disabled}
          onClick={() => onChange(league)}
        >
          <strong>{getCampaignLeagueLabel(language, league)}</strong>
          <small>{translate(language, `setupWizard.leagueDescriptions.${league}`)}</small>
        </button>
      ))}
    </div>
  );
}

export function CampaignLeaguePrompt({ snapshot, language }: CampaignLeaguePromptProps) {
  const [selectedLeague, setSelectedLeague] = useState<CampaignLeague | null>(snapshot.config.campaignLeague);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selectedLeague || busy) {
      return;
    }

    try {
      setBusy(true);
      await window.poe2Overlay.updateSettings({ campaignLeague: selectedLeague });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overlay-setup-wizard" role="dialog" aria-modal="true" aria-labelledby="campaign-league-prompt-title">
      <div className="overlay-setup-wizard-head">
        <div>
          <p className="eyebrow">{translate(language, 'setupWizard.leaguePromptKicker')}</p>
          <h2 id="campaign-league-prompt-title">{translate(language, 'setupWizard.leaguePromptTitle')}</h2>
        </div>
      </div>

      <div className="overlay-setup-wizard-body no-drag">
        <div className="overlay-setup-choice-stack">
          <p>{translate(language, 'setupWizard.leaguePromptBody')}</p>
          <CampaignLeagueChoices
            language={language}
            selectedLeague={selectedLeague}
            disabled={busy}
            onChange={setSelectedLeague}
          />
          <small>{translate(language, 'setupWizard.leagueHint')}</small>
        </div>
      </div>

      <div className="overlay-setup-wizard-actions no-drag">
        <span />
        <button
          type="button"
          className="button-primary"
          disabled={!selectedLeague || busy}
          onClick={() => void save()}
        >
          {busy ? translate(language, 'common.loading') : translate(language, 'setupWizard.leaguePromptSave')}
        </button>
      </div>
    </section>
  );
}

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
      id: 'league',
      label: translate(language, 'setupWizard.readyLeague'),
      ready: config.campaignLeague !== null,
      detail: config.campaignLeague
        ? getCampaignLeagueLabel(language, config.campaignLeague)
        : translate(language, 'setupWizard.readyLeaguePending')
    },
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
    config.campaignLeague,
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

  const updateLeague = (campaignLeague: CampaignLeague) => {
    void window.poe2Overlay.updateSettings({ campaignLeague });
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
          <div className="overlay-setup-choice-stack">
            <p>{translate(language, 'setupWizard.leagueBody')}</p>
            <CampaignLeagueChoices
              language={language}
              selectedLeague={config.campaignLeague}
              disabled={busy !== null}
              onChange={updateLeague}
            />
            <small>{translate(language, 'setupWizard.leagueHint')}</small>
          </div>
        )}

        {step === 2 && (
          <div className="overlay-setup-log-step">
            <p>{translate(language, 'setupWizard.logBody')}</p>
            <div className={`overlay-setup-status-card ${logReady ? 'is-ready' : 'is-pending'}`}>
              <UiIcon name={logReady ? 'check' : 'circle'} className="ui-status-icon" />
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

        {step === 3 && (
          <div className="overlay-setup-hotkeys">
            <p>{translate(language, 'setupWizard.hotkeysBody')}</p>
            <dl>
              <div><dt>{translate(language, 'settings.hotkeyPause')}</dt><dd>{config.hotkeys.toggleTimerPause}</dd></div>
              <div><dt>{translate(language, 'settings.hotkeyCompanion')}</dt><dd>{config.hotkeys.openCompanion}</dd></div>
            </dl>
            <small>{translate(language, 'setupWizard.hotkeysHint')}</small>
          </div>
        )}

        {step === 4 && (
          <div className="overlay-setup-ready-list">
            <p>{translate(language, 'setupWizard.readyBody')}</p>
            {readiness.map((item) => (
              <div key={item.id} className={item.ready ? 'is-ready' : 'is-pending'}>
                <UiIcon name={item.ready ? 'check' : 'circle'} className="ui-status-icon" />
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
          <button
            type="button"
            className="button-primary"
            disabled={busy !== null || (step === 1 && config.campaignLeague === null)}
            onClick={() => setStep((value) => value + 1)}
          >
            {translate(language, 'common.next')}
          </button>
        ) : (
          <button
            type="button"
            className="button-primary"
            disabled={busy !== null || config.campaignLeague === null}
            onClick={() => void finish()}
          >
            {busy === 'finish' ? translate(language, 'common.loading') : translate(language, 'setupWizard.finish')}
          </button>
        )}
      </div>
    </section>
  );
}
