#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'src/data/guide.json',
  'src/data/campaign-bonuses.json',
  'src/data/league-mechanic-rewards.json',
  'src/i18n/clean-data-translations.en.json',
  'src/i18n/data.ts',
  'src/i18n/translations.ts',
];

const forbidden = [
  {
    pattern: /Акулью\s+яму\s+можно\s+скипнуть|Акулью\s+яму\s+скипнуть|skip\s+the\s+Shark\s+Pit:\s+the\s+reward\s+is\s+usually\s+not\s+worth/i,
    reason: 'Shark Pit / Great White One is no longer a skip note in the 0.5 guide; it grants Shark Fin and a permanent choice reward.',
  },
  {
    pattern: /Мыс\s+грабителя\s+можно\s+пропустить\s+в\s+быстром\s+прохождении|side\s+Expedition\s+reward,\s+not\s+required\s+campaign\s+progress/i,
    reason: 'Plunder\'s Point is not a plain skip note in the 0.5 guide; it closes Farrow / Ancient Runes after the 4 map pieces.',
  },
];

const offenders = [];
for (const relativePath of files) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) continue;
  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of forbidden) {
      if (rule.pattern.test(line)) {
        offenders.push({ file: relativePath, line: index + 1, text: line.trim(), reason: rule.reason });
      }
    }
  });
}

if (offenders.length > 0) {
  console.error('[check:guide-consistency] Contradictory guide text found:');
  for (const offender of offenders) {
    console.error(`  - ${offender.file}:${offender.line} ${offender.text}`);
    console.error(`    ${offender.reason}`);
  }
  process.exit(1);
}

console.log('[check:guide-consistency] No known 0.5 guide contradictions found.');
