const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const mainDir = path.join(root, 'src', 'main');
const sourceExtensions = ['.ts'];
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
const allowedUnreachableSources = new Set([]);
const forbiddenLeftoverPatterns = [
  /(?:^|[/\\])page-models?(?:[/\\]|\.tsx?$)/i,
  /(?:^|[/\\]).*page-model.*\.tsx?$/i,
  /(?:^|[/\\]).*PageModel.*\.tsx?$/
];

function countLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
}

function toRelativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function walkSourceFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkSourceFiles(fullPath);
    }

    return sourceExtensions.includes(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')
      ? [fullPath]
      : [];
  });
}

function getLocalImportSpecifiers(source) {
  const specifiers = [];
  const importPattern =
    /\bimport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|\bexport\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier?.startsWith('.')) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveLocalSource(fromFile, specifier, sourceFiles) {
  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = path.extname(basePath)
    ? [basePath]
    : sourceExtensions.map((extension) => `${basePath}${extension}`);

  return candidates.find((candidate) => sourceFiles.has(candidate)) ?? null;
}

function collectReachableSources(entryRelativePaths, sourceFiles) {
  const reachable = new Set();
  const stack = entryRelativePaths
    .map((relativePath) => path.join(root, relativePath))
    .filter((entryPath) => sourceFiles.has(entryPath));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    const source = fs.readFileSync(current, 'utf8');
    for (const specifier of getLocalImportSpecifiers(source)) {
      const resolved = resolveLocalSource(current, specifier, sourceFiles);
      if (resolved && !reachable.has(resolved)) {
        stack.push(resolved);
      }
    }
  }

  return reachable;
}

function assertNoUnreachableSources() {
  const sourceFiles = new Set(walkSourceFiles(mainDir));
  const reachable = collectReachableSources([
    'src/main/main.ts',
    'src/main/preload.ts'
  ], sourceFiles);
  const unreachable = [...sourceFiles]
    .map(toRelativePath)
    .filter((relativePath) => !reachable.has(path.join(root, relativePath)) && !allowedUnreachableSources.has(relativePath))
    .sort();

  if (unreachable.length > 0) {
    console.error('[check:main-modules] Unreachable main-process source files:');
    for (const relativePath of unreachable) {
      console.error(`  - ${relativePath}`);
    }
    process.exit(1);
  }

  const leftoverFiles = [...sourceFiles]
    .map(toRelativePath)
    .filter((relativePath) => forbiddenLeftoverPatterns.some((pattern) => pattern.test(relativePath)));

  if (leftoverFiles.length > 0) {
    console.error('[check:main-modules] Stale page-model leftovers are not allowed:');
    for (const relativePath of leftoverFiles) {
      console.error(`  - ${relativePath}`);
    }
    process.exit(1);
  }
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

assertNoUnreachableSources();

console.log('[check:main-modules] Main-process module structure is clean.');
