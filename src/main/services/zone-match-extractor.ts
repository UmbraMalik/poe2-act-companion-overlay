import { shouldKeepPendingZoneAreaId } from '../scene-classifier';
import { GuideService, type ExtractedZoneMatch } from './guide-service';
import { extractGeneratedAreaId, extractNamedZoneFromLine } from './log-parser';

function normalizeLogLine(line: unknown): string {
  return String(line ?? '').replace(/\u0000/g, '').trim();
}

export class ZoneMatchExtractor {
  private pendingAreaId: string | null = null;

  constructor(private readonly guideService: GuideService) {}

  reset(): void {
    this.pendingAreaId = null;
  }

  extractFromLogLine(line: unknown): ExtractedZoneMatch | null {
    const trimmedLine = normalizeLogLine(line);
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

      if (!shouldKeepPendingZoneAreaId(extractedZoneName)) {
        this.pendingAreaId = null;
      }

      return zoneMatch;
    }

    return this.guideService.extractZoneMatchFromLine(trimmedLine);
  }
}
