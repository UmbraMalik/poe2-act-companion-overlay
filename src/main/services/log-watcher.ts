import { constants, watch, type FSWatcher } from 'node:fs';
import { access, open, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { GuideService, type ExtractedZoneMatch } from './guide-service';
import { extractGeneratedAreaId, extractNamedZoneFromLine } from './log-parser';
import { shouldKeepPendingZoneAreaId } from '../scene-classifier';
import type {
  LogWatcherRuntimeState,
  LogWatcherStatus
} from '../../shared/types';

interface LogWatcherCallbacks {
  onLine: (line: string, source: 'bootstrap' | 'append') => void;
  onAppendLine: (line: string) => void;
  onZoneDetected: (zoneMatch: ExtractedZoneMatch) => void;
  onStatusChange: (status: LogWatcherStatus, message: string) => void;
  onRuntimeStateChange: (
    state: LogWatcherRuntimeState & { fileExists: boolean }
  ) => void;
}

const TAIL_BYTES = 128 * 1024;
const POLL_INTERVAL_MS = 750;
function stripNulCharacters(input: string): string {
  return String(input ?? '').replace(/\u0000/g, '');
}

export class LogWatcher {
  private filePath: string | null = null;
  private watchedFileName: string | null = null;
  private fileWatcher: FSWatcher | null = null;
  private directoryWatcher: FSWatcher | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private scheduledRead: NodeJS.Timeout | null = null;
  private filePosition = 0;
  private remainder = '';
  private pendingAreaId: string | null = null;
  private decoder = new StringDecoder('utf8');
  private reading = false;
  private needsResync = false;
  private status: LogWatcherStatus = 'idle';
  private statusMessage = 'Ожидание лог-файла';
  private runtimeState: LogWatcherRuntimeState & { fileExists: boolean } = {
    watchedLogPath: null,
    currentOffset: 0,
    lastFileSize: null,
    lastAppendedLine: null,
    lastMatchedZone: null,
    lastUpdateTimestamp: null,
    lastReadAt: null,
    lastMatchedAt: null,
    lastMatcherReason: 'none',
    fileExists: false
  };

  constructor(
    private readonly guideService: GuideService,
    private readonly callbacks: LogWatcherCallbacks
  ) {}

  private resetTextState(): void {
    this.remainder = '';
    this.pendingAreaId = null;
    this.decoder = new StringDecoder('utf8');
  }

  private decodeBuffer(buffer: Buffer): string {
    return stripNulCharacters(this.decoder.write(buffer));
  }

  private decodeBootstrapBuffer(buffer: Buffer): string {
    return stripNulCharacters(buffer.toString('utf8'));
  }

  private shouldKeepPendingAreaId(zoneName: string | null | undefined): boolean {
    return shouldKeepPendingZoneAreaId(zoneName);
  }

  private extractZoneMatch(line: string): ExtractedZoneMatch | null {
    const trimmedLine = stripNulCharacters(String(line ?? '')).trim();
    if (!trimmedLine) {
      return null;
    }

    const extractedInternalAreaId = extractGeneratedAreaId(trimmedLine)?.trim() ?? null;
    if (extractedInternalAreaId) {
      this.pendingAreaId = extractedInternalAreaId;
    }

    const extractedZoneName = extractNamedZoneFromLine(trimmedLine)?.trim() ?? null;
    if (extractedZoneName) {
      const zoneMatch = this.guideService.resolveZoneMatch({
        rawLine: trimmedLine,
        extractedInternalAreaId: this.pendingAreaId,
        extractedZoneName
      });
      if (!this.shouldKeepPendingAreaId(extractedZoneName)) {
        this.pendingAreaId = null;
      }
      return zoneMatch;
    }

    return this.guideService.extractZoneMatchFromLine(trimmedLine);
  }

  async start(filePath: string, options?: { skipBootstrap?: boolean }): Promise<void> {
    this.stop();
    this.filePath = filePath;
    this.watchedFileName = basename(filePath).toLowerCase();
    this.filePosition = 0;
    this.resetTextState();
    this.needsResync = false;
    this.updateRuntimeState({
      watchedLogPath: filePath,
      currentOffset: 0,
      lastFileSize: null,
      lastAppendedLine: null,
      lastMatchedZone: null,
      lastReadAt: null,
      lastMatchedAt: null,
      lastMatcherReason: 'none',
      fileExists: false
    });

    this.bindDirectoryWatcher(filePath);
    await this.tryBindFileWatcher();
    this.startPolling();
    if (options?.skipBootstrap) {
      await this.seekToEnd();
    } else {
      await this.readNewContent({
        allowBootstrap: true
      });
    }
  }

  stop(): void {
    this.filePath = null;
    this.watchedFileName = null;
    this.filePosition = 0;
    this.resetTextState();
    this.needsResync = false;

    if (this.scheduledRead) {
      clearTimeout(this.scheduledRead);
      this.scheduledRead = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.fileWatcher?.close();
    this.fileWatcher = null;
    this.directoryWatcher?.close();
    this.directoryWatcher = null;

    this.updateRuntimeState({
      watchedLogPath: null,
      currentOffset: 0,
      lastFileSize: null,
      lastAppendedLine: null,
      lastMatchedZone: null,
      lastReadAt: null,
      lastMatchedAt: null,
      lastMatcherReason: 'none',
      fileExists: false
    });
    this.emitStatus('idle', 'Ожидание лог-файла');
  }

  async checkNow(): Promise<void> {
    await this.readNewContent();
  }

  async seekToEnd(): Promise<void> {
    if (!this.filePath) {
      return;
    }

    const readAt = new Date().toISOString();

    try {
      const fileStat = await stat(this.filePath);
      if (!fileStat.isFile()) {
        return;
      }

      this.filePosition = fileStat.size;
      this.resetTextState();
      this.needsResync = false;
      this.updateRuntimeState({
        fileExists: true,
        lastFileSize: fileStat.size,
        currentOffset: this.filePosition,
        lastReadAt: readAt,
        lastMatchedZone: null,
        lastMatchedAt: null,
        lastMatcherReason: 'none'
      });
      this.emitStatus('ready', 'Чтение лога активно');
    } catch {
      this.updateRuntimeState({
        fileExists: false,
        lastFileSize: null,
        currentOffset: this.filePosition,
        lastReadAt: readAt
      });
    }
  }

  private bindDirectoryWatcher(filePath: string): void {
    const watchedDirectory = dirname(filePath);

    try {
      this.directoryWatcher = watch(watchedDirectory, (eventType, fileName) => {
        const nextName = fileName?.toString().toLowerCase() ?? null;
        if (!nextName || nextName === this.watchedFileName) {
          if (eventType === 'rename') {
            this.needsResync = true;
          }
          this.queueRead(25);
        }
      });
    } catch {
      this.directoryWatcher = null;
    }
  }

  private async tryBindFileWatcher(): Promise<void> {
    if (!this.filePath || this.fileWatcher) {
      return;
    }

    try {
      await access(this.filePath, constants.R_OK);
      this.fileWatcher = watch(this.filePath, (eventType) => {
        if (eventType === 'rename') {
          this.needsResync = true;
          this.fileWatcher?.close();
          this.fileWatcher = null;
        }

        this.queueRead(25);
      });
    } catch {
      this.fileWatcher = null;
    }
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.queueRead();
    }, POLL_INTERVAL_MS);
  }

  private emitStatus(status: LogWatcherStatus, message: string): void {
    if (this.status === status && this.statusMessage === message) {
      return;
    }

    this.status = status;
    this.statusMessage = message;
    this.callbacks.onStatusChange(status, message);
  }

  private updateRuntimeState(
    patch: Partial<LogWatcherRuntimeState & { fileExists: boolean }>
  ): void {
    this.runtimeState = {
      ...this.runtimeState,
      ...patch,
      lastUpdateTimestamp:
        patch.lastUpdateTimestamp ?? new Date().toISOString()
    };
    this.callbacks.onRuntimeStateChange({ ...this.runtimeState });
  }

  private queueRead(delayMs = 125): void {
    if (this.scheduledRead) {
      clearTimeout(this.scheduledRead);
    }

    this.scheduledRead = setTimeout(() => {
      this.scheduledRead = null;
      void this.readNewContent();
    }, delayMs);
  }

  private shouldKeepPreviousMatchedZone(
    previousMatch: ExtractedZoneMatch | null,
    nextMatch: ExtractedZoneMatch
  ): boolean {
    void previousMatch;
    void nextMatch;
    return false;
  }

  private shouldPreserveRuntimeMatchedZone(
    nextMatch: ExtractedZoneMatch,
    hadMatchedGuideBeforeLine: boolean
  ): boolean {
    void nextMatch;
    void hadMatchedGuideBeforeLine;
    return false;
  }

  private async bootstrapFromTail(
    filePath: string,
    fileSize: number
  ): Promise<void> {
    const start = Math.max(0, fileSize - TAIL_BYTES);
    const handle = await open(filePath, 'r');

    try {
      const buffer = Buffer.alloc(fileSize - start);
      if (buffer.length === 0) {
        return;
      }

      await handle.read(buffer, 0, buffer.length, start);
      const content = this.decodeBootstrapBuffer(buffer);
      const lines = content.split(/\r?\n/).filter(Boolean);
      let lastZone: ExtractedZoneMatch | null = null;
      this.pendingAreaId = null;

      for (const line of lines) {
        this.callbacks.onLine(line, 'bootstrap');
        const zoneMatch = this.extractZoneMatch(line);
        if (zoneMatch && !this.shouldKeepPreviousMatchedZone(lastZone, zoneMatch)) {
          lastZone = zoneMatch;
        }
      }

      if (lastZone) {
        this.updateRuntimeState({
          lastMatchedZone: lastZone.guide?.zone_ru ?? lastZone.rawZoneName,
          lastMatchedAt: new Date().toISOString(),
          lastMatcherReason: lastZone.matcherReason
        });
        this.callbacks.onZoneDetected(lastZone);
      }
    } finally {
      await handle.close();
    }
  }

  private async resyncLargeFileFromTail(
    filePath: string,
    fileSize: number,
    readAt: string
  ): Promise<boolean> {
    if (fileSize <= TAIL_BYTES) {
      return false;
    }

    // Large resyncs use the same capped tail path as startup bootstrap.
    await this.bootstrapFromTail(filePath, fileSize);
    this.filePosition = fileSize;
    this.resetTextState();
    this.updateRuntimeState({
      fileExists: true,
      lastFileSize: fileSize,
      currentOffset: this.filePosition,
      lastReadAt: readAt
    });
    this.emitStatus('ready', 'Чтение лога активно');
    return true;
  }

  private async readNewContent(options?: {
    allowBootstrap?: boolean;
  }): Promise<void> {
    if (!this.filePath || this.reading) {
      return;
    }

    this.reading = true;
    const readAt = new Date().toISOString();

    try {
      await this.tryBindFileWatcher();

      let fileStat;
      try {
        fileStat = await stat(this.filePath);
      } catch (error) {
        const isMissingFile =
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'ENOENT';

        if (isMissingFile) {
          this.fileWatcher?.close();
          this.fileWatcher = null;
        }

        this.updateRuntimeState({
          fileExists: false,
          lastFileSize: null,
          currentOffset: this.filePosition,
          lastReadAt: readAt
        });
        this.emitStatus(
          isMissingFile ? 'missing' : 'error',
          error instanceof Error ? error.message : 'Ошибка чтения лог-файла'
        );
        return;
      }

      if (!fileStat.isFile()) {
        this.updateRuntimeState({
          fileExists: false,
          lastFileSize: null,
          currentOffset: this.filePosition,
          lastReadAt: readAt
        });
        this.emitStatus('missing', 'Лог-файл не найден');
        return;
      }

      await this.tryBindFileWatcher();

      const wasMissing = !this.runtimeState.fileExists;
      if (options?.allowBootstrap && wasMissing) {
        await this.bootstrapFromTail(this.filePath, fileStat.size);
        this.filePosition = fileStat.size;
        this.resetTextState();
        this.needsResync = false;
        this.updateRuntimeState({
          fileExists: true,
          lastFileSize: fileStat.size,
          currentOffset: this.filePosition,
          lastReadAt: readAt
        });
        this.emitStatus('ready', 'Чтение лога активно');
        return;
      }

      if (wasMissing) {
        await this.bootstrapFromTail(this.filePath, fileStat.size);
        this.filePosition = fileStat.size;
        this.resetTextState();
        this.needsResync = false;
        this.updateRuntimeState({
          fileExists: true,
          lastFileSize: fileStat.size,
          currentOffset: this.filePosition,
          lastReadAt: readAt
        });
        this.emitStatus('ready', 'Чтение лога активно');
        return;
      }

      const requiresResync = this.needsResync || fileStat.size < this.filePosition;
      if (requiresResync) {
        this.resetTextState();
        this.needsResync = false;
        if (await this.resyncLargeFileFromTail(this.filePath, fileStat.size, readAt)) {
          return;
        }
        this.filePosition = 0;
      }

      this.updateRuntimeState({
        fileExists: true,
        lastFileSize: fileStat.size,
        currentOffset: this.filePosition,
        lastReadAt: readAt
      });

      const readSize = fileStat.size - this.filePosition;
      if (readSize <= 0) {
        this.emitStatus('ready', 'Чтение лога активно');
        return;
      }

      const handle = await open(this.filePath, 'r');
      try {
        const buffer = Buffer.alloc(readSize);
        await handle.read(buffer, 0, buffer.length, this.filePosition);
        this.filePosition = fileStat.size;
        this.consumeChunk(this.decodeBuffer(buffer));
        this.updateRuntimeState({
          fileExists: true,
          lastFileSize: fileStat.size,
          currentOffset: this.filePosition,
          lastReadAt: new Date().toISOString()
        });
        this.emitStatus('ready', 'Чтение лога активно');
      } finally {
        await handle.close();
      }
    } finally {
      this.reading = false;
    }
  }

  private consumeChunk(chunk: string): void {
    const merged = stripNulCharacters(`${this.remainder}${chunk}`);
    const lines = merged.split(/\r?\n/);
    this.remainder = lines.pop() ?? '';

    for (const line of lines) {
      const cleanedLine = stripNulCharacters(line);
      if (!cleanedLine.trim()) {
        continue;
      }

      const hadMatchedGuideBeforeLine = Boolean(
        this.runtimeState.lastMatchedZone &&
        this.runtimeState.lastMatcherReason !== 'none'
      );
      this.callbacks.onLine(cleanedLine, 'append');
      this.updateRuntimeState({
        lastAppendedLine: cleanedLine,
        currentOffset: this.filePosition,
        lastReadAt: new Date().toISOString(),
        lastMatcherReason: 'none'
      });

      const zoneMatch = this.extractZoneMatch(cleanedLine);
      if (zoneMatch) {
        if (!this.shouldPreserveRuntimeMatchedZone(zoneMatch, hadMatchedGuideBeforeLine)) {
          this.updateRuntimeState({
            lastMatchedZone: zoneMatch.guide?.zone_ru ?? zoneMatch.rawZoneName,
            lastMatchedAt: new Date().toISOString(),
            lastMatcherReason: zoneMatch.matcherReason
          });
        }
        this.callbacks.onZoneDetected(zoneMatch);
      }

      this.callbacks.onAppendLine(cleanedLine);
    }
  }
}
