import fs from 'node:fs/promises';
import path from 'node:path';

const RELEASES_REPO = process.env.RELEASES_REPO || 'UmbraMalik/poe2-act-companion-overlay';
const API_ROOT = 'https://api.github.com';
const STATS_DIR = path.resolve(process.cwd(), process.env.STATS_DIR || 'docs/stats');
const PUBLIC_STATS_PATH = path.join(STATS_DIR, 'downloads.json');
const STATE_PATH = path.join(STATS_DIR, 'downloads-state.json');

const now = new Date().toISOString();

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'poe2-act-companion-overlay-download-stats',
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function normalizeVersionTag(tagName) {
  if (!tagName) return 'unknown';
  return String(tagName).replace(/^v/i, '');
}

function isInstallerAsset(asset) {
  const name = String(asset?.name || '').toLowerCase();

  return (
    name.endsWith('.exe') &&
    !name.endsWith('.blockmap') &&
    (name.includes('setup') || name.includes('act-companion') || name.includes('act companion'))
  );
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(`${filePath}.tmp`, filePath);
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;

  for (const part of String(linkHeader).split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }

  return null;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`GitHub API request failed ${response.status} ${response.statusText}: ${url}\n${body}`);
  }

  return response.json();
}

async function fetchPagedJson(url) {
  const items = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`GitHub API request failed ${response.status} ${response.statusText}: ${nextUrl}\n${body}`);
    }

    const pageItems = await response.json();
    if (!Array.isArray(pageItems)) {
      throw new Error(`Expected array response from ${nextUrl}`);
    }

    items.push(...pageItems);
    nextUrl = parseNextLink(response.headers.get('link'));
  }

  return items;
}

function toCount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function sortObjectByKey(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'ru')));
}

function collectInstallerAssets(releases) {
  return releases.flatMap((release) => {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const version = normalizeVersionTag(release.tag_name || release.name);

    return assets.filter(isInstallerAsset).map((asset) => ({
      id: String(asset.id),
      version,
      file: asset.name,
      currentDownloadCount: toCount(asset.download_count),
      size: toCount(asset.size),
      browserDownloadUrl: asset.browser_download_url || null,
      releaseUrl: release.html_url || null,
      releaseName: release.name || release.tag_name || version,
      createdAt: asset.created_at || null,
      updatedAt: asset.updated_at || null,
    }));
  });
}

function getLatestVersion(releases, latestRelease) {
  if (latestRelease?.tag_name || latestRelease?.name) {
    return normalizeVersionTag(latestRelease.tag_name || latestRelease.name);
  }

  const sorted = [...releases]
    .filter((release) => !release.draft && !release.prerelease)
    .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));

  return normalizeVersionTag(sorted[0]?.tag_name || sorted[0]?.name);
}

function buildPublicStats(state, currentAssets, latestVersion, warnings) {
  const installerDownloadsByVersion = {};

  for (const asset of Object.values(state.assets || {})) {
    const version = normalizeVersionTag(asset.version);
    installerDownloadsByVersion[version] = (installerDownloadsByVersion[version] || 0) + toCount(asset.countedDownloads);
  }

  const githubCurrentInstallerDownloads = currentAssets.reduce(
    (sum, asset) => sum + asset.currentDownloadCount,
    0,
  );

  const currentInstallerDownloads = currentAssets
    .filter((asset) => normalizeVersionTag(asset.version) === normalizeVersionTag(latestVersion))
    .reduce((sum, asset) => sum + asset.currentDownloadCount, 0);

  const manualAdjustmentDownloads = toCount(state.manualAdjustmentDownloads);

  return {
    schemaVersion: 1,
    totalDownloads: toCount(state.totalDownloads),
    latestVersion: normalizeVersionTag(latestVersion),
    updatedAt: now,
    source: 'monotonic-github-releases-snapshot',
    countsOnly: 'installer .exe assets; latest.yml, .blockmap and source archives are excluded',
    currentInstallerDownloads,
    githubCurrentInstallerDownloads,
    manualAdjustmentDownloads,
    installerDownloadsByVersion: sortObjectByKey(installerDownloadsByVersion),
    trackedInstallerAssets: Object.keys(state.assets || {}).length,
    visibleInstallerAssets: currentAssets.length,
    counterDropDetected: warnings.some((warning) => warning.type === 'download_count_decreased'),
    missingAssetDetected: warnings.some((warning) => warning.type === 'asset_missing_from_github_api'),
    warnings: warnings.slice(-20),
  };
}

function buildInitialState(rawState) {
  return {
    schemaVersion: 1,
    totalDownloads: toCount(rawState.totalDownloads),
    manualAdjustmentDownloads: toCount(rawState.manualAdjustmentDownloads),
    assets: rawState.assets && typeof rawState.assets === 'object' ? rawState.assets : {},
    runs: Array.isArray(rawState.runs) ? rawState.runs : [],
  };
}

async function main() {
  const rawState = await readJson(STATE_PATH, {
    schemaVersion: 1,
    totalDownloads: 0,
    manualAdjustmentDownloads: 0,
    assets: {},
    runs: [],
  });

  const state = buildInitialState(rawState);

  const releasesUrl = `${API_ROOT}/repos/${RELEASES_REPO}/releases?per_page=100`;
  const latestUrl = `${API_ROOT}/repos/${RELEASES_REPO}/releases/latest`;

  const [releases, latestRelease] = await Promise.all([
    fetchPagedJson(releasesUrl),
    fetchJson(latestUrl).catch(() => null),
  ]);

  const currentAssets = collectInstallerAssets(releases);
  const currentAssetIds = new Set(currentAssets.map((asset) => asset.id));
  const hadTrackedAssets = Object.keys(state.assets).length > 0;
  const currentInstallerSum = currentAssets.reduce((sum, asset) => sum + asset.currentDownloadCount, 0);
  const warnings = [];

  let totalDownloads = toCount(state.totalDownloads);
  let manualAdjustmentDownloads = toCount(state.manualAdjustmentDownloads);

  // Bootstrap mode:
  // If downloads-state.json was created with a public baseline but without GitHub asset IDs,
  // adopt the current GitHub asset counters as already counted. This avoids double-counting
  // the first scheduled run while still preserving a non-decreasing public total.
  const shouldAdoptCurrentCounters = !hadTrackedAssets && totalDownloads > 0;

  if (shouldAdoptCurrentCounters) {
    manualAdjustmentDownloads = Math.max(manualAdjustmentDownloads, totalDownloads - currentInstallerSum, 0);
    totalDownloads = Math.max(totalDownloads, currentInstallerSum + manualAdjustmentDownloads);
  }

  const nextAssets = { ...state.assets };

  for (const asset of currentAssets) {
    const previous = state.assets[asset.id];
    const currentCount = asset.currentDownloadCount;

    if (shouldAdoptCurrentCounters || !previous) {
      if (!shouldAdoptCurrentCounters) {
        totalDownloads += currentCount;
      }

      nextAssets[asset.id] = {
        version: asset.version,
        file: asset.file,
        browserDownloadUrl: asset.browserDownloadUrl,
        releaseUrl: asset.releaseUrl,
        size: asset.size,
        firstSeenAt: previous?.firstSeenAt || now,
        lastSeenAt: now,
        lastSeenDownloadCount: currentCount,
        highestSeenDownloadCount: currentCount,
        countedDownloads: currentCount,
        missingSince: null,
      };

      continue;
    }

    const highestSeenDownloadCount = toCount(
      previous.highestSeenDownloadCount ?? previous.lastSeenDownloadCount ?? previous.countedDownloads,
    );
    let countedDownloads = toCount(previous.countedDownloads ?? highestSeenDownloadCount);
    let nextHighestSeenDownloadCount = highestSeenDownloadCount;

    if (currentCount > highestSeenDownloadCount) {
      const delta = currentCount - highestSeenDownloadCount;
      totalDownloads += delta;
      countedDownloads += delta;
      nextHighestSeenDownloadCount = currentCount;
    } else if (currentCount < highestSeenDownloadCount) {
      warnings.push({
        type: 'download_count_decreased',
        assetId: asset.id,
        version: asset.version,
        file: asset.file,
        previousHighest: highestSeenDownloadCount,
        current: currentCount,
        detectedAt: now,
      });
    }

    nextAssets[asset.id] = {
      ...previous,
      version: asset.version,
      file: asset.file,
      browserDownloadUrl: asset.browserDownloadUrl,
      releaseUrl: asset.releaseUrl,
      size: asset.size,
      lastSeenAt: now,
      lastSeenDownloadCount: currentCount,
      highestSeenDownloadCount: nextHighestSeenDownloadCount,
      countedDownloads,
      missingSince: null,
    };
  }

  for (const [assetId, asset] of Object.entries(nextAssets)) {
    if (!currentAssetIds.has(assetId)) {
      if (!asset.missingSince) {
        nextAssets[assetId] = {
          ...asset,
          missingSince: now,
        };
      }

      warnings.push({
        type: 'asset_missing_from_github_api',
        assetId,
        version: asset.version,
        file: asset.file,
        countedDownloads: toCount(asset.countedDownloads),
        detectedAt: now,
      });
    }
  }

  const contributedDownloads = Object.values(nextAssets)
    .reduce((sum, asset) => sum + toCount(asset.countedDownloads), 0) + manualAdjustmentDownloads;

  totalDownloads = Math.max(totalDownloads, contributedDownloads);

  const latestVersion = getLatestVersion(releases, latestRelease);
  const nextState = {
    schemaVersion: 1,
    totalDownloads,
    manualAdjustmentDownloads,
    updatedAt: now,
    sourceRepo: RELEASES_REPO,
    assets: Object.fromEntries(
      Object.entries(nextAssets).sort(([, a], [, b]) => {
        const versionCompare = normalizeVersionTag(b.version).localeCompare(normalizeVersionTag(a.version), 'ru', { numeric: true });
        if (versionCompare !== 0) return versionCompare;
        return String(a.file).localeCompare(String(b.file), 'ru');
      }),
    ),
    runs: [
      ...(state.runs || []).slice(-29),
      {
        ranAt: now,
        latestVersion,
        visibleInstallerAssets: currentAssets.length,
        githubCurrentInstallerDownloads: currentInstallerSum,
        totalDownloads,
        warningsCount: warnings.length,
      },
    ],
  };

  const publicStats = buildPublicStats(nextState, currentAssets, latestVersion, warnings);

  await writeJson(STATE_PATH, nextState);
  await writeJson(PUBLIC_STATS_PATH, publicStats);

  console.log(`Latest version: ${latestVersion}`);
  console.log(`GitHub current installer downloads: ${currentInstallerSum}`);
  console.log(`Monotonic total downloads: ${totalDownloads}`);
  console.log(`Tracked installer assets: ${Object.keys(nextState.assets).length}`);

  if (warnings.length > 0) {
    console.log(`Warnings: ${warnings.length}`);
    for (const warning of warnings) {
      console.log(JSON.stringify(warning));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
