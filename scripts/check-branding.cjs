const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const banned = [
  'POE2 Campaign Codex Overlay',
  'PoE2 Campaign Codex Overlay',
  'POE2 Campaign Codex',
  'PoE2 Campaign Codex',
  'Campaign Codex Overlay',
  'Campaign Codex',
  'poe2-campaign-codex-overlay',
  'poe2-campaign-codex-releases',
  'poe2-act-companion-overlay-releases',
  'poe2-campaign-codex',
  'POE2CampaignCodex',
  'com.codex.poe2-campaign-overlay',
  'PoE2-Campaign-Codex-Overlay'
];

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'release',
  'out',
  '.tmp-tests',
  '.tmp-appdata'
]);
const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.cjs', '.json', '.md', '.html', '.css', '.txt', '.yml', '.yaml'
]);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.name === 'check-branding.cjs') {
      continue;
    } else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

const matches = [];
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of banned) {
    if (text.includes(needle)) {
      matches.push(`${path.relative(root, file)} contains ${JSON.stringify(needle)}`);
    }
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (packageJson.name !== 'poe2-act-companion-overlay') {
  matches.push(`package.json name must be poe2-act-companion-overlay, got ${packageJson.name}`);
}
if (packageJson.build?.productName !== 'POE2 Act Companion Overlay') {
  matches.push(`build.productName must be POE2 Act Companion Overlay, got ${packageJson.build?.productName}`);
}
if (packageJson.build?.artifactName !== 'POE2-Act-Companion-Overlay-Setup-${version}.${ext}') {
  matches.push(`build.artifactName must be POE2-Act-Companion-Overlay-Setup-\${version}.\${ext}, got ${packageJson.build?.artifactName}`);
}

if (matches.length > 0) {
  console.error('[check:branding] Old branding is still present:');
  for (const match of matches) console.error(`- ${match}`);
  process.exit(1);
}

console.log('[check:branding] Branding is clean.');
