import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY_LINKS,
  PROJECT_CHAT_URL,
  PROJECT_FEEDBACK_URL,
  PROJECT_RELEASES_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_SITE_URL,
  PROJECT_TELEGRAM_URL
} from '../src/shared/community-links';
import { readText } from './helpers/loadJson';

test('community links stay non-empty, unique and on the expected URLs', () => {
  const expectedUrls = [
    PROJECT_SITE_URL,
    PROJECT_TELEGRAM_URL,
    PROJECT_CHAT_URL,
    PROJECT_FEEDBACK_URL,
    PROJECT_RELEASES_URL,
    PROJECT_REPOSITORY_URL
  ];

  assert.deepEqual(
    COMMUNITY_LINKS.map((link) => link.url),
    expectedUrls
  );

  const uniqueUrls = new Set(COMMUNITY_LINKS.map((link) => link.url));
  assert.equal(uniqueUrls.size, COMMUNITY_LINKS.length);

  for (const link of COMMUNITY_LINKS) {
    assert.ok(link.title.trim().length > 0, 'link title must not be empty');
    assert.ok(link.description.trim().length > 0, 'link description must not be empty');
    assert.match(link.url, /^https:\/\//);
  }
});

test('support stays on its own page and the QR block does not reappear inside settings', () => {
  const supportPage = readText('src/renderer/pages/SupportPage.tsx');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');

  assert.match(supportPage, /support-qr\.png/);
  assert.match(supportPage, /Поддержать проект|support-qr/i);
  assert.doesNotMatch(settingsPage, /support-qr\.png/);
});
