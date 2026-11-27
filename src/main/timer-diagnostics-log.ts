import { appendFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { app } from 'electron';
import type { TimerDiagnosticsPayload } from '../shared/types';

export const TIMER_DIAGNOSTICS_ENV_FLAG = 'POE2_TIMER_DIAGNOSTICS';
export const TIMER_DIAGNOSTICS_DIRECTORY_NAME = 'logs';
export const TIMER_DIAGNOSTICS_FILE_NAME = 'timer-diagnostics.log';
export const TIMER_DIAGNOSTICS_MAX_BYTES = 4 * 1024 * 1024;

export interface TimerDiagnosticsRecord extends TimerDiagnosticsPayload {
  timestamp: string;
}

export function isTimerDiagnosticsEnabled(): boolean {
  return process.env[TIMER_DIAGNOSTICS_ENV_FLAG] === '1';
}

export class TimerDiagnosticsLog {
  private writeChain: Promise<void> = Promise.resolve();

  isEnabled(): boolean {
    return isTimerDiagnosticsEnabled();
  }

  getLogDirectoryPath(): string {
    return join(app.getPath('userData'), TIMER_DIAGNOSTICS_DIRECTORY_NAME);
  }

  getLogFilePath(): string {
    return join(this.getLogDirectoryPath(), TIMER_DIAGNOSTICS_FILE_NAME);
  }

  async write(record: TimerDiagnosticsRecord): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    let didWrite = false;
    const logDirectoryPath = this.getLogDirectoryPath();
    const logFilePath = this.getLogFilePath();
    const serialized = `${JSON.stringify(record)}\n`;
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (bytes > TIMER_DIAGNOSTICS_MAX_BYTES) return false;

    this.writeChain = this.writeChain.then(async () => {
      try {
        await mkdir(logDirectoryPath, { recursive: true });
        let size = 0;
        try { size = (await stat(logFilePath)).size; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (size + bytes > TIMER_DIAGNOSTICS_MAX_BYTES) {
          const backup = `${logFilePath}.1`;
          await rm(backup, { force: true });
          await rename(logFilePath, backup);
        }
        await appendFile(logFilePath, serialized, 'utf8');
        didWrite = true;
      } catch {
        didWrite = false;
      }
    });

    await this.writeChain.catch(() => undefined);
    return didWrite;
  }

  async whenIdle(): Promise<void> {
    await this.writeChain.catch(() => undefined);
  }
}
