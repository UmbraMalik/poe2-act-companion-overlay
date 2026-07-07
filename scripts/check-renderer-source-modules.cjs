const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = process.cwd();

const lineBudgets = new Map([
  ['src/renderer/hooks.ts', 1700],
  ['src/renderer/pages/OverlayPage.tsx', 2150],
  ['src/renderer/pages/CompanionPage.tsx', 2450],
  ['src/renderer/pages/SettingsPage.tsx', 1600]
]);

const problems = [];

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
