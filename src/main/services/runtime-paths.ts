import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export function resolveRuntimePath(...segments: string[]): string {
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(join(process.resourcesPath, ...segments));
  }

  candidates.push(
    join(app.getAppPath(), ...segments),
    join(process.cwd(), ...segments),
    join(__dirname, '..', '..', ...segments)
  );

  return candidates.find((candidate) => existsSync(candidate)) ?? join(app.getAppPath(), ...segments);
}
