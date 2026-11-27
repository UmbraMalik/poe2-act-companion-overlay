import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { constants } from 'node:fs';
import { access, open, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

const GAME_FOLDERS = ['Path of Exile 2', 'Path of Exile 2 Production'];
const LOG_NAMES = ['LatestClient.txt', 'Client.txt'];
const execFileAsync = promisify(execFile);

async function registeredSteamRoot(): Promise<string | null> {
  if (process.platform !== 'win32') return null;
  try {
    const { stdout } = await execFileAsync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      windowsHide: true, timeout: 2000
    });
    return stdout.match(/^\s*SteamPath\s+REG_SZ\s+(.+)$/im)?.[1].trim() || null;
  } catch { return null; }
}

// Steam's current libraryfolders.vdf stores each library root in a "path" entry.
export function parseSteamLibraryPaths(text: string): string[] {
  return [...text.matchAll(/"path"\s*"((?:\\.|[^"\\])*)"/gi)]
    .map((match) => match[1].replace(/\\\\/g, '\\'))
    .filter(Boolean);
}

export async function findNewestReadableLog(candidates: string[]): Promise<string | null> {
  const unique = [...new Set(candidates)];
  const results = await Promise.all(unique.map(async (path) => {
    try {
      const info = await stat(path);
      if (!info.isFile()) return null;
      await access(path, constants.R_OK);
      let recognizable = false;
      if (info.size > 0) {
        const handle = await open(path, 'r');
        try {
          const buffer = Buffer.alloc(Math.min(info.size, 32 * 1024));
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, info.size - buffer.length);
          recognizable = /\[SCENE\]\s+Set Source|\[INFO Client(?: \d+)?\]|You have entered|Вы вошли в область/i.test(buffer.subarray(0, bytesRead).toString('utf8'));
        } finally { await handle.close(); }
      }
      return { path, mtime: Math.min(info.mtimeMs, Date.now()), size: info.size, recognizable };
    } catch {
      return null;
    }
  }));
  return results.filter((entry) => entry !== null).sort((a, b) =>
    Number(b.size > 0) - Number(a.size > 0) ||
    Number(b.recognizable) - Number(a.recognizable) ||
    b.mtime - a.mtime ||
    LOG_NAMES.indexOf(basename(a.path)) - LOG_NAMES.indexOf(basename(b.path))
  )[0]?.path ?? null;
}

export async function discoverGameLog(documents: string, previousPath: string | null): Promise<string | null> {
  const env = process.env;
  const programRoots = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter((p): p is string => Boolean(p));
  // Probe fixed locations only; never recursively scan disks.
  const driveRoots = process.platform === 'win32'
    ? await Promise.all('CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async (letter) => {
        const root = `${letter}:\\`;
        try { return (await stat(root)).isDirectory() ? root : null; } catch { return null; }
      })).then((roots) => roots.filter((root): root is string => root !== null))
    : [];
  const steamRoot = await registeredSteamRoot();
  const steamRoots = new Set([
    ...(steamRoot ? [steamRoot] : []),
    ...programRoots.map((root) => join(root, 'Steam')),
    ...driveRoots.flatMap((root) => [join(root, 'Steam'), join(root, 'SteamLibrary'), join(root, 'Games', 'Steam')])
  ]);
  const libraries = await Promise.all([...steamRoots].map(async (root) => {
    try {
      const vdf = join(root, 'steamapps', 'libraryfolders.vdf');
      if ((await stat(vdf)).size > 1024 * 1024) return [];
      return parseSteamLibraryPaths(await readFile(vdf, 'utf8'));
    } catch { return []; }
  }));
  for (const library of libraries.flat()) steamRoots.add(library);
  const installParents = [
    join(documents, 'My Games'),
    ...programRoots.flatMap((root) => [root, join(root, 'Grinding Gear Games')]),
    ...driveRoots.flatMap((root) => [root, join(root, 'Games'), join(root, 'Grinding Gear Games')]),
    ...[...steamRoots].map((root) => join(root, 'steamapps', 'common'))
  ];
  const directories = installParents.flatMap((parent) => GAME_FOLDERS.flatMap((folder) => {
    const game = join(parent, folder);
    return [join(game, 'logs'), game];
  }));
  if (previousPath) {
    const logDirectory = dirname(previousPath);
    const gameDirectory = basename(logDirectory).toLowerCase() === 'logs' ? dirname(logDirectory) : logDirectory;
    directories.push(logDirectory);
    for (const folder of GAME_FOLDERS) {
      const sibling = join(dirname(gameDirectory), folder);
      directories.push(join(sibling, 'logs'), sibling);
    }
  }
  return findNewestReadableLog([
    ...(previousPath ? [previousPath] : []),
    ...directories.flatMap((directory) => LOG_NAMES.map((name) => join(directory, name)))
  ]);
}
