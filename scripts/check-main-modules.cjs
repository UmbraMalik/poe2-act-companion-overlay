const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainDir = path.join(root, 'src', 'main');
const requiredModules = [
  'app-campaign-bonus-controller.ts',
  'app-close-confirmation.ts',
  'app-environment.ts',
  'app-guide-log-controller.ts',
  'app-ipc-handlers.ts',
  'app-overlay-bounds-controller.ts',
  'app-state-controller.ts',
  'app-timer-controller.ts',
  'app-update-controller.ts',
  'app-window-controller.ts'
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

const missing = requiredModules.filter((fileName) => !fs.existsSync(path.join(mainDir, fileName)));
if (missing.length > 0) {
  console.error('[check:main-modules] Missing main-process modules:');
  for (const fileName of missing) {
    console.error(`  - src/main/${fileName}`);
  }
  process.exit(1);
}

const limits = [
  ['main.ts', 1300],
  ...requiredModules.map((fileName) => [fileName, 1000])
];

const oversized = limits
  .map(([fileName, maxLines]) => {
    const lines = countLines(path.join(mainDir, fileName));
    return { fileName, maxLines, lines };
  })
  .filter(({ lines, maxLines }) => lines > maxLines);

if (oversized.length > 0) {
  console.error('[check:main-modules] Main-process files grew past their guard rails:');
  for (const item of oversized) {
    console.error(`  - src/main/${item.fileName}: ${item.lines}/${item.maxLines} lines`);
  }
  process.exit(1);
}

console.log('[check:main-modules] Main-process module structure is clean.');
