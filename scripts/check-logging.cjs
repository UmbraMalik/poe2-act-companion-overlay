const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

const root = join(__dirname, '..');
const sourceRoots = [join(root, 'src', 'main')];
const ignoredFiles = new Set([
  'src/main/diagnostic-logger.ts'
]);

const disallowedPatterns = [
  /console\.debug\s*\(/,
  /console\.info\s*\(/,
  /console\.log\s*\(/
];

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      entries.push(...walk(fullPath));
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      entries.push(fullPath);
    }
  }
  return entries;
}

const offenders = [];
for (const sourceRoot of sourceRoots) {
  for (const filePath of walk(sourceRoot)) {
    const relativePath = relative(root, filePath).replace(/\\/g, '/');
    if (ignoredFiles.has(relativePath)) {
      continue;
    }

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (disallowedPatterns.some((pattern) => pattern.test(line))) {
        offenders.push(`${relativePath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

if (offenders.length > 0) {
  console.error('[check:logging] Use diagnostic-logger for debug/info/log output in src/main:');
  for (const offender of offenders) {
    console.error(`  - ${offender}`);
  }
  process.exit(1);
}

console.log('[check:logging] Main-process debug/info logging is gated.');
