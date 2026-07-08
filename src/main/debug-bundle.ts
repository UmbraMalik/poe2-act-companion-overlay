import { open } from 'node:fs/promises';
import {
  DEBUG_BUNDLE_LOG_LINE_LIMIT,
  sanitizeDebugLogLines
} from '../shared/debug-bundle';

export const DEBUG_LOG_TAIL_READ_BYTES = 128 * 1024;

export async function readRedactedDebugLogTail(
  filePath: unknown,
  maxLines = DEBUG_BUNDLE_LOG_LINE_LIMIT
): Promise<string[]> {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return [];
  }

  let handle: Awaited<ReturnType<typeof open>> | null = null;

  try {
    handle = await open(filePath, 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size <= 0) {
      return [];
    }

    const readSize = Math.min(stat.size, DEBUG_LOG_TAIL_READ_BYTES);
    const buffer = Buffer.alloc(readSize);
    await handle.read(buffer, 0, readSize, stat.size - readSize);

    return sanitizeDebugLogLines(
      buffer.toString('utf8').split(/\r?\n/).filter((line) => line.length > 0),
      maxLines
    );
  } catch {
    return [];
  } finally {
    await handle?.close().catch(() => undefined);
  }
}
