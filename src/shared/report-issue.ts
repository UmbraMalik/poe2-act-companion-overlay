import type { AppLanguage, AppSnapshot } from './types';
import { PROJECT_FEEDBACK_URL } from './community-links';
import { getGuideView, translateDataText } from '../i18n/data';
import {
  formatLogWatcherStatus,
  formatZoneMatcherReason,
  translateSystemText
} from '../i18n/runtime';
import { translate } from '../i18n/translations';

export { PROJECT_FEEDBACK_URL };

export type ReportTemplate = 'bug' | 'data' | 'ui' | 'idea';

export function getReportTemplateLabels(language: AppLanguage): Record<ReportTemplate, string> {
  return {
    bug: translate(language, 'reportTemplates.bug'),
    data: translate(language, 'reportTemplates.data'),
    ui: translate(language, 'reportTemplates.ui'),
    idea: translate(language, 'reportTemplates.idea')
  };
}

function yesNo(value: boolean, language: AppLanguage): string {
  return value
    ? translate(language, 'reportBody.yes')
    : translate(language, 'reportBody.no');
}

export function getReportZoneLabel(
  snapshot: AppSnapshot | null,
  language: AppLanguage
): string {
  const guide = snapshot?.currentGuideEntry ?? snapshot?.currentZone.guide ?? null;

  if (guide) {
    const actLabel =
      guide.act === 'interlude'
        ? translate(language, 'reportBody.actInterlude')
        : translate(language, 'reportBody.actLabel', { act: guide.act });
    const guideView = getGuideView(guide, language);
    return `${guideView?.zoneName ?? guide.zone_ru} / ${guide.zone_en} (${actLabel})`;
  }

  return (
    snapshot?.currentZone.rawZoneName ||
    snapshot?.runtime.lastRawZoneName ||
    translate(language, 'reportBody.zoneUndefined')
  );
}

export function buildReportDiagnostics(
  snapshot: AppSnapshot | null,
  appVersion: string,
  language: AppLanguage,
  options: {
    now?: Date;
    userAgent?: string;
  } = {}
): string {
  const config = snapshot?.config;
  const runtime = snapshot?.runtime;
  const runTimer = config?.runTimer;
  const currentGuide = snapshot?.currentGuideEntry ?? snapshot?.currentZone.guide ?? null;
  const currentLevel = config?.currentLevel ?? null;
  const now = options.now ?? new Date();
  const userAgent =
    options.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown');
  const locale = language === 'en' ? 'en-US' : 'ru-RU';

  return [
    translate(language, 'reportBody.appVersion', { value: appVersion }),
    translate(language, 'reportBody.date', { value: now.toLocaleString(locale) }),
    translate(language, 'reportBody.currentZone', { value: getReportZoneLabel(snapshot, language) }),
    translate(language, 'reportBody.zoneId', { value: currentGuide?.id ?? '—' }),
    translate(language, 'reportBody.rawZone', {
      value: snapshot?.currentZone.rawZoneName ?? runtime?.lastRawZoneName ?? '—'
    }),
    translate(language, 'reportBody.zoneSource', { value: runtime?.lastZoneSource ?? '—' }),
    translate(language, 'reportBody.matcherReason', {
      value: formatZoneMatcherReason(runtime?.lastMatcherReason, language)
    }),
    translate(language, 'reportBody.sceneKind', { value: snapshot?.currentZone.sceneKind ?? '—' }),
    translate(language, 'reportBody.characterLevel', { value: currentLevel ?? '—' }),
    translate(language, 'reportBody.recommendedLevel', {
      value: currentGuide ? translateDataText(currentGuide.recommended_level_label, language) : '—'
    }),
    translate(language, 'reportBody.logSelected', {
      value: yesNo(Boolean(config?.logFilePath), language)
    }),
    translate(language, 'reportBody.logPath', { value: config?.logFilePath ?? '—' }),
    translate(language, 'reportBody.logExists', {
      value: yesNo(Boolean(runtime?.logFileExists), language)
    }),
    translate(language, 'reportBody.watcher', {
      status: formatLogWatcherStatus(runtime?.logWatcherStatus, language),
      message: translateSystemText(runtime?.logWatcherMessage ?? '—', language)
    }),
    translate(language, 'reportBody.lastLogLine', {
      value: runtime?.lastLogLine ? runtime.lastLogLine.slice(0, 220) : '—'
    }),
    translate(language, 'reportBody.lastRead', { value: runtime?.lastReadAt ?? '—' }),
    translate(language, 'reportBody.lastMatch', { value: runtime?.lastMatchedAt ?? '—' }),
    translate(language, 'reportBody.overlayMode', {
      value: runtime?.overlayMode ?? config?.mainOverlaySettings.overlayMode ?? '—'
    }),
    translate(language, 'reportBody.overlayLayout', {
      density: config?.overlayDensity ?? '—',
      scale: config?.overlayScale ?? '—'
    }),
    translate(language, 'reportBody.runTimer', { value: runTimer?.status ?? '—' }),
    translate(language, 'reportBody.runTime', { value: runTimer?.elapsedMs ?? 0 }),
    translate(language, 'reportBody.pauses', { value: runTimer?.pauseCount ?? '—' }),
    translate(language, 'reportBody.userAgent', { value: userAgent })
  ].join('\n');
}

export function getDiagnosticsZoneLine(
  diagnostics: string,
  language: AppLanguage
): string {
  const prefix = translate(language, 'reportBody.currentZone', { value: '' }).replace(/\s*$/, '');
  const line = diagnostics.split('\n').find((item) => item.startsWith(prefix));
  return line?.replace(prefix, '').trim() || '';
}

export function buildReportTemplateBody(
  template: ReportTemplate,
  diagnostics: string,
  language: AppLanguage
): string {
  if (template === 'data') {
    return translate(language, 'reportBody.data', {
      zone: getDiagnosticsZoneLine(diagnostics, language),
      diagnostics
    });
  }

  if (template === 'ui') {
    return translate(language, 'reportBody.ui', { diagnostics });
  }

  if (template === 'idea') {
    return translate(language, 'reportBody.idea', { diagnostics });
  }

  return translate(language, 'reportBody.bug', { diagnostics });
}
