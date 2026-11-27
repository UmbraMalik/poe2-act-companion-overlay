import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverGameLog, findNewestReadableLog, parseSteamLibraryPaths } from '../src/main/services/log-discovery';

test('Steam library paths decode Windows VDF escapes', () => {
  assert.deepEqual(parseSteamLibraryPaths(String.raw`"libraryfolders" { "0" { "path" "C:\\Program Files (x86)\\Steam" } "1" { "path" "D:\\My Steam Library" } }`), [
    String.raw`C:\Program Files (x86)\Steam`, String.raw`D:\My Steam Library`
  ]);
});

test('Production sibling wins over old configured log; directories and missing files are ignored', async () => {
  const root = await mkdtemp(join(tmpdir(), 'poe2-log-discovery-'));
  try {
    const oldDir = join(root, 'My Games', 'Path of Exile 2', 'logs');
    const productionDir = join(root, 'My Games', 'Path of Exile 2 Production', 'logs');
    await mkdir(oldDir, { recursive: true });
    await mkdir(productionDir, { recursive: true });
    const oldLog = join(oldDir, 'LatestClient.txt');
    const liveLog = join(productionDir, 'Client.txt');
    await writeFile(oldLog, 'old');
    await writeFile(liveLog, 'new');
    await utimes(oldLog, new Date(1000), new Date(1000));
    await utimes(liveLog, new Date(2000), new Date(2000));
    assert.equal(await findNewestReadableLog([oldDir, oldLog, liveLog, join(root, 'missing')]), liveLog);
    // Isolated candidate ranking is deterministic even on a machine with POE installed.
    if (process.platform !== 'win32') assert.equal(await discoverGameLog(root, oldLog), liveLog);
    assert.equal(await findNewestReadableLog([oldDir, join(root, 'missing')]), null);
    const latest = join(productionDir, 'LatestClient.txt');
    await writeFile(latest, 'new');
    await utimes(latest, new Date(2000), new Date(2000));
    assert.equal(await findNewestReadableLog([liveLog, latest]), latest);
  } finally { await rm(root, { recursive: true, force: true }); }
});
