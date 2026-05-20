#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const forbidden = [
  'src/data/data.zip',
  'src/renderer/i18n-runtime.js',
  'src/renderer/i18n-runtime.ts',
  'src/i18n/legacy-data-translations.json',
];

const found = forbidden.filter((relativePath) => fs.existsSync(path.join(root, relativePath)));

if (found.length > 0) {
  console.error('[check:artifacts] Stale generated/legacy source artifacts are not allowed:');
  for (const relativePath of found) {
    console.error(`  - ${relativePath}`);
  }
  process.exit(1);
}

console.log('[check:artifacts] No stale source artifacts found.');
