import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoUpdateState, UpdateInfo } from '../../shared/types';
import { formatFileSize, formatTimestamp, getReleaseNoteItems } from '../utils';

function getStatusLabel(state: AutoUpdateState | null): string {
  switch (state?.status) {
    case 'checking':
      return 'Проверяем обновление…';
    case 'available':
      return 'Обновление доступно';
    case 'downloading':
      return 'Скачиваем обновление…';
    case 'downloaded':
      return 'Обновление готово';
    case 'not_available':
      return 'Установлена актуальная версия';
    case 'error':
      return 'Ошибка обновления';
    default:
      return 'Ожидание данных обновления';
  }
}

function getSpeedLabel(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) {
    return '—';
  }

  return `${formatFileSize(bytesPerSecond)}/с`;
}

export function UpdatePage() {
  const [manualUpdateInfo, setManualUpdateInfo] = useState<UpdateInfo | null>(null);
  const [autoUpdateState, setAutoUpdateState] = useState<AutoUpdateState | null>(null);
  const [actionBusy, setActionBusy] = useState<'download' | 'install' | 'manual' | null>(null);
  const laterButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    laterButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        window.close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    void window.poe2Overlay.getStartupUpdateInfo().then((info) => {
      setManualUpdateInfo(info);
    });
    void window.poe2Overlay.getAutoUpdateState().then((state) => {
      setAutoUpdateState(state);
    });
    const unsubscribe = window.poe2Overlay.onAutoUpdateChanged((state) => {
      setAutoUpdateState(state);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubscribe();
    };
  }, []);

  const currentVersion = autoUpdateState?.currentVersion ?? manualUpdateInfo?.currentVersion ?? '—';
  const latestVersion = autoUpdateState?.latestVersion ?? manualUpdateInfo?.latestVersion ?? '—';
  const releaseName = autoUpdateState?.releaseName ?? manualUpdateInfo?.releaseName ?? `PoE2 Campaign Codex Overlay ${latestVersion}`;
  const releaseDate = autoUpdateState?.releaseDate ?? manualUpdateInfo?.publishedAt ?? null;
  const releaseNotesSource = autoUpdateState?.releaseNotes ?? manualUpdateInfo?.body ?? '';
  const progress = autoUpdateState?.downloadProgress;
  const canAutoDownload = autoUpdateState?.status === 'available';
  const canInstall = autoUpdateState?.status === 'downloaded';
  const showManualDownload = Boolean(manualUpdateInfo?.downloadUrl) && autoUpdateState?.status === 'error';

  const releaseNoteItems = useMemo(
    () => getReleaseNoteItems(releaseNotesSource),
    [releaseNotesSource]
  );

  const handleAutoDownload = async () => {
    setActionBusy('download');
    try {
      const state = await window.poe2Overlay.downloadAutoUpdate();
      setAutoUpdateState(state);
    } finally {
      setActionBusy(null);
    }
  };

  const handleInstall = async () => {
    setActionBusy('install');
    const installed = await window.poe2Overlay.installAutoUpdate();
    if (!installed) {
      setActionBusy(null);
    }
  };

  const handleManualDownload = async () => {
    if (!manualUpdateInfo?.downloadUrl) {
      return;
    }

    setActionBusy('manual');
    try {
      await window.poe2Overlay.openUpdateDownload(manualUpdateInfo.downloadUrl);
      window.close();
    } finally {
      setActionBusy(null);
    }
  };

  const handleOpenRelease = async () => {
    if (!manualUpdateInfo?.releaseUrl) {
      return;
    }

    await window.poe2Overlay.openReleasePage(manualUpdateInfo.releaseUrl);
  };

  return (
    <main className="update-page">
      <section className="update-shell">
        <header className="close-confirm-header update-header">
          <div className="close-confirm-header-copy">
            <p className="eyebrow">PoE2 Campaign Codex</p>
            <h1>{canInstall ? 'Обновление готово' : 'Доступна новая версия'}</h1>
          </div>
          <button
            className="button-secondary close-confirm-close no-drag"
            type="button"
            aria-label="Закрыть окно обновления"
            title="Позже"
            onClick={() => window.close()}
          >
            ×
          </button>
        </header>

        {autoUpdateState || manualUpdateInfo ? (
          <>
            <div className="update-content">
              <div className="update-status-banner">
                <strong>{getStatusLabel(autoUpdateState)}</strong>
                {autoUpdateState?.status === 'error' && autoUpdateState.errorMessage && (
                  <span>{autoUpdateState.errorMessage}</span>
                )}
              </div>

              <div className="update-version-row">
                <div className="update-version-card">
                  <span>Текущая версия</span>
                  <strong>{currentVersion}</strong>
                </div>
                <div className="update-version-card">
                  <span>Новая версия</span>
                  <strong>{latestVersion}</strong>
                </div>
              </div>

              <dl className="update-meta-grid">
                <div className="update-meta-item">
                  <dt>Релиз</dt>
                  <dd>{releaseName}</dd>
                </div>
                <div className="update-meta-item">
                  <dt>Опубликован</dt>
                  <dd>{formatTimestamp(releaseDate)}</dd>
                </div>
                <div className="update-meta-item">
                  <dt>Статус</dt>
                  <dd>{getStatusLabel(autoUpdateState)}</dd>
                </div>
              </dl>

              {autoUpdateState?.status === 'downloading' && progress && (
                <section className="update-progress-card">
                  <div className="update-progress-header">
                    <strong>Загрузка обновления</strong>
                    <span>{Math.round(progress.percent)}%</span>
                  </div>
                  <div className="update-progress-track" aria-label="Прогресс загрузки">
                    <span style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
                  </div>
                  <p className="helper-text">
                    {formatFileSize(progress.transferred)} / {formatFileSize(progress.total)} · {getSpeedLabel(progress.bytesPerSecond)}
                  </p>
                </section>
              )}

              {autoUpdateState?.status === 'downloaded' && (
                <p className="update-inline-message is-success">
                  Обновление скачано. Установка начнётся только после кнопки “Установить и перезапустить”.
                </p>
              )}

              <section className="update-notes-card">
                <h2 className="settings-section-title">Что нового</h2>
                {releaseNoteItems.length > 0 ? (
                  <div className="update-note-list">
                    {releaseNoteItems.map((item, index) => (
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
                  <p className="update-inline-message">Описание релиза не заполнено.</p>
                )}
              </section>
            </div>

            <footer className="button-row close-confirm-actions update-actions no-drag">
              <button
                ref={laterButtonRef}
                className="button-secondary"
                type="button"
                onClick={() => window.close()}
              >
                Позже
              </button>
              {manualUpdateInfo?.releaseUrl && (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void handleOpenRelease()}
                >
                  Открыть релиз
                </button>
              )}
              {showManualDownload && (
                <button
                  className="button-secondary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleManualDownload()}
                >
                  {actionBusy === 'manual' ? 'Открываем…' : 'Скачать вручную'}
                </button>
              )}
              {canAutoDownload && (
                <button
                  className="button-primary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleAutoDownload()}
                >
                  {actionBusy === 'download' ? 'Запускаем загрузку…' : 'Скачать обновление'}
                </button>
              )}
              {canInstall && (
                <button
                  className="button-primary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleInstall()}
                >
                  {actionBusy === 'install' ? 'Устанавливаем…' : 'Установить и перезапустить'}
                </button>
              )}
            </footer>
          </>
        ) : (
          <>
            <div className="update-content update-content-empty">
              <p className="close-confirm-message">
                Данные обновления пока недоступны. Попробуйте проверить обновления ещё раз из
                настроек.
              </p>
            </div>
            <footer className="button-row close-confirm-actions update-actions no-drag">
              <button
                ref={laterButtonRef}
                className="button-secondary"
                type="button"
                onClick={() => window.close()}
              >
                Закрыть
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
