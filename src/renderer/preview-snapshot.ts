import guideData from '../data/guide.json';
import powerSpikesData from '../data/power-spikes.json';
import campaignBonusesData from '../data/campaign-bonuses.json';
import { DEFAULT_CONFIG } from '../shared/defaults';
import { buildChecklistViewItems } from '../shared/checklist';
import type {
  AppSnapshot,
  CampaignBonusesDataFile,
  ChecklistItemProgress,
  GuideDataFile,
  GuideEntry
} from '../shared/types';

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeEntry(entry: GuideEntry, index: number): GuideEntry {
  const zoneRu = entry.zone_ru ?? entry.zone_en ?? `Зона ${index + 1}`;
  const zoneEn = entry.zone_en ?? entry.zone_ru ?? `zone_${index + 1}`;

  return {
    ...entry,
    id: entry.id ?? normalizeKey(zoneEn || zoneRu).replace(/\s+/g, '_'),
    zone_ru: zoneRu,
    zone_en: zoneEn,
    recommended_level: entry.recommended_level ?? null,
    recommended_level_label:
      entry.recommended_level_label ??
      (entry.recommended_level == null ? '?' : String(entry.recommended_level)),
    is_good_xp_zone: Boolean(entry.is_good_xp_zone),
    priority: Array.isArray(entry.priority) ? entry.priority : [],
    rewards: Array.isArray(entry.rewards) ? entry.rewards : [],
    skip: Array.isArray(entry.skip) ? entry.skip : [],
    important: Array.isArray(entry.important) ? entry.important : [],
    after: Array.isArray(entry.after) ? entry.after : [],
    boss_tips: Array.isArray(entry.boss_tips) ? entry.boss_tips : [],
    xp_notes: Array.isArray(entry.xp_notes) ? entry.xp_notes : [],
    crafting_tips: Array.isArray(entry.crafting_tips) ? entry.crafting_tips : [],
    details: entry.details ?? [],
    next_zone_ru: entry.next_zone_ru ?? '',
    keywords_done: Array.isArray(entry.keywords_done) ? entry.keywords_done : [],
    checklist: Array.isArray(entry.checklist) ? entry.checklist : [],
    aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
    zone_aliases: Array.isArray(entry.zone_aliases) ? entry.zone_aliases : []
  };
}

function getGuideSource(): GuideDataFile {
  const typedGuideData = guideData as unknown as Partial<GuideDataFile>;

  return Array.isArray(guideData)
    ? {
        zones: guideData.map((entry, index) => normalizeEntry(entry, index)),
        global_reminders: {
          vendor_checkpoints: []
        }
      }
    : {
        ...typedGuideData,
        zones: (typedGuideData.zones ?? []).map((entry, index) =>
          normalizeEntry(entry, index)
        )
      };
}

function buildPreviewProgress(
  guide: GuideEntry | null,
  demoMode: boolean
): Record<string, ChecklistItemProgress> {
  if (!guide || !demoMode || !Array.isArray(guide.checklist) || guide.checklist.length === 0) {
    return {};
  }

  const itemStates: Record<string, ChecklistItemProgress> = {};
  const first = guide.checklist[0];
  const last = guide.checklist[guide.checklist.length - 1];

  if (first) {
    itemStates[first.id] = {
      state: 'done',
      timestamp: '2026-05-12T12:00:00.000Z',
      detectedBy: 'manual',
      originalText: first.text
    };
  }

  if (last && last.id !== first?.id && guide.checklist.length > 3) {
    itemStates[last.id] = {
      state: 'likely_done',
      timestamp: '2026-05-12T12:10:00.000Z',
      detectedBy: 'log',
      originalText: last.text
    };
  }

  return itemStates;
}

export function getPreviewSnapshot(): AppSnapshot {
  const source = getGuideSource();
  const params = new URLSearchParams(window.location.search);
  const zoneKey = normalizeKey(
    params.get('zoneId') ?? params.get('zone') ?? 'a2_maudun_quarry'
  );
  const level = params.get('level');
  const reminderId = params.get('reminder');
  const demoMode = params.get('demo') !== '0';
  const timerStatus = params.get('timerStatus');
  const elapsedMs = Number(params.get('elapsedMs') ?? 0);
  const zoneElapsedMs = Number(params.get('zoneElapsedMs') ?? 0);
  const countdownMs = Number(params.get('countdownMs') ?? 0);
  const selectedGuide =
    source.zones.find((entry) =>
      [entry.id, entry.zone_en, entry.zone_ru].some(
        (candidate) => normalizeKey(candidate) === zoneKey
      )
    ) ?? source.zones[0] ?? null;
  const reminder =
    source.global_reminders?.vendor_checkpoints.find(
      (entry) => normalizeKey(entry.id) === normalizeKey(reminderId)
    ) ?? null;
  const powerSpikes = Array.isArray(powerSpikesData) ? powerSpikesData : [];
  const campaignBonuses = (campaignBonusesData as CampaignBonusesDataFile).bonuses ?? [];
  const currentLevel =
    level && Number.isFinite(Number(level)) ? Number(level) : DEFAULT_CONFIG.currentLevel;
  const now = Date.now();
  const normalizedTimerStatus =
    timerStatus === 'armed' ||
    timerStatus === 'running' ||
    timerStatus === 'paused' ||
    timerStatus === 'finished'
      ? timerStatus
      : 'not_started';

  return {
    config: {
      ...DEFAULT_CONFIG,
      currentLevel,
      levelRemindersState: {
        shown: reminder ? [reminder.id] : [],
        dismissed: [],
        activeLevelReminderId: reminder?.id ?? null
      },
      zoneProgress: selectedGuide
        ? {
            [selectedGuide.id]: {
              itemStates: buildPreviewProgress(selectedGuide, demoMode),
              likelyDoneKeywords: [],
              lastVisitedAt: '2026-05-12T12:12:00.000Z'
            }
          }
        : {}
      ,
      runTimer:
        normalizedTimerStatus === 'running'
          ? {
              ...DEFAULT_CONFIG.runTimer,
              status: 'running',
              elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
              startedAt: now - (Number.isFinite(elapsedMs) ? elapsedMs : 0),
              resumedAt: now,
              lastZoneEnteredAt: now - (Number.isFinite(zoneElapsedMs) ? zoneElapsedMs : 0),
              currentZoneElapsedMs: 0
            }
          : normalizedTimerStatus === 'paused' || normalizedTimerStatus === 'finished'
            ? {
                ...DEFAULT_CONFIG.runTimer,
                status: normalizedTimerStatus,
                elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : 0,
                startedAt: now - (Number.isFinite(elapsedMs) ? elapsedMs : 0),
                pausedAt: now,
                pauseReason: normalizedTimerStatus === 'paused' ? 'manual' : null,
                finishedAt: normalizedTimerStatus === 'finished' ? now : null,
                currentZoneElapsedMs: Number.isFinite(zoneElapsedMs) ? zoneElapsedMs : 0
              }
            : normalizedTimerStatus === 'armed'
              ? {
                  ...DEFAULT_CONFIG.runTimer,
                  status: 'armed'
                }
              : DEFAULT_CONFIG.runTimer,
      runTimerSettings: {
        ...DEFAULT_CONFIG.runTimerSettings,
        autoStartMode: normalizedTimerStatus === 'armed' ? 'scheduled_time' : 'manual',
        leagueStartAt:
          normalizedTimerStatus === 'armed' && Number.isFinite(countdownMs)
            ? now + countdownMs
            : null,
        showCountdownBeforeStart: true,
        showZoneTimer: true,
        showActTimer: true
      }
    },
    currentZone: {
      rawZoneName: selectedGuide?.zone_ru ?? null,
      guide: selectedGuide,
      sceneKind: selectedGuide ? 'gameplay' : 'unknown',
      actHint: selectedGuide?.act ?? null
    },
    currentGuideEntry: selectedGuide,
    currentZoneProgress: selectedGuide
      ? {
          itemStates: buildPreviewProgress(selectedGuide, demoMode),
          likelyDoneKeywords: [],
          lastVisitedAt: '2026-05-12T12:12:00.000Z'
        }
      : null,
    currentChecklist: buildChecklistViewItems(
      selectedGuide,
      selectedGuide
        ? {
            itemStates: buildPreviewProgress(selectedGuide, demoMode),
            likelyDoneKeywords: [],
            lastVisitedAt: '2026-05-12T12:12:00.000Z'
          }
        : undefined
    ),
    guideEntries: source.zones,
    vendorCheckpoints: source.global_reminders?.vendor_checkpoints ?? [],
    powerSpikes,
    campaignBonuses,
    activeLevelReminder: reminder,
    runtime: {
      timerNowMs: Date.now(),
      guideLoadedAt: '2026-05-12T12:00:00.000Z',
      lastLogLine: null,
      lastRawZoneName: selectedGuide?.zone_ru ?? null,
      lastMatchedZoneEn: selectedGuide?.zone_en ?? null,
      lastMatchedZoneRu: selectedGuide?.zone_ru ?? null,
      lastMatchedGuideId: selectedGuide?.id ?? null,
      lastZoneSource: 'simulation',
      logWatcherStatus: 'ready',
      logWatcherMessage: 'Preview mode',
      logFileExists: true,
      logFileSize: 0,
      watchedLogPath: null,
      currentLogOffset: 0,
      lastAppendedLine: null,
      watcherLastMatchedZone: selectedGuide?.zone_ru ?? null,
      lastWatcherUpdateAt: '2026-05-12T12:00:00.000Z',
      lastReadAt: '2026-05-12T12:00:00.000Z',
      lastMatchedAt: '2026-05-12T12:00:00.000Z',
      lastMatcherReason: selectedGuide ? 'zone_ru' : 'none',
      lastLevelUpDetectedAt: currentLevel ? '2026-05-12T12:00:00.000Z' : null,
      lastLogLineAt: '2026-05-12T12:00:00.000Z',
      lastValidGameplayZoneAt: '2026-05-12T12:00:00.000Z',
      lastGameplayGuideId: selectedGuide?.id ?? null,
      lastGameplayZoneRu: selectedGuide?.zone_ru ?? null,
      lastGameplayAct: typeof selectedGuide?.act === 'number' ? selectedGuide.act : null,
      lastSceneSource: selectedGuide?.zone_ru ?? null,
      lastSceneSourceAt: '2026-05-12T12:00:00.000Z',
      overlayMode: params.get('overlayMode') === 'timer_only' ? 'timer_only' : 'full',
      missedWarningZoneRu: null,
      missedWarningItems: [],
      endgameT15CompletionNotice: null
    }
  };
}
