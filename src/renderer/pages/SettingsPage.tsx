import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useAppSnapshot, useLiveRunTimer } from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import {
  getCurrentActElapsedMs,
  getSceneDisplayName
} from '../companion-helpers';
import {
  formatDuration,
  formatFileSize,
  formatGuideLabel,
  getReleaseNoteItems,
  formatTimestamp,
  formatZoneOption
} from '../utils';
import { getLevelReminderView } from '../../i18n/data';
import { formatZoneMatcherReason, translateSystemText } from '../../i18n/runtime';
import { translate } from '../../i18n/translations';
import { getAppThemeClassName } from '../theme';
import { SettingsSelect } from '../settings/SettingsSelect';
import {
  buildOverlayPresetPatch,
  formatOverlayPresetLabel,
  formatOverlayPresetState,
  formatOverlayPresetTitle,
  getMatchingOverlayPreset,
  OVERLAY_PRESET_IDS,
  type OverlayPresetId
} from '../overlay-presets';
import {
  getSettingsGroupLabel,
  getSettingsSearchEmptyText,
  getSettingsSearchLabel,
  getSettingsSearchPlaceholder,
  getSettingsSearchResult,
  getSettingsSectionLabel,
  SETTINGS_QUICK_LINKS,
  type SettingsGroupId,
  type SettingsSectionId
} from '../settings-search';
import type {
  AppTheme,
  AppLanguage,
  HotkeySettings,
  OverlayDensity,
  OverlayScale,
  OverlayTextSize,
  OverlayVisibleSections,
  RunTimerAutoStartMode,
  RunTimerStatus,
  VisualFxIntensity,
  UpdateCheckResult,
  AutoUpdateState
} from '../../shared/types';

const SHOW_DEVELOPER_SETTINGS = import.meta.env.DEV;

function getDefaultDevLine(language: AppLanguage): string {
  return language === 'en'
    ? '2026/05/12 12:00:00 You have entered area: Grelwood'
    : '2026/05/12 12:00:00 Вы вошли в область: Грельвуд';
}

function getDefaultRewardLine(language: AppLanguage): string {
  return language === 'en'
    ? 'Player has received +10% to [Resistances|Cold].'
    : 'Игрок получил +10% к сопротивлению [Resistances|холоду].';
}

const DEFAULT_HOTKEYS: HotkeySettings = {
  markChecklistDone: 'F6',
  undoChecklistMark: 'F7',
  toggleTimerPause: 'F8',
  openCompanion: 'F9',
  toggleOverlayMode: 'F10'
};

const HOTKEY_LABELS: Array<{ key: keyof HotkeySettings; labelKey: string; noteKey: string }> = [
  { key: 'toggleTimerPause', labelKey: 'settings.hotkeyPause', noteKey: 'settings.hotkeyAlways' },
  { key: 'openCompanion', labelKey: 'settings.hotkeyCompanion', noteKey: 'settings.hotkeyAlways' },
  { key: 'toggleOverlayMode', labelKey: 'settings.hotkeyOverlayMode', noteKey: 'settings.hotkeyAlways' }
];

const OVERLAY_SECTION_VISIBILITY_LABELS = [
  ['nearby', 'settings.overlayShowNearby'],
  ['zoneInfo', 'settings.overlayShowZoneInfo'],
  ['zoneBonuses', 'settings.overlayShowZoneBonuses'],
  ['league', 'settings.overlayShowLeague'],
  ['next', 'settings.overlayShowNext'],
  ['skip', 'settings.overlayShowSkip'],
  ['speedrun', 'settings.overlayShowSpeedrun'],
  ['important', 'settings.overlayShowImportant']
] as const;

function hotkeyFromKeyboardEvent(event: KeyboardEvent<HTMLInputElement>): string | null {
  const key = event.key;
  if (!key || key === 'Control' || key === 'Shift' || key === 'Alt' || key === 'Meta') {
    return null;
  }

  if (key === 'Escape') {
    event.currentTarget.blur();
    return null;
  }

  if (key === 'Backspace' || key === 'Delete') {
    return '';
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push('Ctrl');
  }
  if (event.altKey) {
    parts.push('Alt');
  }
  if (event.shiftKey) {
    parts.push('Shift');
  }

  let normalizedKey = key.length === 1 ? key.toUpperCase() : key;
  if (normalizedKey === ' ') {
    normalizedKey = 'Space';
  }

  const isFunctionKey = /^F(?:[1-9]|1[0-9]|2[0-4])$/.test(normalizedKey.toUpperCase());
  const isSimpleKey = /^[A-Z0-9]$/.test(normalizedKey.toUpperCase()) || normalizedKey === 'Space';

  if (!isFunctionKey && !isSimpleKey) {
    return null;
  }

  if (!isFunctionKey && parts.length === 0) {
    // Bare letters/numbers would hijack typing globally. Require Ctrl/Alt/Shift for them.
    return null;
  }

  return [...parts, normalizedKey.toUpperCase()].join('+');
}


function formatDateTimeLocalInput(
  timestamp: number | null,
  fallbackLabel: string | null
): string {
  if (fallbackLabel) {
    return fallbackLabel;
  }

  if (timestamp === null) {
    return '';
  }

  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRunTimerStatus(status: RunTimerStatus, language: AppLanguage): string {
  switch (status) {
    case 'armed':
      return translate(language, 'companion.runStatus.armed');
    case 'running':
      return translate(language, 'companion.runStatus.running');
    case 'paused':
      return translate(language, 'companion.runStatus.paused');
    case 'finished':
      return translate(language, 'companion.runStatus.finished');
    default:
      return translate(language, 'companion.runStatus.idle');
  }
}

function formatOverlayDensity(value: OverlayDensity, language: AppLanguage): string {
  switch (value) {
    case 'compact':
      return translate(language, 'overlayDensity.compact');
    case 'detailed':
      return translate(language, 'overlayDensity.detailed');
    default:
      return translate(language, 'overlayDensity.normal');
  }
}

function formatOverlayTextSize(value: OverlayTextSize, language: AppLanguage): string {
  if (value === 0) {
    return translate(language, 'overlayTextSize.normal');
  }

  return translate(language, 'overlayTextSize.plus', { value });
}

function formatVisualFxIntensity(value: VisualFxIntensity, language: AppLanguage): string {
  switch (value) {
    case 'off':
      return translate(language, 'visualFxIntensity.off');
    case 'subtle':
      return translate(language, 'visualFxIntensity.subtle');
    case 'rich':
      return translate(language, 'visualFxIntensity.rich');
    default:
      return translate(language, 'visualFxIntensity.normal');
  }
}

function formatAppTheme(value: AppTheme, language: AppLanguage): string {
  return translate(language, value === 'dark_fantasy' ? 'appTheme.darkFantasy' : 'appTheme.classic');
}

function formatLogSelectionMode(mode: 'auto' | 'manual' | null, language: AppLanguage): string {
  switch (mode) {
    case 'auto':
      return translate(language, 'logSelectionMode.auto');
    case 'manual':
      return translate(language, 'logSelectionMode.manual');
    default:
      return translate(language, 'logSelectionMode.legacy');
  }
}

function InfoGrid({
  items
}: {
  items: Array<{
    label: string;
    value: ReactNode;
  }>;
}) {
  return (
    <dl className="info-grid">
      {items.map((item) => (
        <div className="info-cell" key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsPage() {
  const snapshot = useAppSnapshot();
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const liveRunTimer = useLiveRunTimer(
    snapshot?.config.runTimer,
    snapshot?.config.runTimerSettings,
    snapshot?.runtime.timerNowMs,
    32,
    snapshot ? {
      overlayMode: snapshot.runtime.overlayMode,
      zoneName: snapshot.currentGuideEntry?.zone_ru ?? snapshot.currentZone.rawZoneName ?? null,
      act: snapshot.currentGuideEntry?.act ?? snapshot.currentZone.actHint ?? null,
      component: 'settings-live-timer'
    } : undefined
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [simulateZone, setSimulateZone] = useState('');
  const [devLogLine, setDevLogLine] = useState(() => getDefaultDevLine('ru'));
  const [leagueStartDraft, setLeagueStartDraft] = useState('');
  const [hotkeyDrafts, setHotkeyDrafts] = useState<HotkeySettings>(DEFAULT_HOTKEYS);
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<'idle' | 'saved'>('idle');
  const [appVersion, setAppVersion] = useState('');
  const [updateCheckResult, setUpdateCheckResult] = useState<UpdateCheckResult | null>(null);
  const [autoUpdateState, setAutoUpdateState] = useState<AutoUpdateState | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateActionBusy, setUpdateActionBusy] = useState<'download' | 'install' | 'release' | null>(null);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');

  useDocumentTitle(t('titles.settings'));

  useEffect(() => {
    let isActive = true;

    void window.poe2Overlay.getAppVersion().then((version) => {
      if (isActive) {
        setAppVersion(version);
      }
    });

    void window.poe2Overlay.getCachedUpdateCheckResult().then((result) => {
      if (isActive && result?.status === 'available') {
        setUpdateCheckResult(result);
      }
    });

    void window.poe2Overlay.getAutoUpdateState().then((state) => {
      if (isActive) {
        setAutoUpdateState(state);
      }
    });

    const unsubscribeAutoUpdate = window.poe2Overlay.onAutoUpdateChanged((state) => {
      setAutoUpdateState(state);
    });

    return () => {
      isActive = false;
      unsubscribeAutoUpdate();
    };
  }, []);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setHotkeyDrafts({
      ...DEFAULT_HOTKEYS,
      ...(snapshot.config.hotkeys ?? {})
    });
  }, [
    snapshot?.config.hotkeys?.markChecklistDone,
    snapshot?.config.hotkeys?.undoChecklistMark,
    snapshot?.config.hotkeys?.toggleTimerPause,
    snapshot?.config.hotkeys?.openCompanion,
    snapshot?.config.hotkeys?.toggleOverlayMode
  ]);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLeagueStartDraft(
      formatDateTimeLocalInput(
        snapshot.config.runTimerSettings.leagueStartAt,
        snapshot.config.runTimerSettings.leagueStartTimeLabel
      )
    );
  }, [
    snapshot?.config.runTimerSettings.leagueStartAt,
    snapshot?.config.runTimerSettings.leagueStartTimeLabel
  ]);

  const zoneOptions = useMemo(
    () => (snapshot?.guideEntries ?? []).map((entry) => ({
      value: entry.id,
      label: formatZoneOption(entry, language)
    })),
    [snapshot?.guideEntries, language]
  );
  const settingsSearch = useMemo(
    () => getSettingsSearchResult(settingsSearchQuery, SHOW_DEVELOPER_SETTINGS),
    [settingsSearchQuery]
  );
  const settingsQuickLinks = useMemo(
    () => SETTINGS_QUICK_LINKS.filter((entry) => settingsSearch.visibleSectionIds.has(entry.id)),
    [settingsSearch.visibleSectionIds]
  );

  if (!snapshot) {
    return <div className="settings-shell">{t('settings.loading')}</div>;
  }

  const { config, currentGuideEntry, currentZone, runtime, activeLevelReminder } = snapshot;
  const appLanguage = language;
  const isSettingsSectionVisible = (id: SettingsSectionId) => settingsSearch.visibleSectionIds.has(id);
  const groupTitle = (groupId: SettingsGroupId) => settingsSearch.visibleGroupIds.has(groupId)
    ? <h2 className="settings-task-group-title">{getSettingsGroupLabel(groupId, appLanguage)}</h2>
    : null;
  const displayRunTimer = liveRunTimer.runTimer ?? config.runTimer;
  const currentGuide = currentGuideEntry;
  const activeLevelReminderView = getLevelReminderView(activeLevelReminder, appLanguage);
  const displayElapsedMs = liveRunTimer.runElapsedMs;
  const currentActElapsedMs = getCurrentActElapsedMs(
    displayRunTimer,
    currentGuide,
    liveRunTimer.nowMs
  );
  const currentCountdownMs = liveRunTimer.countdownMs;
  const sceneName = getSceneDisplayName(snapshot, appLanguage);
  const activeOverlayPreset = getMatchingOverlayPreset(config);
  const overlayPresetTitle = formatOverlayPresetTitle(appLanguage);
  const hasSelectedLogFile = Boolean(runtime.watchedLogPath ?? config.logFilePath);
  const logFileStatusText = !hasSelectedLogFile
    ? t('settings.logStatusPending')
    : runtime.logFileExists
      ? t('settings.logStatusReady')
      : t('settings.logStatusMissing');
  const logFileStatusTone = !hasSelectedLogFile
    ? 'is-pending'
    : runtime.logFileExists
      ? 'is-success'
      : 'is-warning';
  const autoUpdateStatus = autoUpdateState?.status ?? 'idle';
  const updateReleaseNoteItems = getReleaseNoteItems(autoUpdateState?.releaseNotes ?? '');
  const updateProgress = autoUpdateState?.downloadProgress ?? null;
  const updateErrorText =
    (autoUpdateState?.errorMessage
      ? translateSystemText(autoUpdateState.errorMessage, appLanguage)
      : null) ??
    t('settings.updateErrorDetails');
  const logWatcherMessage = translateSystemText(runtime.logWatcherMessage, appLanguage);
  const updateStatusText = isCheckingUpdates
    ? t('settings.updateChecking')
    : autoUpdateStatus === 'available' && autoUpdateState?.latestVersion
      ? t('settings.updateAvailable', { version: autoUpdateState.latestVersion })
      : autoUpdateStatus === 'downloading'
        ? t('settings.updateDownloading', {
            percent: updateProgress ? Math.round(updateProgress.percent) : '...'
          })
        : autoUpdateStatus === 'downloaded'
          ? t('settings.updateDownloaded')
          : autoUpdateStatus === 'not_available'
            ? t('settings.updateReady')
            : autoUpdateStatus === 'error'
              ? t('settings.updateError')
              : t('settings.updateIdle');
  const updateStatusTone = isCheckingUpdates
    ? 'is-pending'
    : autoUpdateStatus === 'available' || autoUpdateStatus === 'downloaded' || autoUpdateStatus === 'downloading'
      ? 'is-warning'
      : autoUpdateStatus === 'not_available'
        ? 'is-success'
        : autoUpdateStatus === 'error'
        ? 'is-warning'
          : 'is-pending';
  const runTask = async (name: string, action: () => Promise<unknown>) => {
    try {
      setBusy(name);
      await action();
    } finally {
      setBusy(null);
    }
  };

  const applyOverlayPreset = async (presetId: OverlayPresetId) => {
    await runTask(`overlay-preset-${presetId}`, async () => {
      await window.poe2Overlay.updateSettings(buildOverlayPresetPatch(presetId));
    });
  };


  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdates(true);
      const state = await window.poe2Overlay.checkAutoUpdate();
      setAutoUpdateState(state);
      setAppVersion(state.currentVersion);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const downloadAutoUpdate = async () => {
    try {
      setUpdateActionBusy('download');
      const state = await window.poe2Overlay.downloadAutoUpdate();
      setAutoUpdateState(state);
    } finally {
      setUpdateActionBusy(null);
    }
  };

  const installAutoUpdate = async () => {
    try {
      setUpdateActionBusy('install');
      const started = await window.poe2Overlay.installAutoUpdate();
      if (!started) {
        setUpdateActionBusy(null);
      }
    } catch {
      setUpdateActionBusy(null);
    }
  };

  const openReleasePage = async (url: string) => {
    try {
      setUpdateActionBusy('release');
      await window.poe2Overlay.openReleasePage(url);
    } finally {
      setUpdateActionBusy(null);
    }
  };


  const updateHotkeyDraft = (key: keyof HotkeySettings, value: string) => {
    setHotkeySaveStatus('idle');
    setHotkeyDrafts((current) => ({
      ...current,
      [key]: value
    }));
  };

  const saveHotkeys = async () => {
    await runTask('save-hotkeys', async () => {
      const normalizedHotkeys = Object.fromEntries(
        Object.entries(hotkeyDrafts).map(([key, value]) => [key, String(value ?? '').trim()])
      ) as HotkeySettings;
      setHotkeyDrafts(normalizedHotkeys);
      await window.poe2Overlay.updateSettings({
        hotkeys: normalizedHotkeys
      });
      setHotkeySaveStatus('saved');
    });
  };

  const resetHotkeys = () => {
    setHotkeySaveStatus('idle');
    setHotkeyDrafts(DEFAULT_HOTKEYS);
  };

  const resetAndSaveHotkeys = async () => {
    setHotkeyDrafts(DEFAULT_HOTKEYS);
    await runTask('reset-hotkeys', async () => {
      await window.poe2Overlay.updateSettings({
        hotkeys: DEFAULT_HOTKEYS
      });
      setHotkeySaveStatus('saved');
    });
  };

  const chooseLogFile = async () => {
    await runTask('choose-log-file', async () => {
      await window.poe2Overlay.chooseLogFile();
    });
  };

  const saveLeagueStartSettings = async () => {
    const leagueStartAt = leagueStartDraft ? new Date(leagueStartDraft).getTime() : null;
    await window.poe2Overlay.updateSettings({
      runTimerSettings: {
        leagueStartAt: Number.isFinite(leagueStartAt ?? Number.NaN) ? leagueStartAt : null,
        leagueStartTimeLabel: leagueStartDraft || null
      }
    });
  };

  const timerButtons = (() => {
    if (displayRunTimer.status === 'not_started') {
      return (
        <>
          {config.runTimerSettings.autoStartMode === 'scheduled_time' && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null || !leagueStartDraft}
              onClick={() =>
                runTask('arm-run-timer', async () => {
                  await saveLeagueStartSettings();
                  await window.poe2Overlay.armRunTimer();
                })
              }
            >
              {t('settings.armTimer')}
            </button>
          )}
          <button
            type="button"
            className="button-primary"
            disabled={busy !== null}
            onClick={() =>
              runTask('start-run-timer', async () => {
                await window.poe2Overlay.startRunTimer();
              })
            }
            >
            {t('common.start')}
          </button>
        </>
      );
    }

    if (displayRunTimer.status === 'armed') {
      return (
        <>
          <button
            type="button"
            className="button-primary"
            disabled={busy !== null}
            onClick={() =>
              runTask('start-run-timer', async () => {
                await window.poe2Overlay.startRunTimer();
              })
            }
          >
            {t('common.start')}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-run-timer', async () => {
                await window.poe2Overlay.resetRunTimer();
              })
            }
          >
            {t('common.reset')}
          </button>
        </>
      );
    }

    if (displayRunTimer.status === 'running') {
      return (
        <>
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('pause-run-timer', async () => {
                await window.poe2Overlay.pauseRunTimer();
              })
            }
          >
            {t('common.pause')}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('finish-run-timer', async () => {
                await window.poe2Overlay.finishRunTimer();
              })
            }
          >
            {t('common.finish')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-run-timer', async () => {
                await window.poe2Overlay.resetRunTimer();
              })
            }
          >
            {t('common.reset')}
          </button>
        </>
      );
    }

    if (displayRunTimer.status === 'paused') {
      return (
        <>
          <button
            type="button"
            className="button-primary"
            disabled={busy !== null}
            onClick={() =>
              runTask('resume-run-timer', async () => {
                await window.poe2Overlay.resumeRunTimer();
              })
            }
          >
            {t('common.resume')}
          </button>
          <button
            type="button"
            className="button-danger"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-run-timer', async () => {
                await window.poe2Overlay.resetRunTimer();
              })
            }
          >
            {t('common.reset')}
          </button>
        </>
      );
    }

    return (
      <button
        type="button"
        className="button-danger"
        disabled={busy !== null}
        onClick={() =>
          runTask('reset-run-timer', async () => {
            await window.poe2Overlay.resetRunTimer();
          })
        }
      >
        {t('common.reset')}
      </button>
    );
  })();

  return (
    <main className={`settings-page fx-${config.visualFxIntensity} ${getAppThemeClassName(config.theme)}`}>
      <header className="settings-header window-drag-strip">
        <div className="settings-header-copy">
          <p className="eyebrow">{t('common.appName')}</p>
          <h1>{t('settings.title')}</h1>
          <p className="helper-text settings-intro">{t('settings.intro')}</p>
        </div>
        <button
          className="button-secondary no-drag"
          type="button"
          onClick={() => window.close()}
        >
          {t('common.close')}
        </button>
      </header>

      <section className="settings-shell">
        <nav className="settings-card settings-quick-nav" aria-label={t('settings.quickLinksTitle')}>
          <h2 className="settings-section-title">{t('settings.quickLinksTitle')}</h2>
          <div className="settings-quick-link-grid">
            {settingsQuickLinks.map((entry) => (
              <a key={entry.id} className="settings-quick-link" href={`#${entry.id}`}>
                {getSettingsSectionLabel(entry.id, appLanguage)}
              </a>
            ))}
          </div>
          <label className="settings-search-field">
            <span>{getSettingsSearchLabel(appLanguage)}</span>
            <input
              type="search"
              value={settingsSearchQuery}
              placeholder={getSettingsSearchPlaceholder(appLanguage)}
              onChange={(event) => setSettingsSearchQuery(event.target.value)}
            />
          </label>
        </nav>

        {settingsSearch.isFiltering && settingsSearch.visibleSectionIds.size === 0 && (
          <section className="settings-card settings-search-empty">
            <p className="helper-text">{getSettingsSearchEmptyText(appLanguage)}</p>
          </section>
        )}

        {groupTitle('first_run')}
        <section id="settings-first-run" className="settings-card first-run-card" hidden={!isSettingsSectionVisible('settings-first-run')}>
          <div className="settings-card-header">
            <h2 className="settings-section-title">{t('settings.firstRunTitle')}</h2>
            <span className={`settings-status-pill ${logFileStatusTone}`}>{logFileStatusText}</span>
          </div>
          <ol className="settings-step-list">
            <li>{t('settings.firstRunStepChoose')}</li>
            <li>
              {t('settings.firstRunStepPointTo')}
              <code className="settings-inline-path">Path of Exile 2/logs/LatestClient.txt</code>
            </li>
            <li>{t('settings.firstRunStepEnterZone')}</li>
            <li>{t('settings.firstRunStepMoveOverlay')}</li>
          </ol>
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() => {
                void chooseLogFile();
              }}
            >
              {t('settings.chooseLogFile')}
            </button>
          </div>
        </section>

        <section id="settings-language" className="settings-card i18n-language-card" data-i18n-language-card="true" hidden={!isSettingsSectionVisible('settings-language')}>
          <h2 className="settings-section-title">{t('settings.languageTitle')}</h2>
          <p className="helper-text">{t('settings.languageDescription')}</p>
          <div className="settings-grid">
            <label className="settings-field">
              <span>{t('settings.languageField')}</span>
              <SettingsSelect
                ariaLabel={t('settings.languageField')}
                value={appLanguage}
                options={[
                  { value: 'ru', label: t('common.russian') },
                  { value: 'en', label: t('common.english') }
                ]}
                onChange={(nextLanguage) => {
                  void window.poe2Overlay.updateSettings({
                    appLanguage: nextLanguage === 'en' ? 'en' : 'ru'
                  });
                }}
              />
            </label>
          </div>
        </section>

        <section id="settings-updates" className="settings-card" hidden={!isSettingsSectionVisible('settings-updates')}>
          <div className="settings-card-header">
            <div>
              <h2 className="settings-section-title">{t('settings.updateTitle')}</h2>
              <p className="helper-text">{t('settings.updateDescription')}</p>
              <p className="helper-text">{t('update.vpnHint')}</p>
            </div>
            <span className={`settings-status-pill ${updateStatusTone}`}>{updateStatusText}</span>
          </div>

          <div className="update-summary-grid">
            <div className="value-box">
              <strong>{t('settings.currentVersion')}: </strong>
              <span>{appVersion || autoUpdateState?.currentVersion || '—'}</span>
            </div>
            <div className="value-box">
              <strong>{t('common.status')}: </strong>
              <span>{updateStatusText}</span>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={isCheckingUpdates || autoUpdateStatus === 'downloading'}
              onClick={() => {
                void checkForUpdates();
              }}
            >
              {isCheckingUpdates ? t('settings.updateChecking') : t('settings.checkUpdates')}
            </button>
          </div>

          {autoUpdateStatus === 'not_available' && (
            <p className="update-inline-message is-success">{t('settings.updateReady')}</p>
          )}

          {autoUpdateStatus === 'error' && (
            <div className="update-inline-message is-warning">
              <p>{updateErrorText}</p>
              <p className="update-vpn-hint">{t('update.vpnHint')}</p>
              <div className="button-row update-error-actions">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={updateActionBusy !== null}
                  onClick={() => {
                    void openReleasePage('https://github.com/UmbraMalik/poe2-act-companion-overlay/releases/latest');
                  }}
                >
                  {updateActionBusy === 'release' ? t('settings.openingRelease') : t('settings.releasePage')}
                </button>
              </div>
            </div>
          )}

          {(autoUpdateStatus === 'available' || autoUpdateStatus === 'downloading' || autoUpdateStatus === 'downloaded') && (
            <section className="update-result-card">
              <div className="settings-card-header settings-card-header-compact">
                <div>
                  <h3>{t('settings.updateAvailableTitle', { version: autoUpdateState?.latestVersion ?? '—' })}</h3>
                  <p className="helper-text">{autoUpdateState?.releaseName ?? 'POE2 Act Companion Overlay'}</p>
                </div>
              </div>

              <InfoGrid
                items={[
                  { label: t('settings.currentVersion'), value: autoUpdateState?.currentVersion ?? appVersion ?? '—' },
                  { label: t('settings.releaseVersion'), value: autoUpdateState?.latestVersion ?? '—' },
                  { label: t('update.release'), value: autoUpdateState?.releaseName ?? '—' },
                  { label: t('settings.releasePublished'), value: formatTimestamp(autoUpdateState?.releaseDate ?? null, appLanguage) }
                ]}
              />

              {autoUpdateStatus === 'downloading' && updateProgress && (
                <section className="update-progress-card">
                  <div className="update-progress-header">
                    <strong>{t('update.downloadTitle')}</strong>
                    <span>{Math.round(updateProgress.percent)}%</span>
                  </div>
                  <div className="update-progress-track" aria-label={t('update.progress')}>
                    <span style={{ width: `${Math.max(0, Math.min(100, updateProgress.percent))}%` }} />
                  </div>
                  <p className="helper-text">
                    {formatFileSize(updateProgress.transferred)} / {formatFileSize(updateProgress.total)}
                  </p>
                </section>
              )}

              {autoUpdateStatus === 'downloaded' && (
                <p className="update-inline-message is-success">
                  {t('settings.updateDownloaded')}
                </p>
              )}

              <div className="settings-subsection">
                <h3 className="settings-subtitle">{t('settings.releaseNotes')}</h3>
                {updateReleaseNoteItems.length > 0 ? (
                  <div className="update-note-list">
                    {updateReleaseNoteItems.map((item, index) => (
                      <p
                        className={`update-note-item is-${item.kind}`}
                        key={`${item.kind}-${index}-${item.text}`}
                      >
                        {item.kind === 'item' ? <span aria-hidden="true">—</span> : null}
                        <span>{item.text}</span>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="helper-text">{t('settings.emptyReleaseNotes')}</p>
                )}
              </div>

              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={updateActionBusy !== null}
                  onClick={() => {
                    void openReleasePage('https://github.com/UmbraMalik/poe2-act-companion-overlay/releases/latest');
                  }}
                >
                  {updateActionBusy === 'release' ? t('settings.openingRelease') : t('settings.releasePage')}
                </button>

                {autoUpdateStatus === 'available' && (
                  <button
                    type="button"
                    className="button-primary"
                    disabled={updateActionBusy !== null}
                    onClick={() => {
                      void downloadAutoUpdate();
                    }}
                  >
                    {updateActionBusy === 'download' ? t('update.autoDownloadBusy') : t('settings.downloadUpdate')}
                  </button>
                )}

                {autoUpdateStatus === 'downloaded' && (
                  <button
                    type="button"
                    className="button-primary"
                    disabled={updateActionBusy !== null}
                    onClick={() => {
                      void installAutoUpdate();
                    }}
                  >
                    {updateActionBusy === 'install' ? t('update.installBusy') : t('settings.installUpdate')}
                  </button>
                )}
              </div>
            </section>
          )}
        </section>
        {groupTitle('log_detection')}
        <section id="settings-log-file" className="settings-card" hidden={!isSettingsSectionVisible('settings-log-file')}>
          <h2 className="settings-section-title">{t('settings.logFileTitle')}</h2>
          <p className="helper-text">{t('settings.logFileDescription')}</p>
          <div className="value-box">{config.logFilePath ?? t('settings.logFileNotSelected')}</div>
          <InfoGrid
            items={[
              { label: t('settings.selectedMode'), value: formatLogSelectionMode(config.logFileSelectionMode, appLanguage) },
              { label: t('settings.selectedPath'), value: runtime.watchedLogPath ?? t('common.notAvailable') },
              { label: t('settings.fileAvailable'), value: runtime.logFileExists ? t('common.yes') : t('common.no') },
              { label: t('settings.fileSize'), value: formatFileSize(runtime.logFileSize) },
              { label: t('settings.readOffset'), value: `${runtime.currentLogOffset} B` },
              { label: t('common.status'), value: logWatcherMessage }
            ]}
          />
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() => {
                void chooseLogFile();
              }}
            >
              {t('settings.chooseLogFile')}
            </button>
          </div>
        </section>

        {SHOW_DEVELOPER_SETTINGS && (
        <section id="settings-live-update" className="settings-card" hidden={!isSettingsSectionVisible('settings-live-update')}>
          <h2 className="settings-section-title">{t('settings.liveUpdateTitle')}</h2>
          <p className="helper-text">{t('settings.liveUpdateDescription')}</p>
          <textarea
            className="dev-log-textarea"
            value={devLogLine}
            onChange={(event) => setDevLogLine(event.target.value)}
            rows={3}
            placeholder={t('settings.liveUpdatePlaceholder')}
          />
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null || !config.logFilePath}
              onClick={() =>
                runTask('append-line', async () => {
                  await window.poe2Overlay.appendDevLogLine(devLogLine);
                })
              }
            >
              {t('settings.appendLogLine')}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => setDevLogLine(getDefaultDevLine(appLanguage))}
            >
              {t('settings.exampleZone')}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => setDevLogLine(getDefaultRewardLine(appLanguage))}
            >
              {t('settings.exampleReward')}
            </button>
          </div>
        </section>

        )}

        {groupTitle('timer')}
        <section id="settings-timer" className="settings-card" hidden={!isSettingsSectionVisible('settings-timer')}>
          <h2 className="settings-section-title">{t('settings.timerTitle')}</h2>
          <InfoGrid
            items={[
              { label: t('settings.timerStatus'), value: formatRunTimerStatus(displayRunTimer.status, appLanguage) },
              { label: t('settings.totalTime'), value: formatDuration(displayElapsedMs) },
              { label: t('settings.actTime'), value: currentActElapsedMs === null ? t('common.notAvailable') : formatDuration(currentActElapsedMs) },
              { label: t('settings.countdown'), value: currentCountdownMs === null ? t('common.notAvailable') : formatDuration(currentCountdownMs) }
            ]}
          />

          <div className="settings-grid">
            <label className="settings-field">
              <span>{t('settings.autoStartMode')}</span>
              <SettingsSelect
                ariaLabel={t('settings.autoStartMode')}
                value={config.runTimerSettings.autoStartMode}
                options={[
                  { value: 'scheduled_time', label: t('settings.autoStartScheduled') },
                  { value: 'manual', label: t('settings.autoStartManual') }
                ]}
                onChange={(autoStartMode) => {
                  void window.poe2Overlay.updateSettings({
                    runTimerSettings: {
                      autoStartMode: autoStartMode as RunTimerAutoStartMode
                    }
                  });
                }}
              />
            </label>

            <label className="settings-field">
              <span>{t('settings.leagueStartLabel')}</span>
              <input
                type="datetime-local"
                value={leagueStartDraft}
                onChange={(event) => setLeagueStartDraft(event.target.value)}
              />
            </label>
          </div>

          <div className="checkbox-grid">
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.runTimerSettings.autoStart}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    runTimerSettings: {
                      autoStart: event.target.checked
                    }
                  });
                }}
              />
              <span>{t('settings.autoStartEnabled')}</span>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.runTimerSettings.showCountdownBeforeStart}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    runTimerSettings: {
                      showCountdownBeforeStart: event.target.checked
                    }
                  });
                }}
              />
              <span>{t('settings.showCountdown')}</span>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.runTimerSettings.showActTimer}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    runTimerSettings: {
                      showActTimer: event.target.checked
                    }
                  });
                }}
              />
              <span>{t('settings.showActTimer')}</span>
            </label>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() =>
                runTask('save-league-start', async () => {
                  await saveLeagueStartSettings();
                })
              }
            >
              {t('settings.saveLeagueStart')}
            </button>
            {timerButtons}
          </div>
        </section>

        <section id="settings-level-reminders" className="settings-card" hidden={!isSettingsSectionVisible('settings-level-reminders')}>
          <h2 className="settings-section-title">{t('settings.levelReminderTitle')}</h2>
          <InfoGrid
            items={[
              { label: t('settings.currentLevel'), value: config.currentLevel ?? t('common.notAvailable') },
              { label: t('settings.lastLevelUp'), value: formatTimestamp(runtime.lastLevelUpDetectedAt, appLanguage) },
              { label: t('settings.activeReminder'), value: activeLevelReminderView?.displayTitle ?? t('common.notAvailable') },
              { label: t('settings.dismissed'), value: config.levelRemindersState.dismissed.length || '0' }
            ]}
          />
          <div className="button-row">
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null || !activeLevelReminder}
              onClick={() =>
                runTask('dismiss-reminder', async () => {
                  await window.poe2Overlay.dismissActiveLevelReminder();
                })
              }
            >
              {t('settings.dismissCurrentReminder')}
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() =>
                runTask('reset-level-reminders', async () => {
                  await window.poe2Overlay.resetLevelReminders();
                })
              }
            >
              {t('settings.resetLevelReminders')}
            </button>
          </div>
        </section>

        {groupTitle('overlay')}
        <section id="settings-overlay" className="settings-card" hidden={!isSettingsSectionVisible('settings-overlay')}>
          <h2 className="settings-section-title">{t('settings.overlayTitle')}</h2>
          <p className="helper-text">{t('settings.overlayDescription')}</p>

          <div className="settings-subsection overlay-presets-subsection">
            <div className="settings-card-header settings-card-header-compact">
              <div>
                <h3>{overlayPresetTitle}</h3>
                <p className="helper-text">{formatOverlayPresetState(activeOverlayPreset, appLanguage)}</p>
              </div>
            </div>
            <div className="button-row overlay-preset-row" role="group" aria-label={overlayPresetTitle}>
              {OVERLAY_PRESET_IDS.map((presetId) => {
                const isActivePreset = activeOverlayPreset === presetId;

                return (
                  <button
                    key={presetId}
                    type="button"
                    className={isActivePreset ? 'button-primary' : 'button-secondary'}
                    aria-pressed={isActivePreset}
                    disabled={busy !== null}
                    onClick={() => {
                      void applyOverlayPreset(presetId);
                    }}
                  >
                    {formatOverlayPresetLabel(presetId, appLanguage)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="settings-grid">
            <label className="settings-field settings-field-full">
              <span>{t('settings.overlayOpacity', { value: Math.round(config.overlayOpacity * 100) })}</span>
              <input
                type="range"
                min={35}
                max={100}
                value={Math.round(config.overlayOpacity * 100)}
                onChange={(event) => {
                  const value = Number(event.target.value) / 100;
                  void window.poe2Overlay.updateSettings({
                    overlayOpacity: value
                  });
                }}
              />
            </label>

            <label className="settings-field">
              <span>{t('settings.overlayScale')}</span>
              <SettingsSelect
                ariaLabel={t('settings.overlayScale')}
                value={config.overlayScale}
                options={[
                  { value: 70, label: '70%' },
                  { value: 80, label: '80%' },
                  { value: 90, label: '90%' },
                  { value: 100, label: '100%' },
                  { value: 110, label: '110%' },
                  { value: 120, label: '120%' }
                ]}
                onChange={(overlayScale) => {
                  void window.poe2Overlay.updateSettings({
                    overlayScale: Number(overlayScale) as OverlayScale
                  });
                }}
              />
            </label>

            <label className="settings-field">
              <span>{t('settings.overlayTextSize')}</span>
              <SettingsSelect
                ariaLabel={t('settings.overlayTextSize')}
                value={config.overlayTextSize}
                options={[
                  { value: 0, label: formatOverlayTextSize(0, appLanguage) },
                  { value: 1, label: formatOverlayTextSize(1, appLanguage) },
                  { value: 2, label: formatOverlayTextSize(2, appLanguage) },
                  { value: 3, label: formatOverlayTextSize(3, appLanguage) }
                ]}
                onChange={(overlayTextSize) => {
                  void window.poe2Overlay.updateSettings({
                    overlayTextSize: Number(overlayTextSize) as OverlayTextSize
                  });
                }}
              />
            </label>

            <label className="settings-field">
              <span>{t('settings.overlayDensity')}</span>
              <SettingsSelect
                ariaLabel={t('settings.overlayDensity')}
                value={config.overlayDensity}
                options={[
                  { value: 'compact', label: formatOverlayDensity('compact', appLanguage) },
                  { value: 'normal', label: formatOverlayDensity('normal', appLanguage) },
                  { value: 'detailed', label: formatOverlayDensity('detailed', appLanguage) }
                ]}
                onChange={(overlayDensity) => {
                  void window.poe2Overlay.updateSettings({
                    overlayDensity: overlayDensity as OverlayDensity
                  });
                }}
              />
            </label>

            <label className="settings-field visual-fx-intensity-field">
              <span>{t('settings.visualFxIntensity')}</span>
              <SettingsSelect
                ariaLabel={t('settings.visualFxIntensity')}
                value={config.visualFxIntensity}
                options={[
                  { value: 'off', label: formatVisualFxIntensity('off', appLanguage) },
                  { value: 'subtle', label: formatVisualFxIntensity('subtle', appLanguage) },
                  { value: 'normal', label: formatVisualFxIntensity('normal', appLanguage) },
                  { value: 'rich', label: formatVisualFxIntensity('rich', appLanguage) }
                ]}
                onChange={(visualFxIntensity) => {
                  void window.poe2Overlay.updateSettings({
                    visualFxIntensity: visualFxIntensity as VisualFxIntensity
                  });
                }}
              />
            </label>
            <div className="settings-field settings-field-full app-theme-field">
              <span>{t('settings.theme')}</span>
              <div className="app-theme-choice" role="group" aria-label={t('settings.theme')}>
                {(['classic', 'dark_fantasy'] as AppTheme[]).map((theme) => (
                  <button
                    key={theme}
                    className={config.theme === theme ? 'button-primary' : 'button-secondary'}
                    type="button"
                    aria-pressed={config.theme === theme}
                    onClick={() => {
                      void window.poe2Overlay.updateSettings({ theme, themePreferencePrompted: true });
                    }}
                  >
                    {formatAppTheme(theme, appLanguage)}
                  </button>
                ))}
              </div>
              <p className="helper-text">{t('settings.themeDescription')}</p>
            </div>
          </div>

          <div className="settings-subsection">
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.overlayEffectsEnabled}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    overlayEffectsEnabled: event.target.checked
                  });
                }}
              />
              <span>{t('settings.overlayEffectsEnabledTitle')}</span>
            </label>
            <p className="helper-text">{t('settings.overlayEffectsEnabledDescription')}</p>
          </div>

          <div className="settings-subsection">
            <h3 className="settings-subtitle">{t('settings.overlayShowTitle')}</h3>
            <div className="checkbox-grid">
              {OVERLAY_SECTION_VISIBILITY_LABELS.map(([key, labelKey]) => (
                <label className="toggle-card" key={key}>
                  <input
                    type="checkbox"
                    checked={config.overlayVisibleSections[key]}
                    onChange={(event) => {
                      void window.poe2Overlay.updateSettings({
                        overlayVisibleSections: {
                          [key]: event.target.checked
                        } as Partial<OverlayVisibleSections>
                      });
                    }}
                  />
                  <span>{t(labelKey)}</span>
                </label>
              ))}
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={config.mainOverlaySettings.overlayTimerOnlyMode}
                  onChange={(event) => {
                    void window.poe2Overlay.updateSettings({
                      mainOverlaySettings: {
                        overlayTimerOnlyMode: event.target.checked
                      }
                    });
                  }}
                />
                <span>{t('settings.overlayTimerOnly')}</span>
              </label>
            </div>
          </div>

          <div className="settings-subsection">
            <div className="settings-card-header settings-card-header-compact">
              <div>
                <h3>{t('settings.hotkeysTitle')}</h3>
                <p className="helper-text">{t('settings.hotkeysDescription')}</p>
                {hotkeySaveStatus === 'saved' && (
                  <p className="helper-text hotkey-save-status">{t('settings.hotkeysSaved')}</p>
                )}
              </div>
              <div className="button-row hotkey-actions">
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy !== null}
                  onClick={() => {
                    void saveHotkeys();
                  }}
                >
                  {t('settings.saveHotkeys')}
                </button>
                <button type="button" className="button-secondary" disabled={busy !== null} onClick={resetHotkeys}>
                  {t('settings.resetFields')}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void resetAndSaveHotkeys();
                  }}
                >
                  {t('settings.defaults')}
                </button>
              </div>
            </div>

            <div className="hotkey-grid">
              {HOTKEY_LABELS.map((item) => (
                <label className="hotkey-field" key={item.key}>
                  <span className="hotkey-field-title">{t(item.labelKey)}</span>
                  <input
                    type="text"
                    value={hotkeyDrafts[item.key] || ''}
                    placeholder={t('settings.hotkeyPlaceholder')}
                    onChange={(event) => {
                      updateHotkeyDraft(item.key, event.target.value);
                    }}
                    onBlur={(event) => updateHotkeyDraft(item.key, event.target.value.trim())}
                    onKeyDown={(event) => {
                      const nextHotkey = hotkeyFromKeyboardEvent(event);
                      if (nextHotkey === null) {
                        return;
                      }
                      event.preventDefault();
                      updateHotkeyDraft(item.key, nextHotkey);
                    }}
                  />
                  <small>{t(item.noteKey)}</small>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section id="settings-detail-panel" className="settings-card" hidden={!isSettingsSectionVisible('settings-detail-panel')}>
          <h2 className="settings-section-title">{t('settings.detailPanelTitle')}</h2>
          <p className="helper-text">{t('settings.detailPanelDescription')}</p>

          <div className="checkbox-grid">
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.companionAlwaysOnTop}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    companionAlwaysOnTop: event.target.checked
                  });
                }}
              />
              <span>{t('settings.companionAlwaysOnTop')}</span>
            </label>
          </div>

          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null}
              onClick={() =>
                runTask('open-companion', async () => {
                  await window.poe2Overlay.openCompanionPanel();
                })
              }
            >
              {t('settings.openCompanion')}
            </button>
          </div>
        </section>

        {groupTitle('troubleshooting')}
        {SHOW_DEVELOPER_SETTINGS && (
        <section id="settings-simulate" className="settings-card" hidden={!isSettingsSectionVisible('settings-simulate')}>
          <h2 className="settings-section-title">{t('settings.simulateTitle')}</h2>
          <p className="helper-text">{t('settings.simulateDescription')}</p>
          <div className="settings-grid settings-grid-actions">
            <label className="settings-field settings-field-full">
              <span>{t('settings.selectZone')}</span>
              <SettingsSelect
                ariaLabel={t('settings.selectZone')}
                value={simulateZone}
                options={[
                  { value: '', label: t('settings.selectZonePlaceholder') },
                  ...zoneOptions
                ]}
                onChange={setSimulateZone}
              />
            </label>
            <div className="button-row">
              <button
                type="button"
                className="button-primary"
                disabled={!simulateZone || busy !== null}
                onClick={() =>
                  runTask('simulate-zone', async () => {
                    await window.poe2Overlay.simulateZone(simulateZone);
                  })
                }
              >
                {t('settings.simulateZone')}
              </button>
            </div>
          </div>
        </section>

        )}

        <section id="settings-local-progress" className="settings-card danger-card" hidden={!isSettingsSectionVisible('settings-local-progress')}>
          <h2 className="settings-section-title">{t('settings.localProgressTitle')}</h2>
          <InfoGrid
            items={[
              { label: t('settings.currentScene'), value: sceneName },
              { label: t('settings.currentRoute'), value: formatGuideLabel(currentGuide, appLanguage) },
              { label: t('settings.totalTime'), value: formatDuration(displayElapsedMs) }
            ]}
          />
          <div className="button-row">
            <button
              type="button"
              className="button-danger"
              disabled={busy !== null}
              onClick={() =>
                runTask('reset-progress', async () => {
                  await window.poe2Overlay.resetProgress();
                })
              }
            >
              {t('settings.resetProgress')}
            </button>
          </div>
        </section>

        {groupTitle('advanced')}
        <section id="settings-advanced" className="settings-card" hidden={!isSettingsSectionVisible('settings-advanced')}>
          <h2 className="settings-section-title">{getSettingsSectionLabel('settings-advanced', appLanguage)}</h2>
          <p className="helper-text">{t('settings.realtimePriorityDescription')}</p>
          <div className="settings-subsection">
            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.realtimePriorityEnabled}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    realtimePriorityEnabled: event.target.checked
                  });
                }}
              />
              <span>{t('settings.realtimePriorityTitle')}</span>
            </label>
            <p className="helper-text">{t('settings.realtimePriorityWarning')}</p>
          </div>
        </section>

        {SHOW_DEVELOPER_SETTINGS && (
          <section id="settings-developer" className="settings-card" hidden={!isSettingsSectionVisible('settings-developer')}>
            <h2 className="settings-section-title">{t('settings.developerTitle')}</h2>
            <p className="helper-text">{t('settings.developerDescription')}</p>
            <div className="checkbox-grid">
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={config.devPanelEnabled}
                  onChange={(event) => {
                    void window.poe2Overlay.updateSettings({
                      devPanelEnabled: event.target.checked
                    });
                  }}
                />
                <span>{t('settings.showDiagnostics')}</span>
              </label>
              <label className="toggle-card">
                <input
                  type="checkbox"
                  checked={config.overlayDebugLayoutEnabled}
                  onChange={(event) => {
                    void window.poe2Overlay.updateSettings({
                      overlayDebugLayoutEnabled: event.target.checked
                    });
                  }}
                />
                <span>{t('settings.overlayDebugLayout')}</span>
              </label>
            </div>

            {config.devPanelEnabled && (
              <div className="settings-subsection">
                <h3 className="settings-subtitle">{t('settings.diagnosticsTitle')}</h3>
                <InfoGrid
                  items={[
                    { label: t('settings.lastMatchReason'), value: formatZoneMatcherReason(runtime.lastMatcherReason, appLanguage) },
                    { label: t('settings.lastValidZone'), value: formatTimestamp(runtime.lastValidGameplayZoneAt, appLanguage) },
                    { label: t('settings.lastScene'), value: runtime.lastSceneSource ?? t('common.notAvailable') },
                    { label: t('settings.lastRead'), value: formatTimestamp(runtime.lastReadAt, appLanguage) },
                    { label: t('settings.lastKnownLevel'), value: config.currentLevel ?? t('common.notAvailable') }
                  ]}
                />
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
