#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const generatedPaths = [
  '.tmp-tests',
  '.tmp-appdata',
  'dist',
  'dist-electron',
  'release',
  'out',
  'POE2ACT_regression_autotests',
  '123',
  '#U041d#U043e#U0432#U0430#U044f #U043f#U0430#U043f#U043a#U0430'
];

let removed = 0;
for (const relativePath of generatedPaths) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  fs.rmSync(absolutePath, { recursive: true, force: true });
  removed += 1;
  console.log(`[clean:generated] Removed ${relativePath}`);
}

if (removed === 0) {
  console.log('[clean:generated] Nothing to clean');
}
