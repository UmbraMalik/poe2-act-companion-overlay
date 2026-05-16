const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const packageJson = require(path.join(rootDir, 'package.json'));
const version = packageJson.version;

if (!fs.existsSync(releaseDir)) {
  console.error('release directory not found');
  process.exit(1);
}

const files = fs.readdirSync(releaseDir);
const setupName = `PoE2-Campaign-Codex-Overlay-Setup-${version}.exe`;
const blockmapName = `${setupName}.blockmap`;
const required = [setupName, blockmapName, 'latest.yml'];
const missing = required.filter((file) => !files.includes(file));

if (missing.length > 0) {
  console.error('Missing release files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Release files OK:');
for (const file of required) console.log(`- ${file}`);
