import { constants, watch, type FSWatcher } from 'node:fs';
import { access, open, stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { GuideService, type ExtractedZoneMatch } from './guide-service';
import { ZoneMatchExtractor } from './zone-match-extractor';
import type {
  LogWatcherRuntimeState,
  LogWatcherStatus
} from '../../shared/types';

interface LogWatcherCallbacks {
  onLine: (line: string, source: 'bootstrap' | 'append', zoneMatch: ExtractedZoneMatch | null) => void;
  onAppendLine: (line: string) => void;
  onZoneDetected: (zoneMatch: ExtractedZoneMatch) => void;
  onStatusChange: (status: LogWatcherStatus, message: string) => void;
  onRuntimeStateChange: (
    state: LogWatcherRuntimeState & { fileExists: boolean }
  ) => void;
}

const TAIL_BYTES = 128 * 1024;
const POLL_INTERVAL_MS = 750;
const READ_CHUNK_BYTES = 64 * 1024;
const MAX_LINE_CHARS = 128 * 1024;
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
  private readonly zoneExtractor: ZoneMatchExtractor;
  private decoder = new StringDecoder('utf8');
  private generation = 0;
  private activeRead: Promise<void> | null = null;
  private seeking = false;
  private fileIdentity: string | null = null;
  private historicalRemainder = false;
  private discardUntilNewline = false;
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
    lastActivityAt: null,
    lastLiveZoneAt: null,
    lastMatchedAt: null,
    lastMatcherReason: 'none',
    fileExists: false
  };

  constructor(
    guideService: GuideService,
    private readonly callbacks: LogWatcherCallbacks
  ) {
    this.zoneExtractor = new ZoneMatchExtractor(guideService);
  }

  private resetTextState(): void {
    this.remainder = '';
    this.historicalRemainder = false;
    this.discardUntilNewline = false;
    this.zoneExtractor.reset();
    this.decoder = new StringDecoder('utf8');
  }

  private decodeBuffer(buffer: Buffer): string {
    return stripNulCharacters(this.decoder.write(buffer));
  }

  private extractZoneMatch(line: string): ExtractedZoneMatch | null {
    return this.zoneExtractor.extractFromLogLine(line);
  }

  async start(filePath: string, options?: { skipBootstrap?: boolean }): Promise<void> {
    this.stop();
    const generation = this.generation;
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
      lastActivityAt: null,
      lastLiveZoneAt: null,
      lastMatchedAt: null,
      lastMatcherReason: 'none',
      fileExists: false
    });

    this.seeking = true;
    this.bindDirectoryWatcher(filePath);
    await this.tryBindFileWatcher(generation);
    if (generation !== this.generation) return;
    this.seeking = false;
    if (options?.skipBootstrap) {
      await this.seekToEnd();
    } else {
      await this.readNewContent({
        allowBootstrap: true
      });
    }
    if (generation === this.generation) this.startPolling();
  }

  stop(): void {
    this.generation++;
    this.activeRead = null;
    this.seeking = false;
    this.fileIdentity = null;
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
      lastActivityAt: null,
      lastLiveZoneAt: null,
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

    const generation = this.generation;
    const filePath = this.filePath;
    this.seeking = true;
    const readAt = new Date().toISOString();

    try {
      await this.activeRead;
      if (generation !== this.generation) return;
      const fileStat = await stat(filePath);
      if (generation !== this.generation) return;
      if (!fileStat.isFile()) {
        return;
      }

      this.fileIdentity = `${fileStat.dev}:${fileStat.ino}`;
      this.filePosition = fileStat.size;
      this.resetTextState();
      this.needsResync = false;
      this.updateRuntimeState({
        fileExists: true,
        lastFileSize: fileStat.size,
        lastActivityAt: fileStat.mtime.toISOString(),
        currentOffset: this.filePosition,
        lastReadAt: readAt,
        lastMatchedZone: null,
        lastMatchedAt: null,
        lastMatcherReason: 'none'
      });
      this.emitStatus('ready', 'Чтение лога активно');
    } catch {
      if (generation !== this.generation) return;
      this.updateRuntimeState({
        fileExists: false,
        lastFileSize: null,
        lastActivityAt: null,
        lastLiveZoneAt: null,
        currentOffset: this.filePosition,
        lastReadAt: readAt
      });
    } finally {
      if (generation === this.generation) this.seeking = false;
    }
  }

  private bindDirectoryWatcher(filePath: string): void {
    const generation = this.generation;
    try {
      const watcher = watch(dirname(filePath), (eventType, fileName) => {
        if (generation !== this.generation || this.directoryWatcher !== watcher) return;
        const nextName = fileName?.toString().toLowerCase() ?? null;
        if (!nextName || nextName === this.watchedFileName) {
          if (eventType === 'rename') this.needsResync = true;
          this.queueRead(25);
        }
      });
      this.directoryWatcher = watcher;
      watcher.on('error', () => {
        if (generation !== this.generation || this.directoryWatcher !== watcher) return;
        this.directoryWatcher = null;
        watcher.close();
        this.queueRead();
      });
    } catch { this.directoryWatcher = null; }
  }

  private async tryBindFileWatcher(generation: number): Promise<void> {
    const filePath = this.filePath;
    if (!filePath || this.fileWatcher || generation !== this.generation) return;
    try {
      await access(filePath, constants.R_OK);
      if (generation !== this.generation || this.fileWatcher) return;
      const watcher = watch(filePath, (eventType) => {
        if (generation !== this.generation || this.fileWatcher !== watcher) return;
        if (eventType === 'rename') {
          this.needsResync = true;
          this.fileWatcher = null;
          watcher.close();
        }
        this.queueRead(25);
      });
      this.fileWatcher = watcher;
      watcher.on('error', () => {
        if (generation !== this.generation || this.fileWatcher !== watcher) return;
        this.fileWatcher = null;
        watcher.close();
        this.queueRead();
      });
    } catch { /* Polling remains available. */ }
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
    filePath: string, fileSize: number, generation: number
  ): Promise<void> {
    const start = Math.max(0, fileSize - TAIL_BYTES);
    const handle = await open(filePath, 'r');
    try {
      if (generation !== this.generation) return;
      const openedStat = await handle.stat();
      if (generation !== this.generation) return;
      if (`${openedStat.dev}:${openedStat.ino}` !== this.fileIdentity || openedStat.size < fileSize) {
        this.needsResync = true;
        return;
      }
      // Include the byte preceding the tail to distinguish a line boundary
      // from a truncated first line, without reading unbounded history.
      const readStart = Math.max(0, start - 1);
      const buffer = Buffer.alloc(fileSize - readStart);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const result = await handle.read(buffer, bytesRead, buffer.length - bytesRead, readStart + bytesRead);
        if (generation !== this.generation || this.needsResync) return;
        if (!result.bytesRead) {
          // The file shrank while reading. Retry as historical on the next poll.
          this.needsResync = true;
          return;
        }
        bytesRead += result.bytesRead;
      }
      this.resetTextState();
      this.filePosition = readStart + bytesRead;
      let content = this.decodeBuffer(buffer.subarray(start - readStart, bytesRead));
      if (start > 0 && buffer[0] !== 0x0a) {
        const newline = content.indexOf('\n');
        this.discardUntilNewline = newline < 0;
        content = newline < 0 ? '' : content.slice(newline + 1);
      }
      // Bootstrap and resync use the same historical event path. Do not send
      // append callbacks or mutate timer/rewards as if these were live lines.
      this.consumeChunk(content, false);
      // Check raw bytes: StringDecoder can hold an unfinished UTF-8 code point
      // even when the decoded text currently ends at a newline.
      this.historicalRemainder = Boolean(this.remainder) || bytesRead > 0 && buffer[bytesRead - 1] !== 0x0a;
    } finally { await handle.close(); }
  }

  private readNewContent(options?: { allowBootstrap?: boolean }): Promise<void> {
    if (!this.filePath || this.seeking) return Promise.resolve();
    if (this.activeRead) return this.activeRead;
    const generation = this.generation;
    const promise = this.readContent(this.filePath, generation, options).finally(() => {
      if (this.activeRead === promise) this.activeRead = null;
    });
    this.activeRead = promise;
    return promise;
  }

  private async readContent(filePath: string, generation: number, _options?: { allowBootstrap?: boolean }): Promise<void> {
    const current = () => generation === this.generation;
    const readAt = new Date().toISOString();
    try {
      if (!this.directoryWatcher) this.bindDirectoryWatcher(filePath);
      await this.tryBindFileWatcher(generation);
      if (!current()) return;
      let fileStat;
      try { fileStat = await stat(filePath); }
      catch (error) {
        if (!current()) return;
        const missing = (error as NodeJS.ErrnoException)?.code === 'ENOENT';
        if (missing) { this.fileWatcher?.close(); this.fileWatcher = null; }
        this.updateRuntimeState({ fileExists: false, lastFileSize: null, lastActivityAt: null,
          lastLiveZoneAt: null, currentOffset: this.filePosition, lastReadAt: readAt });
        this.emitStatus(missing ? 'missing' : 'error', error instanceof Error ? error.message : 'Ошибка чтения лог-файла');
        return;
      }
      if (!current()) return;
      if (!fileStat.isFile()) {
        this.updateRuntimeState({ fileExists: false, lastFileSize: null, lastActivityAt: null,
          lastLiveZoneAt: null, currentOffset: this.filePosition, lastReadAt: readAt });
        this.emitStatus('missing', 'Лог-файл не найден');
        return;
      }
      const identity = `${fileStat.dev}:${fileStat.ino}`;
      const requiresResync = !this.runtimeState.fileExists || this.needsResync ||
        fileStat.size < this.filePosition || this.fileIdentity !== identity;
      this.fileIdentity = identity;
      if (requiresResync) {
        this.needsResync = false;
        this.updateRuntimeState({ lastLiveZoneAt: null });
        await this.bootstrapFromTail(filePath, fileStat.size, generation);
        if (!current() || this.needsResync) return;
      } else if (fileStat.size > this.filePosition) {
        const handle = await open(filePath, 'r');
        try {
          if (!current()) return;
          const openedStat = await handle.stat();
          if (!current()) return;
          if (`${openedStat.dev}:${openedStat.ino}` !== identity || openedStat.size < fileStat.size) {
            this.needsResync = true;
            return;
          }
          const buffer = Buffer.alloc(READ_CHUNK_BYTES);
          while (this.filePosition < fileStat.size && current() && !this.needsResync) {
            const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, fileStat.size - this.filePosition), this.filePosition);
            if (!current() || this.needsResync) return;
            if (!bytesRead) break;
            this.filePosition += bytesRead;
            this.consumeChunk(this.decodeBuffer(buffer.subarray(0, bytesRead)), true);
            // Bound per-turn work even when an entire backlog is already cached.
            await new Promise<void>((resolve) => setImmediate(resolve));
          }
        } finally { await handle.close(); }
        if (!current()) return;
      }
      this.updateRuntimeState({ fileExists: true, lastFileSize: fileStat.size,
        lastActivityAt: fileStat.mtime.toISOString(), currentOffset: this.filePosition, lastReadAt: readAt });
      this.emitStatus('ready', 'Чтение лога активно');
    } catch (error) {
      if (!current()) return;
      this.updateRuntimeState({ fileExists: false, lastFileSize: null, lastActivityAt: null, lastLiveZoneAt: null });
      this.emitStatus('error', error instanceof Error ? error.message : 'Ошибка чтения лог-файла');
    }
  }

  private consumeChunk(chunk: string, isLiveAppend: boolean): void {
    if (this.discardUntilNewline) {
      const newline = chunk.indexOf('\n');
      if (newline < 0) return;
      chunk = chunk.slice(newline + 1);
      this.discardUntilNewline = false;
      this.historicalRemainder = false;
    }
    const merged = stripNulCharacters(`${this.remainder}${chunk}`);
    const lines = merged.split(/\r?\n/);
    this.remainder = lines.pop() ?? '';
    if (this.remainder.length > MAX_LINE_CHARS) {
      this.remainder = '';
      this.discardUntilNewline = true;
    }
    let historical = this.historicalRemainder;
    if (lines.length) this.historicalRemainder = false;

    for (const line of lines) {
      const live = isLiveAppend && !historical;
      historical = false;
      const cleanedLine = stripNulCharacters(line);
      if (cleanedLine.length > MAX_LINE_CHARS || !cleanedLine.trim()) {
        continue;
      }

      const hadMatchedGuideBeforeLine = Boolean(
        this.runtimeState.lastMatchedZone &&
        this.runtimeState.lastMatcherReason !== 'none'
      );
      const zoneMatch = this.extractZoneMatch(cleanedLine);
      this.callbacks.onLine(cleanedLine, live ? 'append' : 'bootstrap', zoneMatch);
      if (live) this.updateRuntimeState({
        lastAppendedLine: cleanedLine,
        currentOffset: this.filePosition,
        lastReadAt: new Date().toISOString(),
        lastMatcherReason: 'none'
      });

      if (zoneMatch) {
        if (live) {
          this.updateRuntimeState({ lastLiveZoneAt: new Date().toISOString() });
        }
        if (!this.shouldPreserveRuntimeMatchedZone(zoneMatch, hadMatchedGuideBeforeLine)) {
          this.updateRuntimeState({
            lastMatchedZone: zoneMatch.guide?.zone_ru ?? zoneMatch.rawZoneName,
            lastMatchedAt: new Date().toISOString(),
            lastMatcherReason: zoneMatch.matcherReason
          });
        }
        this.callbacks.onZoneDetected(zoneMatch);
      }

      if (live) this.callbacks.onAppendLine(cleanedLine);
    }
  }
}
