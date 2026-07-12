#!/usr/bin/env node
const { copyFileSync, existsSync, mkdirSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = join(process.cwd(), '.tmp-tests');
const sourceDataDir = join(process.cwd(), 'src', 'data');
const compiledDataDir = join(root, 'src', 'data');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function copyJsonTree(fromDir, toDir) {
  if (!existsSync(fromDir)) {
    return;
  }

  mkdirSync(toDir, { recursive: true });
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const sourcePath = join(fromDir, entry.name);
    const targetPath = join(toDir, entry.name);

    if (entry.isDirectory()) {
      copyJsonTree(sourcePath, targetPath);
      continue;
    }

    if (/\.json$/i.test(entry.name)) {
      copyFileSync(sourcePath, targetPath);
    }
  }
}

copyJsonTree(sourceDataDir, compiledDataDir);

const testFiles = walk(root)
  .filter((file) => /\.test\.js$/i.test(file))
  .sort();

if (testFiles.length === 0) {
  console.error(`[regression] No compiled test files found under ${root}`);
  console.error('[regression] Expected files like .tmp-tests/tests/*.test.js after tsc -p tsconfig.test.json');
  process.exit(1);
}

console.log(`[regression] Running ${testFiles.length} test file(s)`);
const nodeHelp = spawnSync(process.execPath, ['--help'], {
  encoding: 'utf8',
  shell: false
});
const helpText = `${nodeHelp.stdout ?? ''}\n${nodeHelp.stderr ?? ''}`;
const nodeMajorVersion = Number(process.versions.node.split('.')[0]);
const testIsolationFlag = helpText.includes('--test-isolation') || nodeMajorVersion >= 22
  ? '--test-isolation=none'
  : helpText.includes('--experimental-test-isolation') || nodeMajorVersion >= 20
    ? '--experimental-test-isolation=none'
    : null;

const result = spawnSync(process.execPath, ['--test', ...(testIsolationFlag ? [testIsolationFlag] : []), ...testFiles], {
  stdio: 'inherit',
  shell: false
});

process.exit(result.status ?? 1);
