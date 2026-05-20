import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EXTERNAL_URL_EXAMPLES,
  isAllowedExternalUrl
} from '../src/shared/external-url-policy';

const allowedUrls = [
  ...ALLOWED_EXTERNAL_URL_EXAMPLES,
  'https://umbramalik.github.io/poe2-campaign-codex/changelog',
  'https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases/latest',
  'https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases/download/v0.2.10/PoE2-Campaign-Codex-Overlay-Setup-0.2.10.exe'
];

const blockedUrls = [
  null,
  '',
  'not-a-url',
  'http://umbramalik.github.io/poe2-campaign-codex/',
  'https://example.com/',
  'https://github.com/UmbraMalik/other-repo/releases/latest',
  'https://github.com/OtherUser/poe2-campaign-codex-releases/releases/latest',
  'https://umbramalik.github.io/other-project/',
  'https://t.me/SomeOtherChannel',
  'https://www.donationalerts.com/r/someoneelse',
  'https://umbramalik.github.io/poe2-campaign-codex/#install',
  'https://github.com/UmbraMalik/poe2-campaign-codex-releases/releases/latest?download=1',
  'https://user:pass@github.com/UmbraMalik/poe2-campaign-codex-releases/releases/latest'
];

test('external URL policy allows only project-owned links opened from the renderer', () => {
  for (const url of allowedUrls) {
    assert.equal(isAllowedExternalUrl(url), true, `expected allowed URL: ${String(url)}`);
  }

  for (const url of blockedUrls) {
    assert.equal(isAllowedExternalUrl(url), false, `expected blocked URL: ${String(url)}`);
  }
});
