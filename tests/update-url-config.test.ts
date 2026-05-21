import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readText } from './helpers/loadJson';

test('auto-update and release URLs target the main renamed GitHub repository', () => {
  const packageJson = readJson('package.json') as any;
  const autoUpdateService = readText('src/main/services/auto-update-service.ts');
  const updateService = readText('src/main/services/update-service.ts');
  const settingsPage = readText('src/renderer/pages/SettingsPage.tsx');
  const communityLinks = readText('src/shared/community-links.ts');

  assert.equal(packageJson.build?.publish?.[0]?.repo, 'poe2-act-companion-overlay');
  assert.match(autoUpdateService, /repo:\s*'poe2-act-companion-overlay'/);
  assert.match(updateService, /https:\/\/api\.github\.com\/repos\/UmbraMalik\/poe2-act-companion-overlay\/releases\/latest/);
  assert.match(updateService, /https:\/\/github\.com\/UmbraMalik\/poe2-act-companion-overlay\/releases\/tag\//);
  assert.match(settingsPage, /https:\/\/github\.com\/UmbraMalik\/poe2-act-companion-overlay\/releases\/latest/);
  assert.match(communityLinks, /https:\/\/github\.com\/UmbraMalik\/poe2-act-companion-overlay\/releases/);
  assert.match(communityLinks, /https:\/\/www\.donationalerts\.com\/r\/umbramalik/);

  const combined = [
    JSON.stringify(packageJson),
    autoUpdateService,
    updateService,
    settingsPage,
    communityLinks
  ].join('\n');

  const oldCampaignSlug = ['poe2', 'campaign-codex'].join('-');
  const obsoleteCompanionReleasesRepo = ['poe2-act-companion-overlay', 'releases'].join('-');

  assert.doesNotMatch(combined, new RegExp(oldCampaignSlug, 'i'));
  assert.doesNotMatch(combined, new RegExp(obsoleteCompanionReleasesRepo, 'i'));
});
