import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { AutoUpdateState, AutoUpdateProgress } from '../../shared/types';
import { checkForUpdates as checkGitHubReleaseUpdates } from './update-service';


const GITHUB_UPDATE_FEED = {
  provider: 'github' as const,
  owner: 'UmbraMalik',
  repo: 'poe2-campaign-codex-releases'
};

const GENERIC_AUTO_UPDATE_ERROR =
  'Не удалось проверить обновления. Проверь интернет или попробуй позже.';
const LATEST_YML_AUTO_UPDATE_ERROR =
  'Не удалось проверить автообновление: в последнем релизе не найден latest.yml. Проверь assets релиза.';
const INSTALLER_FALLBACK_ERROR =
  'Новая версия найдена, но автоматическое обновление недоступно. Открой релиз и скачай установщик вручную.';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return '';
}

function getUserFacingUpdateError(error: unknown, fallback = GENERIC_AUTO_UPDATE_ERROR): string {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('latest.yml')) {
    return LATEST_YML_AUTO_UPDATE_ERROR;
  }

  if (lowerMessage.includes('404')) {
    return 'Не удалось проверить обновления: GitHub вернул 404 для файла обновления.';
  }

  if (lowerMessage.includes('net::') || lowerMessage.includes('network') || lowerMessage.includes('timeout')) {
    return GENERIC_AUTO_UPDATE_ERROR;
  }

  return fallback;
}

function normalizeReleaseNotes(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry;
        }

        if (entry && typeof entry === 'object') {
          const note = entry as { note?: unknown };
          return typeof note.note === 'string' ? note.note : '';
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function toProgress(progress: {
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
}): AutoUpdateProgress {
  return {
    percent: Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent ?? 0)) : 0,
    transferred: Number.isFinite(progress.transferred) ? progress.transferred ?? 0 : 0,
    total: Number.isFinite(progress.total) ? progress.total ?? 0 : 0,
    bytesPerSecond: Number.isFinite(progress.bytesPerSecond) ? progress.bytesPerSecond ?? 0 : 0
  };
}

export class AutoUpdateService {
  private state: AutoUpdateState;
  private listeners = new Set<(state: AutoUpdateState) => void>();
  private isDownloading = false;

  constructor() {
    this.state = {
      status: 'idle',
      currentVersion: app.getVersion()
    };

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;

    // Be explicit: repo must be just the repository name, without /releases.
    autoUpdater.setFeedURL(GITHUB_UPDATE_FEED as any);

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        status: 'checking',
        currentVersion: app.getVersion(),
        errorMessage: undefined,
        downloadProgress: undefined
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.isDownloading = false;
      this.setState({
        status: 'available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseName: info.releaseName || `PoE2 Campaign Codex Overlay ${info.version}`,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        errorMessage: undefined,
        downloadProgress: undefined
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.isDownloading = false;
      this.setState({
        status: 'not_available',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseName: info.releaseName || undefined,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseDate: info.releaseDate,
        errorMessage: undefined,
        downloadProgress: undefined
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.setState({
        ...this.state,
        status: 'downloading',
        currentVersion: app.getVersion(),
        downloadProgress: toProgress(progress),
        errorMessage: undefined
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.isDownloading = false;
      this.setState({
        status: 'downloaded',
        currentVersion: app.getVersion(),
        latestVersion: info.version,
        releaseName: info.releaseName || this.state.releaseName,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) || this.state.releaseNotes,
        releaseDate: info.releaseDate || this.state.releaseDate,
        downloadProgress: {
          percent: 100,
          transferred: this.state.downloadProgress?.total ?? 0,
          total: this.state.downloadProgress?.total ?? 0,
          bytesPerSecond: 0
        },
        errorMessage: undefined
      });
    });

    autoUpdater.on('error', (error) => {
      this.isDownloading = false;
      console.error('[AutoUpdate] electron-updater error.', error);
      this.setState({
        ...this.state,
        status: 'error',
        currentVersion: app.getVersion(),
        errorMessage: getUserFacingUpdateError(
          error,
          'Не удалось проверить или скачать обновление.'
        )
      });
    });
  }

  getState(): AutoUpdateState {
    return { ...this.state, downloadProgress: this.state.downloadProgress ? { ...this.state.downloadProgress } : undefined };
  }

  onStateChanged(callback: (state: AutoUpdateState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async checkForUpdates(): Promise<AutoUpdateState> {
    this.setState({
      status: 'checking',
      currentVersion: app.getVersion(),
      errorMessage: undefined,
      downloadProgress: undefined
    });

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error('[AutoUpdate] Failed to check auto updates.', error);
      await this.applyGitHubReleaseFallback(error);
    }

    return this.getState();
  }

  async downloadUpdate(): Promise<AutoUpdateState> {
    if (this.isDownloading || this.state.status === 'downloading') {
      return this.getState();
    }

    if (this.state.status !== 'available' && this.state.status !== 'error') {
      return this.getState();
    }

    this.isDownloading = true;
    this.setState({
      ...this.state,
      status: 'downloading',
      currentVersion: app.getVersion(),
      downloadProgress: {
        percent: 0,
        transferred: 0,
        total: 0,
        bytesPerSecond: 0
      },
      errorMessage: undefined
    });

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.isDownloading = false;
      console.error('[AutoUpdate] Failed to download update.', error);
      this.setState({
        ...this.state,
        status: 'error',
        currentVersion: app.getVersion(),
        errorMessage: getUserFacingUpdateError(error, 'Не удалось скачать обновление.')
      });
    }

    return this.getState();
  }

  private async applyGitHubReleaseFallback(error: unknown): Promise<void> {
    const fallbackMessage = getUserFacingUpdateError(error);

    try {
      const fallbackResult = await checkGitHubReleaseUpdates(app.getVersion());

      if (fallbackResult.status === 'none') {
        this.isDownloading = false;
        this.setState({
          status: 'not_available',
          currentVersion: app.getVersion(),
          latestVersion: fallbackResult.latestVersion,
          errorMessage: undefined,
          downloadProgress: undefined
        });
        return;
      }

      if (fallbackResult.status === 'available' && fallbackResult.update) {
        this.isDownloading = false;
        this.setState({
          status: 'error',
          currentVersion: app.getVersion(),
          latestVersion: fallbackResult.latestVersion ?? fallbackResult.update.latestVersion,
          releaseName: fallbackResult.update.releaseName,
          releaseNotes: fallbackResult.update.body,
          releaseDate: fallbackResult.update.publishedAt,
          downloadProgress: undefined,
          errorMessage: fallbackMessage === LATEST_YML_AUTO_UPDATE_ERROR
            ? `${LATEST_YML_AUTO_UPDATE_ERROR} ${INSTALLER_FALLBACK_ERROR}`
            : INSTALLER_FALLBACK_ERROR
        });
        return;
      }
    } catch (fallbackError) {
      console.error('[AutoUpdate] GitHub Releases fallback failed.', fallbackError);
    }

    this.isDownloading = false;
    this.setState({
      ...this.state,
      status: 'error',
      currentVersion: app.getVersion(),
      errorMessage: fallbackMessage
    });
  }

  quitAndInstall(): void {
    autoUpdater.quitAndInstall(false, true);
  }

  private setState(nextState: AutoUpdateState): void {
    this.state = {
      ...nextState,
      currentVersion: app.getVersion()
    };

    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
