#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { rmSync, existsSync } = require('node:fs');
const path = require('node:path');

const [, , command, ...args] = process.argv;

if (!command) {
  console.error('[run-and-clean] Usage: node scripts/run-and-clean.cjs <command> [...args]');
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const tmpDirs = ['.tmp-tests', '.tmp-appdata'];

function cleanTmp() {
  let cleaned = 0;

  for (const dirName of tmpDirs) {
    const dirPath = path.join(rootDir, dirName);
    if (!existsSync(dirPath)) {
      continue;
    }

    rmSync(dirPath, { recursive: true, force: true });
    cleaned += 1;
    console.log(`[clean:tmp] Removed ${dirName}`);
  }

  if (cleaned === 0) {
    console.log('[clean:tmp] Nothing to clean');
  }
}

const result = spawnSync(command, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

cleanTmp();

if (result.error) {
  console.error(`[run-and-clean] ${result.error.message}`);
  process.exit(1);
}

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
