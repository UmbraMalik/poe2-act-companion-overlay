#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const assetsDir = path.join(root, 'dist', 'assets');
const maxJsChunkBytes = 500 * 1024;
const maxMainChunkBytes = 300 * 1024;
const requiredPageChunkPrefixes = ['OverlayPage-', 'SettingsPage-', 'CompanionPage-', 'UpdatePage-', 'SupportPage-'];

function fail(message) {
  console.error(`[check:bundle] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(assetsDir)) {
  fail('Missing dist/assets. Run npm run build before check:bundle.');
  process.exit();
}

const jsFiles = fs
  .readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({
    file,
    size: fs.statSync(path.join(assetsDir, file)).size
  }))
  .sort((left, right) => right.size - left.size);

for (const chunk of jsFiles) {
  if (chunk.size > maxJsChunkBytes) {
    fail(`${chunk.file} is ${(chunk.size / 1024).toFixed(1)} KiB, expected <= ${(maxJsChunkBytes / 1024).toFixed(0)} KiB.`);
  }
}

const mainChunk = jsFiles.find((chunk) => /^main-[\w-]+\.js$/.test(chunk.file));
if (!mainChunk) {
  fail('Missing hashed main renderer chunk.');
} else if (mainChunk.size > maxMainChunkBytes) {
  fail(`${mainChunk.file} is ${(mainChunk.size / 1024).toFixed(1)} KiB, expected <= ${(maxMainChunkBytes / 1024).toFixed(0)} KiB after page code-splitting.`);
}

for (const prefix of requiredPageChunkPrefixes) {
  if (!jsFiles.some((chunk) => chunk.file.startsWith(prefix))) {
    fail(`Missing lazy page chunk with prefix ${prefix}`);
  }
}

if (process.exitCode) {
  process.exit();
}

console.log('[check:bundle] Renderer chunks are split and below size budget.');
for (const chunk of jsFiles.slice(0, 8)) {
  console.log(`  - ${chunk.file}: ${(chunk.size / 1024).toFixed(1)} KiB`);
}
