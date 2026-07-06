#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const stylesDir = path.join(root, 'src', 'renderer', 'styles');
const indexFile = path.join(root, 'src', 'renderer', 'styles.css');

function fail(message) {
  console.error(`[check:styles] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(stylesDir)) {
  fail(`Missing styles directory: ${path.relative(root, stylesDir)}`);
  process.exit();
}

if (!fs.existsSync(indexFile)) {
  fail(`Missing stylesheet index: ${path.relative(root, indexFile)}`);
  process.exit();
}

const rootEntries = fs.readdirSync(stylesDir, { withFileTypes: true });
const nestedCssFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.css') && path.dirname(fullPath) !== stylesDir) {
      nestedCssFiles.push(path.relative(root, fullPath).replace(/\\/g, '/'));
    }
  }
}

walk(stylesDir);

if (nestedCssFiles.length > 0) {
  fail(`Nested CSS duplicates are not allowed:\n${nestedCssFiles.map((file) => `  - ${file}`).join('\n')}`);
}

const partials = rootEntries
  .filter((entry) => entry.isFile() && /^\d{2}-.+\.css$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const trackedNonNumberedPartials = ['route-visual-pass.css'];
const cssFiles = rootEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
  .map((entry) => entry.name)
  .sort();

const expected = [
  '01-overlay-core.css',
  '02-settings-shell.css',
  '03-route-reminders-bonuses.css',
  '04-overlay-data-timer-base.css',
  '05-overlay-layout-modes.css',
  '06-report-community-support.css',
  '07-ui-polish-settings-support.css',
  '08-route-polish-final.css',
  '09-overlay-chrome-controls.css',
  '10-typography-refresh.css',
  '11-overlay-header-actions.css',
  '12-localization-toggle.css',
  '13-guide-update-highlights.css',
  '14-visual-hierarchy-polish.css',
  '15-typography-density-polish.css',
  '16-route-states.css',
  '17-overlay-chrome-pass.css',
  '18-overlay-control-intents.css',
  '19-overlay-control-unified-hover.css',
  '20-reminders-timeline.css',
  '21-reminders-layout-polish.css',
  '22-reminders-final-alignment.css',
  '23-results-recap.css',
  '24-companion-panel-ux.css',
  '25-motion-polish.css',
  '26-atmospheric-fx.css',
  '27-ambient-animated-fx.css',
  '28-fx-controls-debug.css',
  '29-guidance-state-polish.css',
  '30-feedback-polish.css',
  '31-overlay-control-state-polish.css',
  '32-overlay-mode-transitions.css',
  '33-click-feedback.css',
  '34-event-feedback-polish.css',
  '35-dark-fantasy-theme.css',
];
const expectedCssFiles = [...expected, ...trackedNonNumberedPartials].sort();
const expectedImports = [
  ...expected.slice(0, 24),
  'route-visual-pass.css',
  ...expected.slice(24)
];

if (cssFiles.join('\n') !== expectedCssFiles.join('\n')) {
  fail(`Unexpected root CSS files.\nExpected:\n${expectedCssFiles.map((file) => `  - ${file}`).join('\n')}\nActual:\n${cssFiles.map((file) => `  - ${file}`).join('\n')}`);
}

if (partials.join('\n') !== expected.join('\n')) {
  fail(`Unexpected numbered CSS partials.\nExpected:\n${expected.map((file) => `  - ${file}`).join('\n')}\nActual:\n${partials.map((file) => `  - ${file}`).join('\n')}`);
}

const indexText = fs.readFileSync(indexFile, 'utf8');
const importMatches = [...indexText.matchAll(/@import\s+['"]\.\/styles\/(.+?\.css)['"]/g)].map((match) => match[1]);

if (importMatches.join('\n') !== expectedImports.join('\n')) {
  fail(`styles.css must import tracked partials in canonical order.\nExpected:\n${expectedImports.map((file) => `  - ${file}`).join('\n')}\nActual:\n${importMatches.map((file) => `  - ${file}`).join('\n')}`);
}

if (process.exitCode) {
  process.exit();
}

console.log('[check:styles] CSS partial structure is clean.');
