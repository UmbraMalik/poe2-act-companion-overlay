const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const requiredFiles = [
  'src/renderer/hooks.ts',
  'src/renderer/hooks/app-snapshot.ts',
  'src/renderer/hooks/live-now.ts',
  'src/renderer/hooks/live-run-timer.ts',
  'src/renderer/overlay/OverlayTimerText.tsx',
  'src/renderer/overlay/overlay-page-model.ts',
  'src/renderer/companion/companion-page-model.tsx',
  'src/renderer/settings/settings-page-model.tsx'
];

const lineBudgets = new Map([
  ['src/renderer/hooks.ts', 80],
  ['src/renderer/pages/OverlayPage.tsx', 1200],
  ['src/renderer/pages/CompanionPage.tsx', 900],
  ['src/renderer/pages/SettingsPage.tsx', 1300]
]);

const problems = [];

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    problems.push(`Missing renderer module: ${relativePath}`);
  }
}

for (const [relativePath, maxLines] of lineBudgets) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    continue;
  }

  const lineCount = readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
  if (lineCount > maxLines) {
    problems.push(`${relativePath} is ${lineCount} lines, expected <= ${maxLines}`);
  }
}

if (problems.length > 0) {
  console.error('[check:renderer-modules] Renderer source module check failed:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('[check:renderer-modules] Renderer source module structure is clean.');
