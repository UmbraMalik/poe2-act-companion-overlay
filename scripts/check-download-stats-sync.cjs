const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mirroredFiles = [
  'stats/downloads.json',
  'stats/downloads-state.json'
];

const problems = [];

for (const relativePath of mirroredFiles) {
  const sourcePath = path.join(root, relativePath);
  const docsPath = path.join(root, 'docs', relativePath);

  if (!existsSync(sourcePath)) {
    problems.push(`Missing root stats mirror: ${relativePath}`);
    continue;
  }

  if (!existsSync(docsPath)) {
    problems.push(`Missing docs stats source: docs/${relativePath}`);
    continue;
  }

  const sourceContent = readFileSync(sourcePath, 'utf8');
  const docsContent = readFileSync(docsPath, 'utf8');

  if (sourceContent !== docsContent) {
    problems.push(`${relativePath} differs from docs/${relativePath}`);
  }
}

if (problems.length > 0) {
  console.error('[check:download-stats] Download stats mirror check failed:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error('[check:download-stats] Sync root stats from docs/stats before release.');
  process.exit(1);
}

console.log('[check:download-stats] Download stats mirrors are in sync.');
