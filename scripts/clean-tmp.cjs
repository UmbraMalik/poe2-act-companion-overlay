#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const tmpDirs = ['.tmp-tests', '.tmp-appdata'];

let cleaned = 0;
for (const dirName of tmpDirs) {
  const dirPath = path.join(rootDir, dirName);
  if (!fs.existsSync(dirPath)) {
    continue;
  }

  fs.rmSync(dirPath, { recursive: true, force: true });
  cleaned += 1;
  console.log(`[clean:tmp] Removed ${dirName}`);
}

if (cleaned === 0) {
  console.log('[clean:tmp] Nothing to clean');
}
