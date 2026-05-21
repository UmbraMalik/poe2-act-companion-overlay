import type {
  GitHubReleaseAsset,
  UpdateCheckResult,
  UpdateInfo
} from '../../shared/types';

const RELEASES_API_URL =
  'https://api.github.com/repos/UmbraMalik/poe2-act-companion-overlay/releases/latest';
const GENERIC_UPDATE_ERROR =
  'Не удалось проверить обновления. Проверь интернет/VPN или попробуй позже.';
const INSTALLER_NOT_FOUND_ERROR = 'В релизе не найден установщик.';

interface GitHubReleaseResponse {
  tag_name: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  assets: GitHubReleaseAsset[];
}

function normalizeVersion(value: string): string {
  return String(value ?? '')
    .trim()
    .replace(/^v/i, '');
}

function parseVersionParts(version: string): number[] {
  const normalized = normalizeVersion(version);
  const coreVersion = normalized.split(/[+-]/, 1)[0] ?? '';

  return coreVersion.split('.').map((segment) => {
    const parsed = Number.parseInt(segment, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  });
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) {
      return 1;
    }

    if (leftPart < rightPart) {
      return -1;
    }
  }

  return 0;
}

function isGitHubReleaseAsset(value: unknown): value is GitHubReleaseAsset {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const asset = value as Record<string, unknown>;
  return (
    typeof asset.name === 'string' &&
    typeof asset.browser_download_url === 'string' &&
    (asset.size === undefined || typeof asset.size === 'number')
  );
}

function isGitHubReleaseResponse(value: unknown): value is GitHubReleaseResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const release = value as Record<string, unknown>;
  return (
    typeof release.tag_name === 'string' &&
    Array.isArray(release.assets) &&
    release.assets.every((asset) => isGitHubReleaseAsset(asset))
  );
}

function findInstallerAsset(assets: GitHubReleaseAsset[]): GitHubReleaseAsset | null {
  const executableAssets = assets.filter((asset) =>
    asset.name.toLowerCase().endsWith('.exe')
  );

  if (executableAssets.length === 0) {
    return null;
  }

  const preferredAsset = executableAssets.find((asset) =>
    asset.name.toLowerCase().includes('setup')
  );

  return preferredAsset ?? executableAssets[0] ?? null;
}

function toErrorResult(currentVersion: string, message: string): UpdateCheckResult {
  return {
    status: 'error',
    currentVersion,
    message
  };
}

function buildUpdateInfo(
  currentVersion: string,
  latestVersion: string,
  release: GitHubReleaseResponse,
  installerAsset: GitHubReleaseAsset
): UpdateInfo {
  const releaseName =
    typeof release.name === 'string' && release.name.trim()
      ? release.name.trim()
      : latestVersion;
  const releaseUrl =
    typeof release.html_url === 'string' && release.html_url.trim()
      ? release.html_url.trim()
      : `https://github.com/UmbraMalik/poe2-act-companion-overlay/releases/tag/${release.tag_name}`;

  return {
    currentVersion,
    latestVersion,
    releaseName,
    releaseUrl,
    downloadUrl: installerAsset.browser_download_url,
    body: typeof release.body === 'string' ? release.body.trim() : '',
    publishedAt:
      typeof release.published_at === 'string' ? release.published_at : undefined,
    assetName: installerAsset.name
  };
}

export async function checkForUpdates(
  currentVersionInput: string
): Promise<UpdateCheckResult> {
  const currentVersion = normalizeVersion(currentVersionInput);
  const requestUrl = `${RELEASES_API_URL}?t=${Date.now()}`;

  try {
    const response = await fetch(requestUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'POE2 Act Companion Overlay'
      }
    });

    if (!response.ok) {
      return toErrorResult(currentVersion, GENERIC_UPDATE_ERROR);
    }

    const payload = (await response.json()) as unknown;
    if (!isGitHubReleaseResponse(payload)) {
      return toErrorResult(currentVersion, GENERIC_UPDATE_ERROR);
    }

    const latestVersion = normalizeVersion(payload.tag_name);
    const installerAsset = findInstallerAsset(payload.assets);

    if (!installerAsset) {
      return {
        status: 'error',
        currentVersion,
        latestVersion,
        message: INSTALLER_NOT_FOUND_ERROR
      };
    }

    if (compareVersions(latestVersion, currentVersion) > 0) {
      return {
        status: 'available',
        currentVersion,
        latestVersion,
        update: buildUpdateInfo(currentVersion, latestVersion, payload, installerAsset)
      };
    }

    return {
      status: 'none',
      currentVersion,
      latestVersion
    };
  } catch {
    return toErrorResult(currentVersion, GENERIC_UPDATE_ERROR);
  }
}
