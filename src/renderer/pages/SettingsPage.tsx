import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import supportQrImage from '../assets/support-qr.png';
import { useAppSnapshot, useLiveRunTimer } from '../hooks';
import {
  getCurrentActElapsedMs,
  getSceneDisplayName
} from '../companion-helpers';
import {
  formatActLabel,
  formatDuration,
  formatFileSize,
  getReleaseNoteItems,
  formatTimestamp,
  formatZoneOption
} from '../utils';
import type {
  HotkeySettings,
  OverlayDensity,
  OverlayScale,
  RunTimerAutoStartMode,
  RunTimerStatus,
  UpdateCheckResult,
  AutoUpdateState
} from '../../shared/types';

const DEFAULT_DEV_LINE = '2026/05/12 12:00:00 Вы вошли в область: Грельвуд';
const DEFAULT_REWARD_LINE = 'Игрок получил +10% к сопротивлению [Resistances|холоду].';
const PROJECT_SITE_URL = 'https://umbramalik.github.io/poe2-campaign-codex/#';
const PROJECT_TELEGRAM_URL = 'https://t.me/POE2CampaignCodex';
const PROJECT_FEEDBACK_URL = 'https://t.me/POE2CampaignCodex?direct';
const SHOW_DEVELOPER_SETTINGS = import.meta.env.DEV;

const DEFAULT_HOTKEYS: HotkeySettings = {
  markChecklistDone: 'F6',
  undoChecklistMark: 'F7',
  toggleTimerPause: 'F8',
  openCompanion: 'F9',
  toggleOverlayMode: 'F10'
};

const HOTKEY_LABELS: Array<{ key: keyof HotkeySettings; label: string; note: string }> = [
  { key: 'toggleTimerPause', label: 'Пауза / продолжить таймер', note: 'Доступно всегда' },
  { key: 'openCompanion', label: 'Подробная панель', note: 'Доступно всегда' },
  { key: 'toggleOverlayMode', label: 'Свернуть / развернуть оверлей', note: 'Доступно всегда' }
];

const OVERLAY_VISIBILITY_LABELS = [
  ['showOverlaySkip', 'Показывать блок “Скип”'],
  ['showOverlayCriticalImportant', 'Показывать блок “Сейчас важно”'],
  ['showOverlayBossTip', 'Показывать подсказки по боссу'],
  ['showOverlayVendorReminder', 'Показывать напоминания торговцев'],
  ['showOverlayXpStatus', 'Показывать статус уровня / XP'],
  ['showOverlayPowerSpike', 'Показывать скачки силы'],
  ['overlayTimerOnlyMode', 'Запускать сразу в режиме “Только таймер”']
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

function formatRunTimerStatus(status: RunTimerStatus): string {
  switch (status) {
    case 'armed':
      return 'Ожидание';
    case 'running':
      return 'Идёт';
    case 'paused':
      return 'Пауза';
    case 'finished':
      return 'Завершён';
    default:
      return 'Не запущен';
  }
}

function formatOverlayDensity(value: OverlayDensity): string {
  switch (value) {
    case 'compact':
      return 'Компактно';
    case 'detailed':
      return 'Подробно';
    default:
      return 'Обычно';
  }
}

function formatLogSelectionMode(mode: 'auto' | 'manual' | null): string {
  switch (mode) {
    case 'auto':
      return 'Автопоиск';
    case 'manual':
      return 'Выбран вручную';
    default:
      return 'Ручной / старый конфиг';
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
  const liveRunTimer = useLiveRunTimer(
    snapshot?.config.runTimer,
    snapshot?.config.runTimerSettings,
    snapshot?.runtime.timerNowMs
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [simulateZone, setSimulateZone] = useState('');
  const [devLogLine, setDevLogLine] = useState(DEFAULT_DEV_LINE);
  const [leagueStartDraft, setLeagueStartDraft] = useState('');
  const [hotkeyDrafts, setHotkeyDrafts] = useState<HotkeySettings>(DEFAULT_HOTKEYS);
  const [hotkeySaveStatus, setHotkeySaveStatus] = useState<'idle' | 'saved'>('idle');
  const [appVersion, setAppVersion] = useState('');
  const [updateCheckResult, setUpdateCheckResult] = useState<UpdateCheckResult | null>(null);
  const [autoUpdateState, setAutoUpdateState] = useState<AutoUpdateState | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateActionBusy, setUpdateActionBusy] = useState<'download' | 'install' | 'release' | null>(null);

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

  if (!snapshot) {
    return <div className="settings-shell">Загрузка настроек…</div>;
  }

  const { config, currentGuideEntry, currentZone, runtime, activeLevelReminder } = snapshot;
  const displayRunTimer = liveRunTimer.runTimer ?? config.runTimer;
  const currentGuide = currentGuideEntry;
  const displayElapsedMs = liveRunTimer.runElapsedMs;
  const currentActElapsedMs = getCurrentActElapsedMs(
    displayRunTimer,
    currentGuide,
    liveRunTimer.nowMs
  );
  const currentCountdownMs = liveRunTimer.countdownMs;
  const sceneName = getSceneDisplayName(snapshot);
  const zoneOptions = snapshot.guideEntries.map((entry) => ({
    value: entry.id,
    label: formatZoneOption(entry)
  }));
  const hasSelectedLogFile = Boolean(runtime.watchedLogPath ?? config.logFilePath);
  const logFileStatusText = !hasSelectedLogFile
    ? 'Лог-файл ещё не выбран'
    : runtime.logFileExists
      ? 'Лог-файл выбран и доступен'
      : 'Лог-файл выбран, но сейчас недоступен';
  const logFileStatusTone = !hasSelectedLogFile
    ? 'is-pending'
    : runtime.logFileExists
      ? 'is-success'
      : 'is-warning';
  const autoUpdateStatus = autoUpdateState?.status ?? 'idle';
  const updateReleaseNoteItems = getReleaseNoteItems(autoUpdateState?.releaseNotes ?? '');
  const updateProgress = autoUpdateState?.downloadProgress ?? null;
  const updateErrorText =
    autoUpdateState?.errorMessage ??
    'Не удалось проверить обновления. Проверь интернет или попробуй позже.';
  const updateStatusText = isCheckingUpdates
    ? 'Проверяем обновления...'
    : autoUpdateStatus === 'available' && autoUpdateState?.latestVersion
      ? `Доступна новая версия ${autoUpdateState.latestVersion}`
      : autoUpdateStatus === 'downloading'
        ? `Скачиваем обновление${updateProgress ? ` · ${Math.round(updateProgress.percent)}%` : '...'}`
        : autoUpdateStatus === 'downloaded'
          ? 'Обновление скачано и готово к установке.'
          : autoUpdateStatus === 'not_available'
            ? 'Установлена актуальная версия.'
            : autoUpdateStatus === 'error'
              ? 'Не удалось проверить обновления.'
              : 'Ручная проверка ещё не запускалась.';
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

  const openExternalLink = async (name: string, url: string) => {
    await runTask(name, async () => {
      await window.poe2Overlay.openExternal(url);
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
              Подготовить таймер
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
            Старт
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
            Старт
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
            Сбросить
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
            Пауза
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
            Завершить
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
            Сбросить
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
            Продолжить
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
            Сбросить
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
        Сбросить
      </button>
    );
  })();

  return (
    <main className="settings-page">
      <header className="settings-header window-drag-strip">
        <div className="settings-header-copy">
          <p className="eyebrow">PoE2 Campaign Codex</p>
          <h1>Настройки</h1>
          <p className="helper-text settings-intro">
            Единая панель для лог-файла, оверлея, подробной панели, таймера и локального прогресса.
          </p>
        </div>
        <button
          className="button-secondary no-drag"
          type="button"
          onClick={() => window.close()}
        >
          Закрыть
        </button>
      </header>

      <section className="settings-shell">
        <section className="settings-card first-run-card">
          <div className="settings-card-header">
            <h2 className="settings-section-title">ПЕРВЫЙ ЗАПУСК</h2>
            <span className={`settings-status-pill ${logFileStatusTone}`}>{logFileStatusText}</span>
          </div>
          <ol className="settings-step-list">
            <li>Нажми “Выбрать лог-файл”.</li>
            <li>
              Укажи файл:
              <code className="settings-inline-path">Path of Exile 2/logs/LatestClient.txt</code>
            </li>
            <li>Запусти игру и зайди в любую игровую зону.</li>
            <li>Чтобы передвинуть оверлей — нажми “Открепить” и потяни окно за верхнюю часть.</li>
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
              Выбрать лог-файл
            </button>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2 className="settings-section-title">ОБНОВЛЕНИЯ</h2>
              <p className="helper-text">
                Приложение проверяет GitHub Releases. Обновление скачивается внутри приложения,
                а установка запускается только после кнопки “Установить и перезапустить”.
              </p>
            </div>
            <span className={`settings-status-pill ${updateStatusTone}`}>{updateStatusText}</span>
          </div>

          <div className="update-summary-grid">
            <div className="value-box">
              <strong>Текущая версия: </strong>
              <span>{appVersion || autoUpdateState?.currentVersion || '—'}</span>
            </div>
            <div className="value-box">
              <strong>Статус проверки: </strong>
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
              {isCheckingUpdates ? 'Проверяем обновления...' : 'Проверить обновления'}
            </button>
          </div>

          {autoUpdateStatus === 'not_available' && (
            <p className="update-inline-message is-success">Установлена актуальная версия.</p>
          )}

          {autoUpdateStatus === 'error' && (
            <div className="update-inline-message is-warning">
              <p>{updateErrorText}</p>
              <div className="button-row update-error-actions">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={updateActionBusy !== null}
                  onClick={() => {
                    void openReleasePage('https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases/latest');
                  }}
                >
                  {updateActionBusy === 'release' ? 'Открываем релиз...' : 'Открыть релиз'}
                </button>
              </div>
            </div>
          )}

          {(autoUpdateStatus === 'available' || autoUpdateStatus === 'downloading' || autoUpdateStatus === 'downloaded') && (
            <section className="update-result-card">
              <div className="settings-card-header settings-card-header-compact">
                <div>
                  <h3>Доступна новая версия: {autoUpdateState?.latestVersion ?? '—'}</h3>
                  <p className="helper-text">{autoUpdateState?.releaseName ?? 'PoE2 Campaign Codex Overlay'}</p>
                </div>
              </div>

              <InfoGrid
                items={[
                  { label: 'Текущая версия', value: autoUpdateState?.currentVersion ?? appVersion ?? '—' },
                  { label: 'Новая версия', value: autoUpdateState?.latestVersion ?? '—' },
                  { label: 'Релиз', value: autoUpdateState?.releaseName ?? '—' },
                  { label: 'Дата релиза', value: formatTimestamp(autoUpdateState?.releaseDate ?? null) }
                ]}
              />

              {autoUpdateStatus === 'downloading' && updateProgress && (
                <section className="update-progress-card">
                  <div className="update-progress-header">
                    <strong>Загрузка обновления</strong>
                    <span>{Math.round(updateProgress.percent)}%</span>
                  </div>
                  <div className="update-progress-track" aria-label="Прогресс загрузки">
                    <span style={{ width: `${Math.max(0, Math.min(100, updateProgress.percent))}%` }} />
                  </div>
                  <p className="helper-text">
                    {formatFileSize(updateProgress.transferred)} / {formatFileSize(updateProgress.total)}
                  </p>
                </section>
              )}

              {autoUpdateStatus === 'downloaded' && (
                <p className="update-inline-message is-success">
                  Обновление скачано. Можно установить и перезапустить приложение.
                </p>
              )}

              <div className="settings-subsection">
                <h3 className="settings-subtitle">Что нового</h3>
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
                  <p className="helper-text">Описание релиза не заполнено.</p>
                )}
              </div>

              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={updateActionBusy !== null}
                  onClick={() => {
                    void openReleasePage('https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases/latest');
                  }}
                >
                  {updateActionBusy === 'release' ? 'Открываем релиз...' : 'Открыть релиз'}
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
                    {updateActionBusy === 'download' ? 'Запускаем загрузку...' : 'Скачать обновление'}
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
                    {updateActionBusy === 'install' ? 'Устанавливаем...' : 'Установить и перезапустить'}
                  </button>
                )}
              </div>
            </section>
          )}
        </section>
        <section className="settings-card">
          <h2 className="settings-section-title">ЛОГ-ФАЙЛ</h2>
          <p className="helper-text">
            Приложение ищет `LatestClient.txt` и `Client.txt` автоматически. Если файл уже выбран вручную, этот путь больше не перезаписывается.
          </p>
          <div className="value-box">{config.logFilePath ?? 'Лог-файл пока не выбран.'}</div>
          <InfoGrid
            items={[
              { label: 'Источник', value: formatLogSelectionMode(config.logFileSelectionMode) },
              { label: 'Текущий путь', value: runtime.watchedLogPath ?? '—' },
              { label: 'Файл доступен', value: runtime.logFileExists ? 'Да' : 'Нет' },
              { label: 'Размер файла', value: formatFileSize(runtime.logFileSize) },
              { label: 'Позиция чтения', value: `${runtime.currentLogOffset} B` },
              { label: 'Статус', value: runtime.logWatcherMessage }
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
              Выбрать лог-файл
            </button>
          </div>
        </section>

        {SHOW_DEVELOPER_SETTINGS && (
        <section className="settings-card">
          <h2 className="settings-section-title">ПОМОЩНИК LIVE-ОБНОВЛЕНИЯ</h2>
          <p className="helper-text">
            Быстрая проверка живого обновления оверлея без перезапуска приложения. Строка будет дописана в выбранный лог.
          </p>
          <textarea
            className="dev-log-textarea"
            value={devLogLine}
            onChange={(event) => setDevLogLine(event.target.value)}
            rows={3}
            placeholder="Строка для дописывания в лог"
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
              Добавить строку в лог
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => setDevLogLine(DEFAULT_DEV_LINE)}
            >
              Пример зоны
            </button>
            <button
              type="button"
              className="button-secondary"
              disabled={busy !== null}
              onClick={() => setDevLogLine(DEFAULT_REWARD_LINE)}
            >
              Пример награды
            </button>
          </div>
        </section>

        )}

        <section className="settings-card">
          <h2 className="settings-section-title">ТАЙМЕР ЛИГСТАРТА</h2>
          <InfoGrid
            items={[
              { label: 'Статус', value: formatRunTimerStatus(displayRunTimer.status) },
              { label: 'Общее время', value: formatDuration(displayElapsedMs) },
              { label: 'Текущий акт', value: currentActElapsedMs === null ? '—' : formatDuration(currentActElapsedMs) },
              { label: 'Отсчёт', value: currentCountdownMs === null ? '—' : formatDuration(currentCountdownMs) }
            ]}
          />

          <div className="settings-grid">
            <label className="settings-field">
              <span>Режим автозапуска</span>
              <select
                value={config.runTimerSettings.autoStartMode}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    runTimerSettings: {
                      autoStartMode: event.target.value as RunTimerAutoStartMode
                    }
                  });
                }}
              >
                <option value="scheduled_time">По заданному времени</option>
                <option value="manual">Только вручную</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Дата и время старта лиги</span>
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
              <span>Включить автозапуск таймера</span>
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
              <span>Показывать отсчёт до старта</span>
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
              <span>Показывать время текущего акта</span>
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
              Сохранить время старта
            </button>
            {timerButtons}
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-section-title">НАПОМИНАНИЯ УРОВНЯ</h2>
          <InfoGrid
            items={[
              { label: 'Текущий уровень', value: config.currentLevel ?? '—' },
              { label: 'Последнее повышение уровня', value: formatTimestamp(runtime.lastLevelUpDetectedAt) },
              { label: 'Активное напоминание', value: activeLevelReminder?.title ?? '—' },
              { label: 'Скрытые', value: config.levelRemindersState.dismissed.length || '0' }
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
              Скрыть текущее напоминание
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
              Сбросить напоминания уровня
            </button>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-section-title">ОВЕРЛЕЙ</h2>
          <p className="helper-text">
            Основной оверлей показывает короткую памятку по текущей локации: что важно забрать, куда идти дальше, что можно пропустить, подсказки по боссу и таймер.
          </p>

          <div className="settings-grid">
            <label className="settings-field settings-field-full">
              <span>Прозрачность: {Math.round(config.overlayOpacity * 100)}%</span>
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
              <span>Масштаб UI</span>
              <select
                value={config.overlayScale}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    overlayScale: Number(event.target.value) as OverlayScale
                  });
                }}
              >
                <option value={70}>70%</option>
                <option value={80}>80%</option>
                <option value={90}>90%</option>
                <option value={100}>100%</option>
                <option value={110}>110%</option>
                <option value={120}>120%</option>
              </select>
            </label>

            <label className="settings-field">
              <span>Плотность</span>
              <select
                value={config.overlayDensity}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    overlayDensity: event.target.value as OverlayDensity
                  });
                }}
              >
                <option value="compact">{formatOverlayDensity('compact')}</option>
                <option value="normal">{formatOverlayDensity('normal')}</option>
                <option value="detailed">{formatOverlayDensity('detailed')}</option>
              </select>
            </label>
          </div>

          <div className="settings-subsection">
            <h3 className="settings-subtitle">ОТОБРАЖАТЬ В ОВЕРЛЕЕ</h3>
            <div className="checkbox-grid">
              {OVERLAY_VISIBILITY_LABELS.map(([key, label]) => (
                <label className="toggle-card" key={key}>
                  <input
                    type="checkbox"
                    checked={config.mainOverlaySettings[key]}
                    onChange={(event) => {
                      void window.poe2Overlay.updateSettings({
                        mainOverlaySettings: {
                          [key]: event.target.checked
                        }
                      });
                    }}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-subsection">
            <div className="settings-card-header settings-card-header-compact">
              <div>
                <h3>Горячие клавиши</h3>
                <p className="helper-text">
                  Нажми в поле и задай новую клавишу. Для букв и цифр используй модификатор: Ctrl / Alt / Shift. Например: Ctrl+F9, Alt+Q, Shift+F8. Изменения применяются после сохранения.
                </p>
                {hotkeySaveStatus === 'saved' && (
                  <p className="helper-text hotkey-save-status">Хоткеи сохранены.</p>
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
                  Сохранить хоткеи
                </button>
                <button type="button" className="button-secondary" disabled={busy !== null} onClick={resetHotkeys}>
                  Сбросить поля
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void resetAndSaveHotkeys();
                  }}
                >
                  По умолчанию
                </button>
              </div>
            </div>

            <div className="hotkey-grid">
              {HOTKEY_LABELS.map((item) => (
                <label className="hotkey-field" key={item.key}>
                  <span className="hotkey-field-title">{item.label}</span>
                  <input
                    type="text"
                    value={hotkeyDrafts[item.key] || ''}
                    placeholder="Нажми клавишу"
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
                  <small>{item.note}</small>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-section-title">ПОЛНЫЕ ДЕТАЛИ ТЕКУЩЕЙ ЗОНЫ</h2>
          <p className="helper-text">
            Подробная панель показывает текущую сцену, маршрут, таймер, награды и сводку без перегруза основного оверлея.
          </p>
          <InfoGrid
            items={[
              { label: 'Текущая сцена', value: sceneName },
              { label: 'Маршрут', value: currentGuide ? `${formatActLabel(currentGuide)} · ${currentGuide.zone_ru}` : '—' },
              { label: 'Профиль гайда', value: 'Универсальный' },
              { label: 'Режим тренировки', value: config.trainingModeEnabled ? 'Включён' : 'Выключен' }
            ]}
          />

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
              <span>Держать подробную панель поверх других окон</span>
            </label>

            <label className="toggle-card">
              <input
                type="checkbox"
                checked={config.trainingModeEnabled}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    trainingModeEnabled: event.target.checked
                  });
                }}
              />
              <span>Включить режим тренировки</span>
            </label>
          </div>

          <div className="settings-grid settings-grid-wide">
            <label className="settings-field">
              <span>Профиль гайда</span>
              <select
                value={config.guideProfile}
                onChange={(event) => {
                  void window.poe2Overlay.updateSettings({
                    guideProfile: event.target.value as 'universal'
                  });
                }}
              >
                <option value="universal">Универсальный</option>
              </select>
            </label>

            <div className="settings-field">
              <span>Целевое время актов</span>
              <div className="settings-inline-grid">
                {([
                  ['act1', 'Акт 1'],
                  ['act2', 'Акт 2'],
                  ['act3', 'Акт 3'],
                  ['act4', 'Акт 4']
                ] as const).map(([key, label]) => (
                  <label className="settings-field" key={key}>
                    <span>{label}, мин</span>
                    <input
                      type="number"
                      min={0}
                      value={config.trainingTargetActTimes[key] ?? ''}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        void window.poe2Overlay.updateSettings({
                          trainingTargetActTimes: {
                            [key]: rawValue === '' ? null : Number(rawValue)
                          }
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
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
              Открыть подробную панель
            </button>
          </div>
        </section>

        {SHOW_DEVELOPER_SETTINGS && (
        <section className="settings-card">
          <h2 className="settings-section-title">СИМУЛЯЦИЯ ЗОНЫ</h2>
          <p className="helper-text">
            Удобно для быстрой проверки оверлея и подробной панели без запущенной игры.
          </p>
          <div className="settings-grid settings-grid-actions">
            <label className="settings-field settings-field-full">
              <span>Выберите зону</span>
              <select
                value={simulateZone}
                onChange={(event) => setSimulateZone(event.target.value)}
              >
                <option value="">Выберите зону</option>
                {zoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                Симулировать зону
              </button>
            </div>
          </div>
        </section>

        )}

        <section className="settings-card support-card">
          <h2 className="settings-section-title">ССЫЛКИ И ПОДДЕРЖКА</h2>
          <p className="helper-text">
            Быстрые ссылки на сайт проекта, Telegram и прямой контакт для фидбека. Если оверлей помог — можно поддержать проект через QR-код.
          </p>
          <div className="support-grid">
            <div className="support-copy">
              <div className="button-row">
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void openExternalLink('open-project-site', PROJECT_SITE_URL);
                  }}
                >
                  Открыть сайт
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void openExternalLink('open-project-telegram', PROJECT_TELEGRAM_URL);
                  }}
                >
                  Telegram
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    void openExternalLink('open-project-feedback', PROJECT_FEEDBACK_URL);
                  }}
                >
                  Фидбек / баги
                </button>
              </div>

              <div className="support-link-list">
                <div className="value-box">
                  <strong>Сайт:</strong>
                  <span>{PROJECT_SITE_URL}</span>
                </div>
                <div className="value-box">
                  <strong>Telegram:</strong>
                  <span>{PROJECT_TELEGRAM_URL}</span>
                </div>
                <div className="value-box">
                  <strong>Фидбек:</strong>
                  <span>{PROJECT_FEEDBACK_URL}</span>
                </div>
              </div>
            </div>

            <div className="support-qr-card">
              <img src={supportQrImage} alt="QR-код для поддержки проекта" className="support-qr-image" />
              <div className="support-qr-copy">
                <h3>Поддержка проекта</h3>
                <p className="helper-text">
                  Открой приложение банка, отсканируй QR-код и отправь любую комфортную сумму. Это добровольная поддержка, не покупка доступа.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card danger-card">
          <h2 className="settings-section-title">ЛОКАЛЬНЫЙ ПРОГРЕСС</h2>
          <InfoGrid
            items={[
              { label: 'Текущая сцена', value: sceneName },
              { label: 'Текущий маршрут', value: currentGuide ? `${formatActLabel(currentGuide)} · ${currentGuide.zone_ru}` : '—' },
              { label: 'Время забега', value: formatDuration(displayElapsedMs) }
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
              Сбросить прогресс
            </button>
          </div>
        </section>

        {SHOW_DEVELOPER_SETTINGS && (
          <section className="settings-card">
            <h2 className="settings-section-title">ДЛЯ РАЗРАБОТКИ</h2>
            <p className="helper-text">
              Служебные переключатели и диагностическая информация для локальной отладки.
            </p>
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
                <span>Показывать диагностическую панель</span>
              </label>
            </div>

            {config.devPanelEnabled && (
              <div className="settings-subsection">
                <h3 className="settings-subtitle">ДИАГНОСТИКА</h3>
                <InfoGrid
                  items={[
                    { label: 'Причина последнего совпадения', value: runtime.lastMatcherReason },
                    { label: 'Последняя валидная зона', value: formatTimestamp(runtime.lastValidGameplayZoneAt) },
                    { label: 'Последняя сцена', value: runtime.lastSceneSource ?? '—' },
                    { label: 'Последнее чтение', value: formatTimestamp(runtime.lastReadAt) },
                    { label: 'Последний уровень', value: config.currentLevel ?? '—' }
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
