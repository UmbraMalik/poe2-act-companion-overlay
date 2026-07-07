const { existsSync, readFileSync } = require('node:fs');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const rendererDir = path.join(root, 'src', 'renderer');
const sourceExtensions = ['.ts', '.tsx'];
const allowedUnreachableSources = new Set([
  'src/renderer/vite-env.d.ts'
]);
const forbiddenLeftoverPatterns = [
  /(?:^|[/\\])page-models?(?:[/\\]|\.tsx?$)/i,
  /(?:^|[/\\]).*page-model.*\.tsx?$/i,
  /(?:^|[/\\]).*PageModel.*\.tsx?$/
];

const lineBudgets = new Map([
  ['src/renderer/hooks.ts', 1700],
  ['src/renderer/pages/OverlayPage.tsx', 2150],
  ['src/renderer/pages/CompanionPage.tsx', 2450],
  ['src/renderer/pages/SettingsPage.tsx', 1600]
]);

const problems = [];

function toRelativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function walkSourceFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkSourceFiles(fullPath);
    }

    return sourceExtensions.includes(path.extname(entry.name))
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
    const source = readFileSync(current, 'utf8');
    for (const specifier of getLocalImportSpecifiers(source)) {
      const resolved = resolveLocalSource(current, specifier, sourceFiles);
      if (resolved && !reachable.has(resolved)) {
        stack.push(resolved);
      }
    }
  }

  return reachable;
}

function checkReachability() {
  const sourceFiles = new Set(walkSourceFiles(rendererDir));
  const reachable = collectReachableSources(['src/renderer/main.tsx'], sourceFiles);
  const unreachable = [...sourceFiles]
    .map(toRelativePath)
    .filter((relativePath) => !reachable.has(path.join(root, relativePath)) && !allowedUnreachableSources.has(relativePath))
    .sort();

  for (const relativePath of unreachable) {
    problems.push(`${relativePath} is not reachable from src/renderer/main.tsx`);
  }

  const leftoverFiles = [...sourceFiles]
    .map(toRelativePath)
    .filter((relativePath) => forbiddenLeftoverPatterns.some((pattern) => pattern.test(relativePath)));

  for (const relativePath of leftoverFiles) {
    problems.push(`${relativePath} looks like a stale page-model leftover`);
  }
}

for (const [relativePath, maxLines] of lineBudgets) {
  const absolutePath = path.join(root, relativePath);
  if (!existsSync(absolutePath)) {
    continue;
  }

  const lineCount = readFileSync(absolutePath, 'utf8').split(/\r?\n/).length;
  if (lineCount > maxLines) {
    problems.push(`${relativePath} is ${lineCount} lines, expected <= ${maxLines}`);
  }
}

checkReachability();

if (problems.length > 0) {
  console.error('[check:renderer-modules] Renderer source module check failed:');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('[check:renderer-modules] Renderer source module structure is clean.');
