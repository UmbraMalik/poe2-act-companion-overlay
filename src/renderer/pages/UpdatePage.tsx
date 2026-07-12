import { useEffect, useMemo, useRef, useState } from 'react';
import type { AutoUpdateState, UpdateInfo } from '../../shared/types';
import { translateSystemText } from '../../i18n/runtime';
import { formatFileSize, formatTimestamp, getReleaseNoteItems } from '../utils';
import { useDocumentTitle, useI18n } from '../useI18n';
import { UiIcon } from '../UiIcon';

function getSpeedLabel(bytesPerSecond: number | undefined): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) {
    return '—';
  }

  return `${formatFileSize(bytesPerSecond)}/s`;
}

export function UpdatePage() {
  const { t, language } = useI18n();
  const [manualUpdateInfo, setManualUpdateInfo] = useState<UpdateInfo | null>(null);
  const [autoUpdateState, setAutoUpdateState] = useState<AutoUpdateState | null>(null);
  const [actionBusy, setActionBusy] = useState<'download' | 'install' | 'manual' | null>(null);
  const laterButtonRef = useRef<HTMLButtonElement | null>(null);

  useDocumentTitle(t('titles.update'));

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
  const releaseName = autoUpdateState?.releaseName ?? manualUpdateInfo?.releaseName ?? `POE2 Act Companion Overlay ${latestVersion}`;
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

  const statusLabel = autoUpdateState?.status === 'checking'
    ? t('update.checking')
    : autoUpdateState?.status === 'available'
      ? t('update.available')
      : autoUpdateState?.status === 'downloading'
        ? t('update.downloading')
        : autoUpdateState?.status === 'downloaded'
          ? t('update.downloaded')
          : autoUpdateState?.status === 'not_available'
            ? t('update.upToDate')
            : autoUpdateState?.status === 'error'
              ? t('update.error')
              : t('update.waiting');

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
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{canInstall ? t('update.downloaded') : t('update.newVersion')}</h1>
          </div>
          <button
            className="button-secondary close-confirm-close no-drag"
            type="button"
            aria-label={t('update.closeLabel')}
            title={t('common.later')}
            onClick={() => window.close()}
          >
            <UiIcon name="close" />
          </button>
        </header>

        {autoUpdateState || manualUpdateInfo ? (
          <>
            <div className="update-content">
              <div className="update-status-banner">
                <strong>{statusLabel}</strong>
                {autoUpdateState?.status === 'error' && autoUpdateState.errorMessage && (
                  <span>{translateSystemText(autoUpdateState.errorMessage, language)}</span>
                )}
                {autoUpdateState?.status === 'error' && (
                  <span>{t('update.vpnHint')}</span>
                )}
              </div>

              <div className="update-version-row">
                <div className="update-version-card">
                  <span>{t('update.currentVersion')}</span>
                  <strong>{currentVersion}</strong>
                </div>
                <div className="update-version-card">
                  <span>{t('update.latestVersion')}</span>
                  <strong>{latestVersion}</strong>
                </div>
              </div>

              <dl className="update-meta-grid">
                <div className="update-meta-item">
                  <dt>{t('update.release')}</dt>
                  <dd>{releaseName}</dd>
                </div>
                <div className="update-meta-item">
                  <dt>{t('update.published')}</dt>
                  <dd>{formatTimestamp(releaseDate, language)}</dd>
                </div>
                <div className="update-meta-item">
                  <dt>{t('update.status')}</dt>
                  <dd>{statusLabel}</dd>
                </div>
              </dl>

              {autoUpdateState?.status === 'downloading' && progress && (
                <section className="update-progress-card">
                  <div className="update-progress-header">
                    <strong>{t('update.downloadTitle')}</strong>
                    <span>{Math.round(progress.percent)}%</span>
                  </div>
                  <div className="update-progress-track" aria-label={t('update.progress')}>
                    <span style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }} />
                  </div>
                  <p className="helper-text">
                    {formatFileSize(progress.transferred)} / {formatFileSize(progress.total)} · {getSpeedLabel(progress.bytesPerSecond)}
                  </p>
                </section>
              )}

              {autoUpdateState?.status === 'downloaded' && (
                <p className="update-inline-message is-success">{t('update.downloadedInfo')}</p>
              )}

              <section className="update-notes-card">
                <h2 className="settings-section-title">{t('update.whatsNew')}</h2>
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
                  <p className="update-inline-message">{t('update.emptyNotes')}</p>
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
                {t('common.later')}
              </button>
              {manualUpdateInfo?.releaseUrl && (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void handleOpenRelease()}
                >
                  {t('update.openRelease')}
                </button>
              )}
              {showManualDownload && (
                <button
                  className="button-secondary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleManualDownload()}
                >
                  {actionBusy === 'manual' ? t('update.manualDownloadBusy') : t('update.manualDownload')}
                </button>
              )}
              {canAutoDownload && (
                <button
                  className="button-primary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleAutoDownload()}
                >
                  {actionBusy === 'download' ? t('update.autoDownloadBusy') : t('update.autoDownload')}
                </button>
              )}
              {canInstall && (
                <button
                  className="button-primary"
                  type="button"
                  disabled={actionBusy !== null}
                  onClick={() => void handleInstall()}
                >
                  {actionBusy === 'install' ? t('update.installBusy') : t('update.install')}
                </button>
              )}
            </footer>
          </>
        ) : (
          <>
            <div className="update-content update-content-empty">
              <p className="close-confirm-message">{t('update.emptyState')}</p>
            </div>
            <footer className="button-row close-confirm-actions update-actions no-drag">
              <button
                ref={laterButtonRef}
                className="button-secondary"
                type="button"
                onClick={() => window.close()}
              >
                {t('common.close')}
              </button>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}
