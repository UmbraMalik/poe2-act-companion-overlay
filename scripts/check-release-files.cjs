const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const releaseDir = path.join(root, 'release');
const latestPath = path.join(releaseDir, 'latest.yml');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packageVersion = packageJson.version;
const artifactNameTemplate = packageJson.build?.artifactName;
const expectedExeName = String(artifactNameTemplate ?? '')
  .replace('${version}', packageVersion)
  .replace('${ext}', 'exe');

function unquoteYamlScalar(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
}

if (!fs.existsSync(latestPath)) {
  throw new Error('release/latest.yml not found');
}

const latest = fs.readFileSync(latestPath, 'utf8');
const versionMatch = latest.match(/^version:\s*(.+)$/m);
const pathMatch = latest.match(/^path:\s*(.+)$/m);
const topLevelSha512Match = latest.match(/^sha512:\s*(.+)$/m);
const latestFileEntries = [...latest.matchAll(/^\s*-\s+url:\s*(.+)\r?\n\s+sha512:\s*(.+)\r?\n\s+size:\s*(\d+)$/gm)].map((match) => ({
  url: unquoteYamlScalar(match[1]),
  sha512: unquoteYamlScalar(match[2]),
  size: Number(match[3])
}));

if (!versionMatch) {
  throw new Error('Cannot find version in latest.yml');
}

if (!pathMatch) {
  throw new Error('Cannot find path in latest.yml');
}

if (!topLevelSha512Match) {
  throw new Error('Cannot find top-level sha512 in latest.yml');
}

if (latestFileEntries.length === 0) {
  throw new Error('Cannot find installer file entries in latest.yml');
}

const latestVersion = unquoteYamlScalar(versionMatch[1]);
if (latestVersion !== packageVersion) {
  throw new Error(`latest.yml version ${latestVersion} does not match package.json version ${packageVersion}`);
}

if (!expectedExeName || expectedExeName.includes('${')) {
  throw new Error('package.json build.artifactName must include ${version} and ${ext}');
}

const exeName = unquoteYamlScalar(pathMatch[1]);
if (exeName !== expectedExeName) {
  throw new Error(`latest.yml path ${exeName} does not match expected artifact ${expectedExeName}`);
}

const matchingFileEntries = latestFileEntries.filter((entry) => entry.url === exeName);
if (matchingFileEntries.length === 0) {
  throw new Error(`latest.yml files list does not include installer ${exeName}`);
}
if (matchingFileEntries.length > 1) {
  throw new Error(`latest.yml files list contains duplicate installer entries for ${exeName}`);
}
const latestFileEntry = matchingFileEntries[0];

const exePath = path.join(releaseDir, exeName);
const blockmapPath = path.join(releaseDir, `${exeName}.blockmap`);

if (!fs.existsSync(exePath)) {
  throw new Error(`Missing installer from latest.yml: ${exeName}`);
}

if (!fs.existsSync(blockmapPath)) {
  throw new Error(`Missing blockmap: ${exeName}.blockmap`);
}

const exeStat = fs.statSync(exePath);
const blockmapStat = fs.statSync(blockmapPath);
if (exeStat.size <= 0) {
  throw new Error(`Installer is empty: ${exeName}`);
}

if (blockmapStat.size <= 0) {
  throw new Error(`Blockmap is empty: ${exeName}.blockmap`);
}

if (!Number.isFinite(latestFileEntry.size) || latestFileEntry.size !== exeStat.size) {
  throw new Error(`latest.yml installer size ${latestFileEntry.size} does not match actual size ${exeStat.size}`);
}

const latestSha512 = unquoteYamlScalar(topLevelSha512Match[1]);
if (latestFileEntry.sha512 !== latestSha512) {
  throw new Error(`latest.yml file entry sha512 does not match top-level sha512 for ${exeName}`);
}

const actualSha512 = crypto
  .createHash('sha512')
  .update(fs.readFileSync(exePath))
  .digest('base64');
if (latestSha512 !== actualSha512) {
  throw new Error(`latest.yml sha512 does not match ${exeName}`);
}

console.log('Release files OK:');
console.log(`- ${exeName}`);
console.log(`- ${exeName}.blockmap`);
console.log('- latest.yml');
