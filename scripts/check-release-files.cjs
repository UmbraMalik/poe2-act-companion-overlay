const fs = require('node:fs');
const path = require('node:path');

const releaseDir = path.join(__dirname, '..', 'release');
const latestPath = path.join(releaseDir, 'latest.yml');

if (!fs.existsSync(latestPath)) {
  throw new Error('release/latest.yml not found');
}

const latest = fs.readFileSync(latestPath, 'utf8');
const match = latest.match(/^path:\s*(.+)$/m);

if (!match) {
  throw new Error('Cannot find path in latest.yml');
}

const exeName = match[1].trim();
const exePath = path.join(releaseDir, exeName);
const blockmapPath = path.join(releaseDir, `${exeName}.blockmap`);

if (!fs.existsSync(exePath)) {
  throw new Error(`Missing installer from latest.yml: ${exeName}`);
}

if (!fs.existsSync(blockmapPath)) {
  throw new Error(`Missing blockmap: ${exeName}.blockmap`);
}

console.log('Release files OK:');
console.log(`- ${exeName}`);
console.log(`- ${exeName}.blockmap`);
console.log('- latest.yml');
