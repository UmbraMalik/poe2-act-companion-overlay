#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const problems = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    problems.push(`Missing ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

function requireContent(relativePath, minimumLength) {
  const content = read(relativePath).trim();
  if (content.length < minimumLength) {
    problems.push(`${relativePath} is too short for a release document`);
  }
}

function requireAsset(relativePath, minimumBytes) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    problems.push(`Missing screenshot ${relativePath}`);
    return;
  }
  const size = fs.statSync(absolutePath).size;
  if (size < minimumBytes) {
    problems.push(`${relativePath} looks empty or stale (${size} bytes)`);
  }
}

requireContent('README.md', 1_500);
requireContent('CHANGELOG.md', 1_000);
requireContent('RELEASE_SMOKE.md', 2_500);
requireAsset('assets/screens/overlay-real-reference-full.png', 40_000);
requireAsset('assets/screens/panel-current-zone-ru.png', 40_000);
requireAsset('assets/screens/timer-mode-reference.png', 20_000);

const packageJson = JSON.parse(read('package.json'));
const regressionScript = String(packageJson.scripts?.['test:regression'] ?? '');
if (!regressionScript.includes('check:release-readiness')) {
  problems.push('test:regression does not run check:release-readiness');
}
const checkedBuildScript = String(packageJson.scripts?.['build:checked:raw'] ?? '');
if (!checkedBuildScript.includes('check:bundle')) {
  problems.push('build:checked:raw does not enforce the renderer bundle budget');
}

const translations = read('src/i18n/translations.ts');
for (const staleKey of [
  'themePromptTitle',
  'themePromptText',
  'zoneHubIntro',
  'zoneHubAttentionCount',
  'zoneHubAttentionBreakdown',
  'zoneHubNextTitle',
  'zoneHubCurrentFocus'
]) {
  if (translations.includes(staleKey)) {
    problems.push(`Retired translation key is still present: ${staleKey}`);
  }
}

const styleDir = path.join(root, 'src', 'renderer', 'styles');
const styleSource = fs.readdirSync(styleDir)
  .filter((file) => file.endsWith('.css'))
  .map((file) => fs.readFileSync(path.join(styleDir, file), 'utf8'))
  .join('\n');
for (const retiredSelector of [
  '.companion-header-actions',
  '.companion-zone-dashboard',
  '.zone-run-hero-card',
  '.zone-run-status-grid',
  '.zone-attention-card',
  '.zone-next-step-card'
]) {
  if (styleSource.includes(retiredSelector)) {
    problems.push(`Retired CSS selector is still present: ${retiredSelector}`);
  }
}

const defaults = read('src/shared/defaults.ts');
const configStore = read('src/main/services/config-store.ts');
if (!defaults.includes('CURRENT_CONFIG_SCHEMA_VERSION')) {
  problems.push('Config schema version marker is missing from defaults');
}
if (!configStore.includes('configSchemaVersion: CURRENT_CONFIG_SCHEMA_VERSION')) {
  problems.push('Config normalization does not upgrade to the current schema version');
}
if (!configStore.includes('parsed.configSchemaVersion !== CURRENT_CONFIG_SCHEMA_VERSION')) {
  problems.push('Legacy config migration is not persisted after load');
}

const boundsController = read('src/main/app-overlay-bounds-controller.ts');
const windowController = read('src/main/app-window-controller.ts');
if (!boundsController.includes('runPersistCompanionBoundsImmediately')) {
  problems.push('Companion bounds are not flushed before hide or shutdown');
}
if (!boundsController.includes('fitBoundsToWorkArea')) {
  problems.push('Companion bounds are not fitted to the active display work area');
}
if (!windowController.includes('this.persistCompanionBoundsImmediately()')) {
  problems.push('Companion window lifecycle does not persist its latest bounds');
}

const navigationState = read('src/renderer/companion-navigation-state.ts');
if (!navigationState.includes('COMPANION_NAVIGATION_STORAGE_KEY')) {
  problems.push('Companion nested navigation persistence is missing');
}

if (problems.length > 0) {
  console.error('[check:release-readiness] Release source is not ready:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('[check:release-readiness] Documentation, screenshots, migrations and retired UI checks passed.');
