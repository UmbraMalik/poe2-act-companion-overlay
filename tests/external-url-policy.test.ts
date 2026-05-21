import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EXTERNAL_URL_EXAMPLES,
  isAllowedExternalUrl
} from '../src/shared/external-url-policy';
import {
  PROJECT_DONATION_ALERTS_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_SITE_URL
} from '../src/shared/community-links';

const oldCampaignSlug = ['poe2', 'campaign-codex'].join('-');
const oldTelegramChannel = ['POE2', 'Campaign', 'Codex'].join('');
const obsoleteCompanionReleasesRepo = ['poe2-act-companion-overlay', 'releases'].join('-');

const allowedUrls = [
  ...ALLOWED_EXTERNAL_URL_EXAMPLES,
  PROJECT_SITE_URL,
  `${PROJECT_SITE_URL}changelog`,
  `${PROJECT_SITE_URL}download`,
  PROJECT_REPOSITORY_URL,
  `${PROJECT_REPOSITORY_URL}/`,
  PROJECT_RELEASES_URL,
  `${PROJECT_RELEASES_URL}/latest`,
  'https://github.com/UmbraMalik/poe2-act-companion-overlay/releases/download/v0.2.10/POE2-Act-Companion-Overlay-Setup-0.2.10.exe',
  'https://t.me/POE2ActCompanion',
  'https://t.me/POE2ActCompanionChat',
  'https://t.me/POE2ActCompanion?direct',
  PROJECT_DONATION_ALERTS_URL
];

const blockedUrls = [
  null,
  '',
  'not-a-url',
  `https://umbramalik.github.io/${oldCampaignSlug}/`,
  `https://umbramalik.github.io/${oldCampaignSlug}/changelog`,
  `https://github.com/UmbraMalik/${oldCampaignSlug}-releases`,
  `https://github.com/UmbraMalik/${obsoleteCompanionReleasesRepo}`,
  `https://t.me/${oldTelegramChannel}`,
  'https://example.com',
  'http://umbramalik.github.io/poe2-act-companion-overlay/',
  'https://evil.com',
  'https://user:pass@github.com/UmbraMalik/poe2-act-companion-overlay',
  'https://github.com/UmbraMalik/poe2-act-companion-overlay#fragment'
];

test('external URL policy allows only project-owned links opened from the renderer', () => {
  for (const url of allowedUrls) {
    assert.equal(isAllowedExternalUrl(url), true, `expected allowed URL: ${String(url)}`);
  }

  for (const url of blockedUrls) {
    assert.equal(isAllowedExternalUrl(url), false, `expected blocked URL: ${String(url)}`);
  }
});
