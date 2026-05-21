import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function resolveWorkspacePath(relativePath: string): string {
  return join(process.cwd(), relativePath);
}

export function readText(relativePath: string): string {
  return readFileSync(resolveWorkspacePath(relativePath), 'utf8');
}

export function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

export function readMainProcessSource(): string {
  const mainDir = resolveWorkspacePath('src/main');
  const appModules = readdirSync(mainDir)
    .filter((fileName) => /^app-.*\.ts$/.test(fileName))
    .sort()
    .map((fileName) => `src/main/${fileName}`);

  return ['src/main/main.ts', ...appModules].map(readText).join('\n');
}
