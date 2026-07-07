import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  useAppSnapshot,
  type LiveRunTimerTextFrame,
  useLiveRunTimerText,
  useRunTimerState,
  type LiveRunTimerState
} from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import {
  getCurrentActElapsedMs,
  getCurrentActElapsedMsForAct,
  getNearestPowerSpike,
  getRunElapsedMs,
  getSceneDisplayName,
  getXpStatus
} from '../companion-helpers';
import { formatDuration, getLevelState } from '../utils';
import { getOverlayMinimumSize } from '../../shared/overlay-layout';
import { isEndgameT15Act } from '../../shared/timers';
import { shouldStartOverlayDrag } from '../../shared/overlay-drag';
import {
  getOverlayLockButtonIcon,
  getOverlayLockButtonLabel,
  getResizeGripClassName,
  stopOverlayControlPropagation,
  toggleOverlayMovementLock
} from '../overlay-lock';
import {
  scheduleOverlayRenderCommit,
  type OverlayRenderTask
} from '../render-scheduler';
import { reportOverlayRenderDiagnostics } from '../render-diagnostics';
import { getAppThemeClassName } from '../theme';
import leagueMechanicRewardsData from '../../data/league-mechanic-rewards.json';
import { getCampaignBonusView, getGuideView, getLevelReminderView, getPowerSpikeView } from '../../i18n/data';
import { translateSystemText } from '../../i18n/runtime';
import { translate } from '../../i18n/translations';
import type {
  AppLanguage,
  AppTheme,
  CampaignBonusDefinition,
  GuideEntry,
  LevelReminder,
  PowerSpike,
  RunTimerSettings,
  RunTimerState,
  ZoneAct
} from '../../shared/types';

function formatActTitle(act: ZoneAct | null, language: AppLanguage): string {
  if (act === null) {
    return translate(language, 'overlay.currentZoneFallback');
  }

  if (typeof act === 'number' && isEndgameT15Act(act)) {
    return translate(language, 'route.endgameToT15');
  }

  return act === 'interlude'
    ? translate(language, 'route.interludes')
    : translate(language, 'route.act', { act });
}

function formatHotkeyLabel(value: string | null | undefined, fallback: string): string {
  const label = (value ?? fallback).trim();
  return label.length > 0 ? label : fallback;
}

function formatTimerOnlyRunStatus(
  runTimer: RunTimerState,
  language: AppLanguage
): string {
  if (runTimer.status === 'armed') {
    return translate(language, 'overlay.timerOnlyArmed');
  }

  if (runTimer.status === 'paused') {
    return translate(language, 'overlay.timerOnlyPaused');
  }

  if (runTimer.status === 'finished') {
    return translate(language, 'overlay.timerOnlyFinished');
  }

  if (runTimer.status === 'running') {
    return translate(language, 'overlay.timerOnlyRunning');
  }

  return translate(language, 'overlay.timerOnlyReady');
}

interface OverlayUpcomingReminder {
  id: string;
  level: number;
  title: string;
  items: string[];
  source: 'vendor' | 'power';
}

interface LeagueMechanicRewardEntry {
  id: string;
  section: string;
  actLabel: string;
  zone_en: string;
  zone_ru: string;
  guideZoneId: string | null;
  guideZoneRu: string | null;
  aliases_ru?: string[];
  reward_en: string;
  reward_ru: string;
  rewardType: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  oneTimeGuaranteed: boolean;
  duplicateInCurrentGuide: boolean;
  uncertain?: boolean;
}

const LEAGUE_MECHANIC_REWARDS = (
  leagueMechanicRewardsData as { rewards?: LeagueMechanicRewardEntry[] }
).rewards ?? [];

function getOverlayUpcomingReminders(
  snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>,
  language: AppLanguage,
  maxDelta = 2
): OverlayUpcomingReminder[] {
  const currentLevel = snapshot.config.currentLevel;

  if (currentLevel === null) {
    return [];
  }

  const vendorReminders: OverlayUpcomingReminder[] = snapshot.vendorCheckpoints.map(
    (entry: LevelReminder) => ({
      id: `vendor-${entry.id}`,
      level: entry.level,
      title: getLevelReminderView(entry, language)?.displayTitle ?? entry.title,
      items: getLevelReminderView(entry, language)?.displayItems ?? entry.items,
      source: 'vendor'
    })
  );

  const powerSpikes: OverlayUpcomingReminder[] = snapshot.powerSpikes
    .map((entry) => ({
      id: `power-${entry.id}`,
      level: entry.level,
      title: getPowerSpikeView(entry, language)?.displayTitle ?? entry.title,
      items: getPowerSpikeView(entry, language)?.displayItems ?? entry.items,
      source: 'power' as const
    }));

  const seen = new Set<string>();

  return [...vendorReminders, ...powerSpikes]
    .filter((entry) => entry.level >= currentLevel && entry.level <= currentLevel + maxDelta)
    .sort((left, right) => {
      if (left.level !== right.level) {
        return left.level - right.level;
      }

      if (left.source !== right.source) {
        return left.source === 'vendor' ? -1 : 1;
      }

      return left.title.localeCompare(right.title, language === 'en' ? 'en' : 'ru');
    })
    .filter((entry) => {
      const key = `${entry.level}-${entry.title.toLocaleLowerCase(language === 'en' ? 'en' : 'ru')}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function getImportantOverlayLines(
  snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>,
  language: AppLanguage
) {
  const guide = snapshot.currentGuideEntry;
  if (!guide) {
    return [];
  }

  const guideView = getGuideView(guide, language);
  const nearestPowerSpike = getNearestPowerSpike(
    snapshot.powerSpikes,
    snapshot.config.currentLevel
  );
  const powerSpikeView = getPowerSpikeView(nearestPowerSpike, language);
  const xpStatus = getXpStatus(snapshot, language);
  const lines: string[] = [];

  if (snapshot.config.mainOverlaySettings.showOverlayCriticalImportant) {
    lines.push(...(guideView?.important ?? []));
  }

  if (snapshot.config.mainOverlaySettings.showOverlayBossTip) {
    lines.push(...(guideView?.bossTips ?? []));
  }

  if (
    snapshot.config.mainOverlaySettings.showOverlayXpStatus &&
    (xpStatus.variant === 'low' || xpStatus.variant === 'farm')
  ) {
    lines.push(xpStatus.longLabel);
  }

  if (snapshot.config.mainOverlaySettings.showOverlayPowerSpike && nearestPowerSpike) {
    lines.push(
      translate(language, 'overlay.powerSpike', {
        level: nearestPowerSpike.level,
        title: powerSpikeView?.displayTitle ?? nearestPowerSpike.title
      })
    );
  }

  return [...new Set(lines.filter(Boolean))].slice(0, 2);
}

function normalizeZoneBonusName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLeagueZoneName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’'`".,:;!?()[\]{}\/\u2014\u2013-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '');
}

function addLeagueZoneCandidate(candidates: Set<string>, value: string | null | undefined): void {
  const normalized = normalizeLeagueZoneName(value);
  if (normalized) {
    candidates.add(normalized);
  }
}

function getCurrentZoneLeagueReward(
  snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>,
  sceneName: string
): LeagueMechanicRewardEntry | null {
  const guide = snapshot.currentGuideEntry;
  const guideId = guide?.id ?? null;
  const candidates = new Set<string>();

  addLeagueZoneCandidate(candidates, guide?.zone_ru);
  addLeagueZoneCandidate(candidates, guide?.zone_en);
  addLeagueZoneCandidate(candidates, snapshot.currentZone.rawZoneName);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastRawZoneName);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastMatchedZoneRu);
  addLeagueZoneCandidate(candidates, snapshot.runtime.lastMatchedZoneEn);
  addLeagueZoneCandidate(candidates, sceneName);

  return (
    LEAGUE_MECHANIC_REWARDS.find((reward) => {
      if (!reward.displayInOverlay || !reward.hasReward) {
        return false;
      }

      if (guideId && reward.guideZoneId === guideId) {
        return true;
      }

      const rewardNames = [
        reward.zone_ru,
        reward.zone_en,
        reward.guideZoneRu,
        ...(reward.aliases_ru ?? [])
      ];

      return rewardNames.some((name) => candidates.has(normalizeLeagueZoneName(name)));
    }) ?? null
  );
}

function getGuideCampaignBonusIds(guide: GuideEntry | null): Set<string> {
  const guideWithBonuses = guide as (GuideEntry & {
    campaign_bonus_ids?: string[];
    campaignBonusIds?: string[];
  }) | null;

  const ids = [
    ...(Array.isArray(guideWithBonuses?.campaign_bonus_ids) ? guideWithBonuses.campaign_bonus_ids : []),
    ...(Array.isArray(guideWithBonuses?.campaignBonusIds) ? guideWithBonuses.campaignBonusIds : [])
  ];

  return new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean));
}
function isKhariCrossingGuide(guide: GuideEntry | null, rawZoneName: string | null | undefined): boolean {
  const guideId = normalizeZoneBonusName(guide?.id);
  const zoneRu = normalizeZoneBonusName(guide?.zone_ru);
  const zoneEn = normalizeZoneBonusName(guide?.zone_en);
  const raw = normalizeZoneBonusName(rawZoneName);

  return (
    guideId === 'interlude_khari_crossing' ||
    zoneRu === 'кхарийский перевал' ||
    zoneEn === 'the khari crossing' ||
    raw === 'кхарийский перевал' ||
    raw === 'the khari crossing'
  );
}

function isGalaiGatesGuide(guide: GuideEntry | null, rawZoneName: string | null | undefined): boolean {
  const guideId = normalizeZoneBonusName(guide?.id);
  const zoneRu = normalizeZoneBonusName(guide?.zone_ru);
  const zoneEn = normalizeZoneBonusName(guide?.zone_en);
  const raw = normalizeZoneBonusName(rawZoneName);

  return (
    guideId === 'interlude_galai_gates' ||
    zoneRu === 'ворота галаи' ||
    zoneRu === 'врата голай' ||
    zoneEn === 'the galai gates' ||
    zoneEn === 'galai gates' ||
    raw === 'ворота галаи' ||
    raw === 'врата голай' ||
    raw === 'the galai gates' ||
    raw === 'galai gates'
  );
}

function isKhariCrossingCampaignBonus(bonus: CampaignBonusDefinition): boolean {
  const id = normalizeZoneBonusName(bonus.id);
  const zoneId = normalizeZoneBonusName(bonus.zoneId);
  const zoneRu = normalizeZoneBonusName(bonus.zone_ru);
  const title = normalizeZoneBonusName(bonus.title);
  const source = normalizeZoneBonusName(bonus.source);
  const details = normalizeZoneBonusName((bonus.details ?? []).join(' '));

  if (zoneId === 'interlude_khari_crossing' || zoneRu === 'кхарийский перевал') {
    return true;
  }

  const isLifeBonus = title.includes('+5') && title.includes('здоров');
  const isWeaponBonus = title.includes('+2') && title.includes('пассив') && title.includes('оруж');
  const mentionsKhariSource =
    source.includes('кхарийский перевал') ||
    details.includes('расплавленн') ||
    details.includes('актхи') ||
    details.includes('анундр') ||
    details.includes('рису');

  return (
    id.includes('khari_crossing') ||
    (id.includes('galai_gates') && (isLifeBonus || isWeaponBonus) && mentionsKhariSource) ||
    ((isLifeBonus || isWeaponBonus) && mentionsKhariSource)
  );
}

function getCurrentZoneCampaignBonuses(snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>) {
  const guide = snapshot.currentGuideEntry;
  const rawZoneName = snapshot.currentZone.rawZoneName;
  const guideId = guide?.id ?? null;
  const explicitBonusIds = getGuideCampaignBonusIds(guide);
  const progress = snapshot.config.campaignBonusProgress ?? {};
  const isKhariCrossing = isKhariCrossingGuide(guide, rawZoneName);
  const isGalaiGates = isGalaiGatesGuide(guide, rawZoneName);
  const zoneNames = guideId
    ? new Set<string>()
    : new Set([normalizeZoneBonusName(guide?.zone_ru), normalizeZoneBonusName(rawZoneName)].filter(Boolean));

  const matchedBonuses = snapshot.campaignBonuses.filter((bonus) => {
    const isKhariBonus = isKhariCrossingCampaignBonus(bonus);

    // The Galai Gates / Ворота Галаи do not own the Khari Crossing campaign bonuses.
    if (isGalaiGates && isKhariBonus) {
      return false;
    }

    // Khari Crossing owns both +5% life and +2 weapon set passive points.
    if (isKhariCrossing && isKhariBonus) {
      return true;
    }

    if (guideId) {
      return bonus.zoneId === guideId || explicitBonusIds.has(bonus.id);
    }

    return explicitBonusIds.has(bonus.id) || zoneNames.has(normalizeZoneBonusName(bonus.zone_ru));
  });

  const uniqueBonuses = Array.from(new Map(matchedBonuses.map((bonus) => [bonus.id, bonus])).values());

  return uniqueBonuses
    .map((bonus) => ({ bonus, done: Boolean(progress[bonus.id]) }))
    .sort((left, right) => Number(left.done) - Number(right.done));
}

function getDetailLines(
  guide: GuideEntry | null,
  key: string,
  language: AppLanguage
): string[] {
  const details = getGuideView(guide, language)?.details;

  if (!details || Array.isArray(details) || typeof details !== 'object') {
    return [];
  }

  const value = (details as Record<string, unknown>)[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getOverlaySpeedrunLines(
  guide: GuideEntry | null,
  language: AppLanguage
): string[] {
  const overlaySpeedrun = getDetailLines(guide, 'overlay_speedrun', language);
  if (overlaySpeedrun.length > 0 || guide?.details && !Array.isArray(guide.details) && 'overlay_speedrun' in guide.details) {
    return overlaySpeedrun.slice(0, 3);
  }

  const groups: Array<[string, string]> = [
    ['checkpoint', 'companion.detailsGroup.checkpoint'],
    ['town_plan', 'companion.detailsGroup.town'],
    ['navigation', 'companion.detailsGroup.navigation'],
    ['time_saves', 'companion.detailsGroup.time_saves'],
    ['opportunistic', 'companion.detailsGroup.opportunistic'],
    ['xp_strategy', 'common.xpNotes'],
    ['craft_plan', 'common.craftingTips']
  ];

  return groups
    .flatMap(([key, labelKey]) =>
      getDetailLines(guide, key, language)
        .slice(0, 1)
        .map((line) => `${translate(language, labelKey)}: ${line}`)
    )
    .slice(0, 3);
}


function getChecklistItemTone(
  item: GuideEntry['checklist'][number]
): string {
  if (
    item.type === 'reward' ||
    item.type === 'permanent_reward' ||
    item.type === 'passive' ||
    item.type === 'resistance' ||
    item.type === 'spirit' ||
    item.type === 'life' ||
    item.type === 'mana' ||
    item.type === 'crafting' ||
    item.type === 'currency'
  ) {
    return ' is-reward';
  }

  if (item.type === 'boss') {
    return ' is-boss';
  }

  if (!item.required || item.type === 'route_task') {
    return ' is-optional';
  }

  const normalized = item.text.toLocaleLowerCase('ru');
  const isReward =
    normalized.includes('награ') ||
    normalized.includes('пассив') ||
    normalized.includes('сопротив') ||
    normalized.includes('резист') ||
    normalized.includes('дух') ||
    normalized.includes('spirit') ||
    normalized.includes('gem') ||
    normalized.includes('камень') ||
    normalized.includes('+');
  const isBoss =
    normalized.includes('босс') ||
    normalized.includes('убить') ||
    normalized.includes('побед') ||
    normalized.includes('trial') ||
    normalized.includes('испытан');
  const isSkip =
    normalized.includes('скип') ||
    normalized.includes('не задерж') ||
    normalized.includes('не чист') ||
    normalized.includes('опционально');

  if (isReward) {
    return ' is-reward';
  }

  if (isBoss) {
    return ' is-boss';
  }

  if (isSkip) {
    return ' is-optional';
  }

  return '';
}

interface LiveRunTimeTextProps {
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  componentName: string;
  overlayMode?: string | null;
  zoneName?: string | null;
  act?: number | null;
}

const LiveRunTimeText = memo(function LiveRunTimeText({
  runTimer,
  settings,
  snapshotNowMs,
  componentName,
  overlayMode,
  zoneName,
  act
}: LiveRunTimeTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const formatTimerText = useCallback(
    (liveRunTimer: LiveRunTimerState): LiveRunTimerTextFrame => {
      const liveTimer = liveRunTimer.runTimer ?? runTimer;
      const displayedElapsedMs =
        liveTimer.status === 'armed' && liveRunTimer.countdownMs !== null
          ? liveRunTimer.countdownMs
          : liveRunTimer.runElapsedMs;

      return {
        text: formatDuration(displayedElapsedMs),
        displayedElapsedMs
      };
    },
    [runTimer]
  );

  useLiveRunTimerText(
    textRef,
    runTimer,
    settings,
    snapshotNowMs,
    formatTimerText,
    32,
    {
      overlayMode: overlayMode ?? null,
      zoneName: zoneName ?? null,
      act,
      component: componentName
    }
  );

  return <span ref={textRef}>{formatTimerText({
    nowMs: snapshotNowMs ?? Date.now(),
    runTimer,
    runElapsedMs: getRunElapsedMs(runTimer, snapshotNowMs ?? Date.now()),
    countdownMs: null
  }).text}</span>;
});

interface LiveActTimeTextProps {
  runTimer: RunTimerState;
  currentAct: number | null;
  snapshotNowMs: number | null | undefined;
  componentName: string;
  overlayMode?: string | null;
  zoneName?: string | null;
}

const LiveActTimeText = memo(function LiveActTimeText({
  runTimer,
  currentAct,
  snapshotNowMs,
  componentName,
  overlayMode,
  zoneName
}: LiveActTimeTextProps) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const formatActText = useCallback(
    (liveRunTimer: LiveRunTimerState): LiveRunTimerTextFrame => {
      if (currentAct === null) {
        return {
          text: null,
          displayedElapsedMs: null
        };
      }

      const liveTimer = liveRunTimer.runTimer ?? runTimer;
      const actElapsedMs = getCurrentActElapsedMsForAct(
        liveTimer,
        currentAct,
        liveRunTimer.nowMs
      );

      return {
        text: actElapsedMs === null ? '' : formatDuration(actElapsedMs),
        displayedElapsedMs: actElapsedMs
      };
    },
    [currentAct, runTimer]
  );

  useLiveRunTimerText(
    textRef,
    runTimer,
    null,
    snapshotNowMs,
    formatActText,
    32,
    {
      overlayMode: overlayMode ?? null,
      zoneName: zoneName ?? null,
      act: currentAct,
      component: componentName
    }
  );

  if (currentAct === null) {
    return null;
  }

  return <span ref={textRef}>{formatActText({
    nowMs: snapshotNowMs ?? Date.now(),
    runTimer,
    runElapsedMs: getRunElapsedMs(runTimer, snapshotNowMs ?? Date.now()),
    countdownMs: null
  }).text}</span>;
});

interface LiveTimerMetaProps {
  language: AppLanguage;
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  overlayMode: string | null | undefined;
  zoneName?: string | null;
  currentAct: number | null;
  currentActLabel: string | null;
  currentLevel: number | null;
  recommendedLabel: string;
  statusLabel: string;
}

const TIMER_META_TOTAL_TOKEN = '__POE2_TIMER_TOTAL__';
const TIMER_META_ACT_PART_TOKEN = '__POE2_TIMER_ACT_PART__';

function renderTimerMetaTemplate(
  template: string,
  replacements: Array<{ token: string; node: ReactNode }>
) {
  let parts: ReactNode[] = [template];

  for (const replacement of replacements) {
    const nextParts: ReactNode[] = [];

    for (const part of parts) {
      if (typeof part !== 'string') {
        nextParts.push(part);
        continue;
      }

      const segments = part.split(replacement.token);
      segments.forEach((segment, index) => {
        if (segment) {
          nextParts.push(segment);
        }

        if (index < segments.length - 1) {
          nextParts.push(replacement.node);
        }
      });
    }

    parts = nextParts;
  }

  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

const LiveTimerMeta = memo(function LiveTimerMeta({
  language,
  runTimer,
  settings,
  snapshotNowMs,
  overlayMode,
  zoneName,
  currentAct,
  currentActLabel,
  currentLevel,
  recommendedLabel,
  statusLabel
}: LiveTimerMetaProps) {
  const levelPart = `${translate(language, 'common.level')} ${currentLevel ?? '?'} · ${translate(language, 'common.recommended')}: ${recommendedLabel} · ${statusLabel}`;
  const hasActTime =
    currentAct !== null &&
    getCurrentActElapsedMsForAct(
      runTimer,
      currentAct,
      snapshotNowMs ?? Date.now()
    ) !== null;
  const totalNode = (
    <LiveRunTimeText
      runTimer={runTimer}
      settings={settings}
      snapshotNowMs={snapshotNowMs}
      componentName="overlay-run-time-text"
      overlayMode={overlayMode}
      zoneName={zoneName}
      act={currentAct}
    />
  );
  const actPartNode = hasActTime ? (
    <>
      {' · '}
      {currentActLabel ?? translate(language, 'route.interludes')}
      {' '}
      <LiveActTimeText
        runTimer={runTimer}
        currentAct={currentAct}
        snapshotNowMs={snapshotNowMs}
        componentName="overlay-act-time-text"
        overlayMode={overlayMode}
        zoneName={zoneName}
      />
    </>
  ) : null;

  if (runTimer.status === 'armed') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerStartIn', {
            duration: TIMER_META_TOTAL_TOKEN
          }),
          [{ token: TIMER_META_TOTAL_TOKEN, node: totalNode }]
        )}
      </>
    );
  }

  if (runTimer.status === 'paused') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerPaused', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  if (runTimer.status === 'finished') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerFinished', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  if (runTimer.status === 'running') {
    return (
      <>
        {renderTimerMetaTemplate(
          translate(language, 'overlay.timerRunning', {
            total: TIMER_META_TOTAL_TOKEN,
            actPart: actPartNode ? TIMER_META_ACT_PART_TOKEN : '',
            levelPart
          }),
          [
            { token: TIMER_META_TOTAL_TOKEN, node: totalNode },
            { token: TIMER_META_ACT_PART_TOKEN, node: actPartNode ?? null }
          ]
        )}
      </>
    );
  }

  return translate(language, 'overlay.timerIdle', {
    levelPart
  });
});

const DEFAULT_OVERLAY_MINIMUM_SIZE = getOverlayMinimumSize('full', 'normal', 90);
const OVERLAY_MODE_ENTER_MS = 240;

type OverlayVisualMode = 'full' | 'compact' | 'collapsed' | 'timer-only';
type OverlayModeTransitionPhase = 'enter';

type OverlayModeTransitionState = {
  from: OverlayVisualMode;
  to: OverlayVisualMode;
  phase: OverlayModeTransitionPhase;
};

function getRendererViewportWidth(): number {
  return Math.round(
    document.documentElement.clientWidth || window.innerWidth || DEFAULT_OVERLAY_MINIMUM_SIZE.width
  );
}

function getRendererViewportHeight(): number {
  return Math.round(
    document.documentElement.clientHeight || window.innerHeight || DEFAULT_OVERLAY_MINIMUM_SIZE.height
  );
}

export function OverlayPage() {
  const snapshot = useAppSnapshot({ initialSnapshot: 'overlay' });
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const syncedRunTimer = useRunTimerState(snapshot?.config.runTimer);
  const resizeStateRef = useRef<{
    startX: number;
    startWidth: number;
    frame: number | null;
  } | null>(null);
  const overlayDragStateRef = useRef<{
    startMouseScreenX: number;
    startMouseScreenY: number;
    latestMouseScreenX: number;
    latestMouseScreenY: number;
    startWindowX: number | null;
    startWindowY: number | null;
    frame: number | null;
  } | null>(null);
  const overlayModeTransitionTimersRef = useRef<number[]>([]);
  const overlayMovementLockedRef = useRef(false);
  const overlayPageRef = useRef<HTMLElement | null>(null);
  const overlayShellRef = useRef<HTMLElement | null>(null);
  const autoResizeFrameRef = useRef<OverlayRenderTask | null>(null);
  const lastAdaptiveOverlayHeightRequestRef = useRef<{ height: number; allowBelowMinimum: boolean } | null>(null);
  const lastAdaptiveOverlaySuspensionSyncAtRef = useRef(0);
  const adaptiveOverlayHeightSuspendedUntilRef = useRef(0);
  const overlayRenderCountRef = useRef(0);
  const [isOverlayCollapsed, setIsOverlayCollapsed] = useState(false);
  const [overlayModeTransition, setOverlayModeTransition] = useState<OverlayModeTransitionState | null>(null);
  const [dismissedEndgameNoticeAt, setDismissedEndgameNoticeAt] = useState<string | null>(null);
  overlayRenderCountRef.current += 1;
  const isTimerOnlySnapshot = snapshot?.runtime.overlayMode === 'timer_only';
  const autoResizeMinimumHeight = snapshot
    ? isOverlayCollapsed && !isTimerOnlySnapshot
      ? snapshot.config.overlayDensity === 'compact'
        ? 52
        : 56
      : getOverlayMinimumSize(
          snapshot.runtime.overlayMode,
          snapshot.config.overlayDensity,
          snapshot.config.overlayScale
        ).height
    : DEFAULT_OVERLAY_MINIMUM_SIZE.height;

  useEffect(() => {
    overlayMovementLockedRef.current = Boolean(snapshot?.config.overlayMovementLocked);
  }, [snapshot?.config.overlayMovementLocked]);

  useEffect(() => {
    if (snapshot?.runtime.overlayMode === 'timer_only' && isOverlayCollapsed) {
      setIsOverlayCollapsed(false);
    }
  }, [isOverlayCollapsed, snapshot?.runtime.overlayMode]);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    let previousCount = overlayRenderCountRef.current;
    const intervalId = window.setInterval(() => {
      const currentCount = overlayRenderCountRef.current;
      reportOverlayRenderDiagnostics({
        event: 'overlay-render-frequency',
        source: 'renderer.overlay',
        component: 'OverlayPage',
        renderCommitCount: currentCount - previousCount,
        lastRenderCommittedAtMs: Date.now(),
        note: 'dev-overlay-render-frequency-10s',
        documentHidden: document.hidden,
        visibilityState: document.visibilityState
      });
      previousCount = currentCount;
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const isAdaptiveOverlayHeightSuspended = useCallback(() => (
    Date.now() < adaptiveOverlayHeightSuspendedUntilRef.current
  ), []);

  const suspendAdaptiveOverlayHeight = useCallback((durationMs = 900) => {
    const now = Date.now();
    adaptiveOverlayHeightSuspendedUntilRef.current = Math.max(
      adaptiveOverlayHeightSuspendedUntilRef.current,
      now + durationMs
    );
    if (now - lastAdaptiveOverlaySuspensionSyncAtRef.current > 500) {
      lastAdaptiveOverlaySuspensionSyncAtRef.current = now;
      void window.poe2Overlay?.setOverlayAutoResizeSuspended(true);
    }
  }, []);

  const releaseAdaptiveOverlayHeightSuspension = useCallback((durationMs = 500) => {
    const now = Date.now();
    adaptiveOverlayHeightSuspendedUntilRef.current = Math.max(
      adaptiveOverlayHeightSuspendedUntilRef.current,
      now + durationMs
    );
    lastAdaptiveOverlaySuspensionSyncAtRef.current = now;
    void window.poe2Overlay?.setOverlayAutoResizeSuspended(false);
  }, []);

  const clearOverlayModeTransitionTimers = useCallback(() => {
    overlayModeTransitionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    overlayModeTransitionTimersRef.current = [];
  }, []);

  useEffect(() => () => {
    clearOverlayModeTransitionTimers();
  }, [clearOverlayModeTransitionTimers]);

  const scheduleAdaptiveOverlayHeight = useCallback((options?: {
    allowDuringManualResize?: boolean;
    force?: boolean;
    allowBelowMinimum?: boolean;
  }) => {
    const allowDuringManualResize = Boolean(options?.allowDuringManualResize);
    const force = Boolean(options?.force);
    const allowBelowMinimum = Boolean(options?.allowBelowMinimum ?? isOverlayCollapsed);

    if (autoResizeFrameRef.current !== null) {
      autoResizeFrameRef.current.cancel();
    }

    autoResizeFrameRef.current = scheduleOverlayRenderCommit({
      source: 'adaptive-overlay-height',
      fallbackMs: 16,
      commit: () => {
        autoResizeFrameRef.current = null;

      const page = overlayPageRef.current;
      const shell = overlayShellRef.current;
      const api = window.poe2Overlay;

      if (
        !page ||
        !shell ||
        !api ||
        overlayDragStateRef.current ||
        (!force && isAdaptiveOverlayHeightSuspended()) ||
        (resizeStateRef.current && !allowDuringManualResize)
      ) {
        return;
      }

      const pageStyle = window.getComputedStyle(page);
      const shellStyle = window.getComputedStyle(shell);
      const dragStrip = page.querySelector<HTMLElement>('.window-drag-strip');
      const pagePaddingY =
        (Number.parseFloat(pageStyle.paddingTop) || 0) +
        (Number.parseFloat(pageStyle.paddingBottom) || 0);
      const shellPaddingBottom = Number.parseFloat(shellStyle.paddingBottom) || 0;
      const shellBorderY =
        (Number.parseFloat(shellStyle.borderTopWidth) || 0) +
        (Number.parseFloat(shellStyle.borderBottomWidth) || 0);
      const contentBottom = Array.from(shell.children).reduce((max, child) => {
        if (!(child instanceof HTMLElement) || child.classList.contains('resize-grip')) {
          return max;
        }

        return Math.max(max, child.offsetTop + child.offsetHeight);
      }, 0);
      const dragStripHeight = dragStrip?.getBoundingClientRect().height ?? 0;
      const contentHeight = Math.max(shell.scrollHeight, contentBottom + shellPaddingBottom);
      const desiredHeight = Math.ceil(
        pagePaddingY +
          dragStripHeight +
          contentHeight +
          shellBorderY +
          2
      );
      const nextHeight = Math.max(autoResizeMinimumHeight, desiredHeight);
      const currentHeight = getRendererViewportHeight();

      if (!force && Math.abs(currentHeight - nextHeight) < 8) {
        return;
      }

      const lastRequest = lastAdaptiveOverlayHeightRequestRef.current;
      if (
        !force &&
        lastRequest?.height === nextHeight &&
        lastRequest.allowBelowMinimum === allowBelowMinimum
      ) {
        return;
      }
      lastAdaptiveOverlayHeightRequestRef.current = { height: nextHeight, allowBelowMinimum };

      // Keep width as the main-process source of truth so adaptive height never widens
      // the overlay while the user is only moving it.
      void api.resizeOverlayHeight(nextHeight, { force, allowBelowMinimum });
      }
    });
  }, [autoResizeMinimumHeight, isAdaptiveOverlayHeightSuspended, isOverlayCollapsed]);

  useEffect(() => {
    let firstFrame: number | null = null;
    let secondFrame: number | null = null;
    const timers: number[] = [];
    const resizeForCurrentCollapseState = () => {
      scheduleAdaptiveOverlayHeight({
        force: true,
        allowBelowMinimum: isOverlayCollapsed
      });
    };

    firstFrame = window.requestAnimationFrame(() => {
      resizeForCurrentCollapseState();
      secondFrame = window.requestAnimationFrame(resizeForCurrentCollapseState);
    });

    timers.push(window.setTimeout(resizeForCurrentCollapseState, 90));
    timers.push(window.setTimeout(resizeForCurrentCollapseState, 220));

    return () => {
      if (firstFrame !== null) {
        window.cancelAnimationFrame(firstFrame);
      }

      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }

      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isOverlayCollapsed, scheduleAdaptiveOverlayHeight]);

  useEffect(() => {
    const page = overlayPageRef.current;
    const shell = overlayShellRef.current;

    if (!page || !shell) {
      return;
    }

    const observer = new ResizeObserver(() => {
      scheduleAdaptiveOverlayHeight();
    });

    observer.observe(shell);
    observer.observe(page);
    scheduleAdaptiveOverlayHeight();
    window.addEventListener('resize', scheduleAdaptiveOverlayHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleAdaptiveOverlayHeight);

      if (autoResizeFrameRef.current !== null) {
        autoResizeFrameRef.current.cancel();
        autoResizeFrameRef.current = null;
      }
    };
  }, [
    scheduleAdaptiveOverlayHeight,
    snapshot?.runtime.overlayMode,
    snapshot?.currentGuideEntry?.id,
    snapshot?.currentGuideEntry?.checklist?.length,
    snapshot?.config.overlayScale,
    snapshot?.config.overlayTextSize,
    snapshot?.config.overlayDensity,
    snapshot?.config.overlayVisibleSections.nearby,
    snapshot?.config.overlayVisibleSections.zoneInfo,
    snapshot?.config.overlayVisibleSections.zoneBonuses,
    snapshot?.config.overlayVisibleSections.league,
    snapshot?.config.overlayVisibleSections.next,
    snapshot?.config.overlayVisibleSections.skip,
    snapshot?.config.overlayVisibleSections.speedrun,
    snapshot?.config.overlayVisibleSections.important,
    isOverlayCollapsed,
    snapshot?.config.mainOverlaySettings.showOverlaySkip,
    snapshot?.config.mainOverlaySettings.showOverlayCriticalImportant,
    snapshot?.config.mainOverlaySettings.showOverlayBossTip,
    snapshot?.config.mainOverlaySettings.showOverlayVendorReminder,
    snapshot?.config.mainOverlaySettings.showOverlayXpStatus,
    snapshot?.config.mainOverlaySettings.showOverlayPowerSpike,
    snapshot?.runtime.endgameT15CompletionNotice?.completedAt
  ]);

  const beginOverlayDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const api = window.poe2Overlay;

    if (
      overlayMovementLockedRef.current ||
      !api?.getOverlayBounds ||
      !api?.setOverlayPosition ||
      !shouldStartOverlayDrag(event.target, {
        button: event.button
      })
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    suspendAdaptiveOverlayHeight(1200);
    void api.setOverlayDragActive?.(true);

    const dragElement = event.currentTarget;
    const pointerId = event.pointerId;

    try {
      dragElement.setPointerCapture(pointerId);
    } catch {
      // Pointer capture is a best-effort helper; window-level listeners below are the fallback.
    }

    overlayDragStateRef.current = {
      startMouseScreenX: event.screenX,
      startMouseScreenY: event.screenY,
      latestMouseScreenX: event.screenX,
      latestMouseScreenY: event.screenY,
      startWindowX: null,
      startWindowY: null,
      frame: null
    };

    const flushAbsoluteMove = () => {
      const state = overlayDragStateRef.current;
      if (!state || state.startWindowX === null || state.startWindowY === null) {
        return;
      }

      state.frame = null;
      const nextX = state.startWindowX + (state.latestMouseScreenX - state.startMouseScreenX);
      const nextY = state.startWindowY + (state.latestMouseScreenY - state.startMouseScreenY);
      suspendAdaptiveOverlayHeight(1200);
      void api.setOverlayPosition(nextX, nextY);
    };

    const scheduleMove = () => {
      const state = overlayDragStateRef.current;
      if (
        !state ||
        state.frame !== null ||
        state.startWindowX === null ||
        state.startWindowY === null
      ) {
        return;
      }

      state.frame = window.requestAnimationFrame(flushAbsoluteMove);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = overlayDragStateRef.current;
      if (!state) {
        return;
      }

      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      if (
        moveEvent.screenX === state.latestMouseScreenX &&
        moveEvent.screenY === state.latestMouseScreenY
      ) {
        return;
      }

      suspendAdaptiveOverlayHeight(1200);
      state.latestMouseScreenX = moveEvent.screenX;
      state.latestMouseScreenY = moveEvent.screenY;
      scheduleMove();
    };

    const stopOverlayDrag = () => {
      const state = overlayDragStateRef.current;

      if (state?.frame !== null) {
        window.cancelAnimationFrame(state.frame);
        flushAbsoluteMove();
      }

      try {
        dragElement.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released if the window lost pointer focus.
      }

      overlayDragStateRef.current = null;
      void api.setOverlayDragActive?.(false);
      releaseAdaptiveOverlayHeightSuspension(500);
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', stopOverlayDrag, true);
      window.removeEventListener('pointercancel', stopOverlayDrag, true);
      window.removeEventListener('blur', stopOverlayDrag, true);
      document.body.classList.remove('overlay-window-dragging');
    };

    document.body.classList.add('overlay-window-dragging');
    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', stopOverlayDrag, true);
    window.addEventListener('pointercancel', stopOverlayDrag, true);
    window.addEventListener('blur', stopOverlayDrag, true);
    void api.getOverlayBounds()
      .then((bounds) => {
        const state = overlayDragStateRef.current;

        if (!state) {
          return;
        }

        if (!bounds) {
          stopOverlayDrag();
          return;
        }

        state.startWindowX = bounds.x;
        state.startWindowY = bounds.y;
        scheduleMove();
      })
      .catch(() => {
        stopOverlayDrag();
      });
  }, [releaseAdaptiveOverlayHeightSuspension, suspendAdaptiveOverlayHeight]);

  const overlayDerived = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    const { config, currentGuideEntry, currentZone, runtime } = snapshot;
    const guide = currentGuideEntry;
    const guideView = getGuideView(guide, language);
    const guideChecklist = (guideView?.checklist ?? []).filter((item) => item.displayInOverlay !== false);
    const sceneName = getSceneDisplayName(snapshot, language);
    const levelState = getLevelState(snapshot);
    const currentActTimerAct =
      typeof currentZone.actHint === 'number'
        ? currentZone.actHint
        : guide && typeof guide.act === 'number'
          ? guide.act
          : runtime.lastGameplayAct ?? null;
    const currentActTimerLabel =
      currentActTimerAct !== null
        ? formatActTitle(currentActTimerAct, language)
        : guide?.act === 'interlude' || currentZone.actHint === 'interlude'
          ? translate(language, 'route.interludes')
          : null;
    const importantLines = getImportantOverlayLines(snapshot, language);
    const zoneBonusItems = getCurrentZoneCampaignBonuses(snapshot);
    const leagueRewardItem = getCurrentZoneLeagueReward(snapshot, sceneName);
    const upcomingOverlayReminders = getOverlayUpcomingReminders(snapshot, language);
    const visibleSections = config.overlayVisibleSections;
    const skipLines =
      visibleSections.skip && guide
        ? (guideView?.skip ?? []).slice(0, 3)
        : [];
    const speedrunLines = visibleSections.speedrun ? getOverlaySpeedrunLines(guide, language) : [];
    const actTitle = formatActTitle(currentZone.actHint ?? guide?.act ?? null, language);
    const overlayTitle = guide ? `${actTitle} · ${sceneName}` : sceneName;
    const overlayActLabel = guide
      ? actTitle
      : currentZone.actHint
        ? formatActTitle(currentZone.actHint, language)
        : translate(language, 'overlay.currentZoneFallback');

    return {
      guide,
      guideView,
      guideChecklist,
      levelState,
      currentActTimerAct,
      currentActTimerLabel,
      importantLines,
      zoneBonusItems,
      leagueRewardItem,
      upcomingOverlayReminders,
      visibleSections,
      skipLines,
      speedrunLines,
      overlayTitle,
      overlayZoneName: sceneName,
      overlayActLabel
    };
  }, [snapshot, language]);

  useDocumentTitle(t('titles.overlay'));

  if (!snapshot || !overlayDerived) {
    return <div className="overlay-shell loading-shell">{t('common.loading')}</div>;
  }

  const { config, currentZone, runtime } = snapshot;
  const displayRunTimer = syncedRunTimer ?? config.runTimer;
  const endgameT15CompletionNotice = runtime.endgameT15CompletionNotice;
  const showEndgameT15CompletionNotice = Boolean(endgameT15CompletionNotice) &&
    dismissedEndgameNoticeAt !== endgameT15CompletionNotice?.completedAt &&
    displayRunTimer.status === 'finished';
  const endgameT15CompletionDuration = formatDuration(
    endgameT15CompletionNotice?.totalElapsedMs ?? config.lastRunSummary?.totalElapsedMs ?? displayRunTimer.elapsedMs
  );
  const {
    guide,
    guideView,
    guideChecklist,
    levelState,
    currentActTimerAct,
    currentActTimerLabel,
    importantLines,
    zoneBonusItems,
    leagueRewardItem,
    upcomingOverlayReminders,
    visibleSections,
    skipLines,
    speedrunLines,
    overlayTitle,
    overlayZoneName,
    overlayActLabel
  } = overlayDerived;
  const isTimerOnlyMode = runtime.overlayMode === 'timer_only';
  const isCompactOverlay = config.overlayDensity === 'compact';
  const overlayFxClass = config.overlayEffectsEnabled ? `fx-${config.visualFxIntensity}` : 'fx-off';
  const overlayThemeClass = getAppThemeClassName(config.theme);
  const overlayDebugClass = import.meta.env.DEV && config.overlayDebugLayoutEnabled ? ' debug-layout' : '';
  const overlayLockClass = config.overlayMovementLocked ? ' is-overlay-locked' : '';
  const overlayVisualMode: OverlayVisualMode = isTimerOnlyMode
    ? 'timer-only'
    : isOverlayCollapsed
      ? 'collapsed'
      : isCompactOverlay
        ? 'compact'
        : 'full';
  const overlayModeTransitionClass = overlayModeTransition
    ? ` is-overlay-mode-transitioning is-overlay-mode-${overlayModeTransition.phase} is-overlay-mode-${overlayModeTransition.phase}-from-${overlayModeTransition.from} is-overlay-mode-${overlayModeTransition.phase}-to-${overlayModeTransition.to}`
    : '';
  const visibleChecklist = isCompactOverlay ? guideChecklist.slice(0, 3) : guideChecklist;
  const hiddenChecklistCount = Math.max(0, guideChecklist.length - visibleChecklist.length);
  const hasLogConnection = runtime.logWatcherStatus === 'ready' || Boolean(runtime.watchedLogPath);
  const hasNamedUnknownZone =
    !guide &&
    Boolean(currentZone.rawZoneName) &&
    (
      currentZone.sceneKind === 'unknown' ||
      currentZone.sceneKind === 'gameplay' ||
      currentZone.sceneKind === 'town'
    );
  const shouldShowNoGuideForZone = hasLogConnection && hasNamedUnknownZone;
  const unknownZoneName =
    currentZone.rawZoneName ??
    runtime.lastSceneSource ??
    runtime.lastRawZoneName ??
    t('scene.unknownZone');
  const openCompanionHotkey = formatHotkeyLabel(config.hotkeys.openCompanion, 'F9');
  const timerOnlyShowsCountdown =
    displayRunTimer.status === 'armed' &&
    typeof config.runTimerSettings.leagueStartAt === 'number';
  const minimumSize = getOverlayMinimumSize(
    runtime.overlayMode,
    config.overlayDensity,
    config.overlayScale
  );

  const scheduleOverlayModeSettledResize = (allowBelowMinimum = false) => {
    const forceResize = () => {
      scheduleAdaptiveOverlayHeight({ force: true, allowBelowMinimum });
    };

    forceResize();
    window.requestAnimationFrame(forceResize);
    window.setTimeout(forceResize, 90);
    window.setTimeout(forceResize, 240);
  };

  const runOverlayModeTransition = (
    nextMode: OverlayVisualMode,
    commit: () => Promise<unknown> | unknown,
    options?: { allowBelowMinimum?: boolean }
  ) => {
    const allowBelowMinimum = Boolean(options?.allowBelowMinimum);
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const shouldSkipMotion = prefersReducedMotion || !config.overlayEffectsEnabled || config.visualFxIntensity === 'off';

    clearOverlayModeTransitionTimers();

    if (shouldSkipMotion) {
      void Promise.resolve(commit()).finally(() => {
        setOverlayModeTransition(null);
        scheduleOverlayModeSettledResize(allowBelowMinimum);
      });
      return;
    }

    setOverlayModeTransition({
      from: overlayVisualMode,
      to: nextMode,
      phase: 'enter'
    });
    suspendAdaptiveOverlayHeight(480);

    const commitTimer = window.setTimeout(() => {
      void Promise.resolve(commit())
        .then(() => {
          scheduleOverlayModeSettledResize(allowBelowMinimum);

          const finishTimer = window.setTimeout(() => {
            setOverlayModeTransition(null);
            releaseAdaptiveOverlayHeightSuspension(180);
            scheduleOverlayModeSettledResize(allowBelowMinimum);
          }, OVERLAY_MODE_ENTER_MS);

          overlayModeTransitionTimersRef.current.push(finishTimer);
        })
        .catch(() => {
          setOverlayModeTransition(null);
          releaseAdaptiveOverlayHeightSuspension(180);
          scheduleOverlayModeSettledResize(allowBelowMinimum);
        });
    }, 16);

    overlayModeTransitionTimersRef.current.push(commitTimer);
  };

  const toggleTimerOnlyMode = () => {
    // Mode switching stays atomic in the main process. The renderer only arms
    // the enter class before the snapshot changes so the new HUD does not flash.
    runOverlayModeTransition(
      isTimerOnlyMode ? 'full' : 'timer-only',
      () => window.poe2Overlay?.toggleOverlayMode()
    );
  };

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (overlayMovementLockedRef.current) {
      return;
    }

    resizeStateRef.current = {
      startX: event.screenX,
      startWidth: getRendererViewportWidth(),
      frame: null
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || !window.poe2Overlay) {
        return;
      }

      const nextWidth = Math.max(minimumSize.width, state.startWidth + moveEvent.screenX - state.startX);
      const currentHeight = Math.max(
        minimumSize.height,
        getRendererViewportHeight()
      );

      if (state.frame !== null) {
        cancelAnimationFrame(state.frame);
      }

      state.frame = requestAnimationFrame(() => {
        void window.poe2Overlay.resizeOverlay(nextWidth, currentHeight).then(() => {
          // Manual width resize is expected to reflow text. Let the overlay grow
          // downward to fit the new wrapped content, but keep this separate from
          // normal window dragging where size must stay locked.
          scheduleAdaptiveOverlayHeight({ allowDuringManualResize: true });
        });
      });
    };

    const stopResize = () => {
      const state = resizeStateRef.current;
      if (state?.frame !== null) {
        cancelAnimationFrame(state.frame);
      }

      resizeStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);

      window.requestAnimationFrame(() => {
        scheduleAdaptiveOverlayHeight({ allowDuringManualResize: true });
      });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const timerOnlyPrimaryLabel =
    timerOnlyShowsCountdown ? t('overlay.timerOnlyCountdownLabel') : t('companion.totalTime');
  const timerOnlyLevelText = `${t('common.level')} ${config.currentLevel ?? '?'} · ${t('common.recommended')}: ${guideView?.recommendedLevelLabel ?? t('common.notAvailable')} · ${levelState.label}`;
  const timerPrimaryIcon = displayRunTimer.status === 'running' ? '⏸' : '▶';
  const timerPrimaryTone = displayRunTimer.status === 'running' ? 'pause' : 'start';
  const timerPrimaryTitle =
    displayRunTimer.status === 'running'
      ? t('overlay.pauseTimer')
      : displayRunTimer.status === 'paused'
        ? t('overlay.resumeTimer')
        : t('overlay.startTimer');
  const handleTimerPrimaryAction = () => {
    if (displayRunTimer.status === 'running') {
      void window.poe2Overlay?.pauseRunTimer();
      return;
    }

    if (displayRunTimer.status === 'paused') {
      void window.poe2Overlay?.resumeRunTimer();
      return;
    }

    void window.poe2Overlay?.startRunTimer();
  };
  const handleCompactOverlayToggle = () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    runOverlayModeTransition(
      isCompactOverlay ? 'full' : 'compact',
      () => api.updateSettings({
        overlayDensity: isCompactOverlay ? 'normal' : 'compact'
      })
    );
  };

  const handleTimerOnlyExpand = () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    // Use the same single-path transition as the hotkey/footer toggle. The main
    // process also restores normal density when leaving timer-only mode, so this
    // avoids the old three-step sequence: resize -> density update -> mode update.
    runOverlayModeTransition('full', () => api.toggleOverlayMode());
  };

  const handleOverlayCollapsedToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    stopOverlayControlPropagation(event);
    runOverlayModeTransition(
      isOverlayCollapsed ? (isCompactOverlay ? 'compact' : 'full') : 'collapsed',
      () => setIsOverlayCollapsed((value) => !value),
      { allowBelowMinimum: !isOverlayCollapsed }
    );
  };

  const handleLanguageChange = (nextLanguage: AppLanguage) => {
    if (nextLanguage === language) {
      return;
    }

    void window.poe2Overlay?.updateSettings({
      appLanguage: nextLanguage
    });
  };

  const handleLanguageToggle = () => {
    handleLanguageChange(language === 'en' ? 'ru' : 'en');
  };
  const handleThemePreferenceChoice = (theme: AppTheme) => {
    void window.poe2Overlay?.updateSettings({
      theme,
      themePreferencePrompted: true
    });
  };

  const handleToggleSettings = () => {
    void window.poe2Overlay?.toggleSettings();
  };
  const handleToggleCompanion = () => {
    void window.poe2Overlay?.toggleCompanionPanel();
  };
  const handleCloseOverlay = (event: ReactMouseEvent<HTMLButtonElement>) => {
    stopOverlayControlPropagation(event);
    void window.poe2Overlay?.closeOverlay();
  };
  const handleOverlayMovementLockToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const api = window.poe2Overlay;
    if (!api) {
      stopOverlayControlPropagation(event);
      return;
    }

    void toggleOverlayMovementLock(event, api, config.overlayMovementLocked);
  };
  const overlayLockButtonLabel = getOverlayLockButtonLabel(config.overlayMovementLocked, language);
  const overlayLockButton = (
    <button
      className={`overlay-icon-button overlay-lock-icon-button no-drag${config.overlayMovementLocked ? ' is-locked' : ''}`}
      type="button"
      title={overlayLockButtonLabel}
      aria-label={overlayLockButtonLabel}
      aria-pressed={config.overlayMovementLocked}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
      onClick={handleOverlayMovementLockToggle}
    >
      <span className={`overlay-icon-glyph overlay-icon-glyph-lock${config.overlayMovementLocked ? ' is-locked' : ' is-unlocked'}`} aria-hidden="true">
        {getOverlayLockButtonIcon(config.overlayMovementLocked)}
      </span>
    </button>
  );
  const overlayOpenCompanionButton = (
    <button
      className="overlay-icon-button overlay-companion-icon-button no-drag"
      type="button"
      title={t('overlay.openCompanion', { hotkey: openCompanionHotkey })}
      aria-label={t('overlay.openCompanion', { hotkey: openCompanionHotkey })}
      onClick={handleToggleCompanion}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-menu" aria-hidden="true">☰</span>
    </button>
  );
  const overlayOpenSettingsButton = (
    <button
      className="overlay-icon-button overlay-settings-icon-button no-drag"
      type="button"
      title={t('overlay.openSettings')}
      aria-label={t('overlay.openSettings')}
      onClick={handleToggleSettings}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-settings" aria-hidden="true">⚙</span>
    </button>
  );
  const overlayCloseButton = (
    <button
      className="overlay-icon-button overlay-close-button no-drag"
      type="button"
      title={t('overlay.closeWindow')}
      aria-label={t('overlay.closeWindow')}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
      onClick={handleCloseOverlay}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-close" aria-hidden="true">×</span>
    </button>
  );
  const overlayCollapseButton = (
    <button
      className={`overlay-icon-button overlay-collapse-icon-button no-drag${isOverlayCollapsed ? ' is-collapsed' : ''}`}
      type="button"
      title={t(isOverlayCollapsed ? 'overlay.expandPanel' : 'overlay.collapsePanel')}
      aria-label={t(isOverlayCollapsed ? 'overlay.expandPanel' : 'overlay.collapsePanel')}
      aria-expanded={!isOverlayCollapsed}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
      onClick={handleOverlayCollapsedToggle}
    >
      <span className="overlay-icon-glyph overlay-icon-glyph-collapse" aria-hidden="true">
        {isOverlayCollapsed ? '▾' : '▴'}
      </span>
    </button>
  );
  const overlayLanguageToggle = (
    <div
      className={`overlay-language-toggle is-${language} no-drag`}
      role="group"
      aria-label={t('overlay.languageToggle')}
      data-language={language}
      onPointerDown={stopOverlayControlPropagation}
      onMouseDown={stopOverlayControlPropagation}
    >
      <button
        className="overlay-language-toggle-hitarea"
        type="button"
        title={t(language === 'ru' ? 'overlay.switchToEnglish' : 'overlay.switchToRussian')}
        aria-label={t(language === 'ru' ? 'overlay.switchToEnglish' : 'overlay.switchToRussian')}
        onClick={handleLanguageToggle}
      >
        <span className="overlay-language-toggle-indicator" aria-hidden="true" />
        <span
          className={`overlay-language-option${language === 'ru' ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          RU
        </span>
        <span
          className={`overlay-language-option${language === 'en' ? ' is-active' : ''}`}
          aria-hidden="true"
        >
          EN
        </span>
      </button>
    </div>
  );
  const timerPrimaryButton = (
    <button
      className={`overlay-timer-control overlay-timer-icon-control overlay-timer-control-${timerPrimaryTone} no-drag`}
      type="button"
      title={timerPrimaryTitle}
      aria-label={timerPrimaryTitle}
      onClick={handleTimerPrimaryAction}
    >
      <span className="timer-button-glyph" aria-hidden="true">{timerPrimaryIcon}</span>
    </button>
  );
  const overlayQuickActions = (
    <div className="overlay-quick-actions no-drag" aria-label={t('overlay.quickActions')}>
      {!isTimerOnlyMode && timerPrimaryButton}
      {overlayLanguageToggle}
      {!isTimerOnlyMode && overlayCollapseButton}
      {overlayLockButton}
      {overlayOpenCompanionButton}
      {overlayOpenSettingsButton}
      {overlayCloseButton}
    </div>
  );
  const overlayNoGuideBlock = (
    <div className="overlay-onboarding-card overlay-no-guide-card">
      <p className="overlay-onboarding-title">{t('overlay.noGuideTitle')}</p>
      <p className="overlay-onboarding-text">
        {t('overlay.noGuideText', { zone: unknownZoneName })}
      </p>
      <p className="overlay-onboarding-move-hint">{t('overlay.noGuideHint')}</p>
    </div>
  );

  const overlayOnboardingBlock = (
    <div className="overlay-onboarding-card">
      <p className="overlay-onboarding-title">{t('overlay.onboardingTitle')}</p>
      <ol className="overlay-onboarding-list">
        <li>
          <strong>{t('overlay.onboardingStep1Title')}</strong>
          <span>{t('overlay.onboardingStep1Body')}</span>
          <code className="overlay-onboarding-path">{t('overlay.onboardingPath')}</code>
        </li>
        <li>
          <strong>{t('overlay.onboardingStep2Title')}</strong>
          <span>{t('overlay.onboardingStep2Body')}</span>
        </li>
      </ol>
      <div className="overlay-onboarding-actions">
        <button
          className="overlay-timer-control overlay-timer-control-primary no-drag overlay-onboarding-button"
          type="button"
          onClick={() => { void window.poe2Overlay?.openSettings(); }}
        >
          {t('overlay.onboardingButton')}
        </button>
      </div>
      <p className="overlay-onboarding-move-hint">{t('overlay.onboardingMoveHint')}</p>
    </div>
  );
  const timerControls = (
    <div className="overlay-timer-controls no-drag" aria-label={t('overlay.timerControls')}>
      {timerPrimaryButton}
    </div>
  );
  const themePreferencePrompt = !config.themePreferencePrompted ? (
    <section className="overlay-theme-preference-card no-drag" role="dialog" aria-labelledby="overlay-theme-preference-title">
      <div>
        <h2 id="overlay-theme-preference-title">{t('overlay.themePromptTitle')}</h2>
        <p>{t('overlay.themePromptText')}</p>
      </div>
      <div className="overlay-theme-preference-actions">
        {(['classic', 'dark_fantasy'] as AppTheme[]).map((theme) => (
          <button key={theme} type="button" onClick={() => handleThemePreferenceChoice(theme)}>
            {t(theme === 'dark_fantasy' ? 'appTheme.darkFantasy' : 'appTheme.classic')}
          </button>
        ))}
      </div>
    </section>
  ) : null;

  const endgameT15CompletionBlock = showEndgameT15CompletionNotice ? (
    <section className="hud-block overlay-endgame-completion-card no-drag" role="status" aria-live="polite">
      <div className="overlay-endgame-completion-copy">
        <div className="overlay-endgame-completion-title-row">
          <span className="overlay-endgame-completion-mark" aria-hidden="true">◆</span>
          <h2>{t('overlay.endgameT15CompleteTitle')}</h2>
        </div>
        <p>{t('overlay.endgameT15CompleteMessage')}</p>
        <div className="overlay-endgame-completion-meta">
          <span>{t('overlay.endgameT15CompleteTime', { duration: endgameT15CompletionDuration })}</span>
          <span>{t('overlay.endgameT15CompleteSaved')}</span>
        </div>
      </div>
      <button
        className="overlay-icon-button overlay-endgame-completion-close no-drag"
        type="button"
        title={t('overlay.dismissEndgameNotice')}
        aria-label={t('overlay.dismissEndgameNotice')}
        onPointerDown={stopOverlayControlPropagation}
        onMouseDown={stopOverlayControlPropagation}
        onClick={() => setDismissedEndgameNoticeAt(endgameT15CompletionNotice?.completedAt ?? null)}
      >
        <span className="overlay-icon-glyph overlay-icon-glyph-close" aria-hidden="true">×</span>
      </button>
    </section>
  ) : null;

  if (isTimerOnlyMode) {
    return (
      <main
        ref={overlayPageRef}
        className={`overlay-page overlay-page-timer-only density-${config.overlayDensity} scale-${config.overlayScale} text-size-${config.overlayTextSize} ${overlayFxClass} ${overlayThemeClass}${overlayDebugClass}${overlayLockClass}${overlayModeTransitionClass}`}
      >
        <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-timer-only-card" onPointerDownCapture={beginOverlayDrag}>
          <header className="timer-only-header">
            <div className="timer-only-heading">
              <p className="timer-only-kicker">{overlayTitle}</p>
              {currentActTimerAct !== null && (
                <div className="timer-only-state-row">
                  <span className="timer-only-actline">
                    {currentActTimerLabel} ·{' '}
                    <LiveActTimeText
                      runTimer={displayRunTimer}
                      currentAct={currentActTimerAct}
                      snapshotNowMs={runtime.timerNowMs}
                      componentName="timer-only-act-time-text"
                      overlayMode={runtime.overlayMode}
                      zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
                    />
                  </span>
                </div>
              )}
            </div>
            <div className="overlay-top-control-row timer-only-top-control-row no-drag">
              {overlayQuickActions}
            </div>
          </header>
          {themePreferencePrompt}

          <section className="timer-only-main-panel" aria-label={t('overlay.mainTimer')}>
            <p className="timer-only-main-label">{timerOnlyPrimaryLabel}</p>
            <div className="timer-only-time-control-row">
              <div className="timer-only-time">
                <LiveRunTimeText
                  runTimer={displayRunTimer}
                  settings={config.runTimerSettings}
                  snapshotNowMs={runtime.timerNowMs}
                  componentName="timer-only-run-time-text"
                  overlayMode={runtime.overlayMode}
                  zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
                  act={currentActTimerAct}
                />
              </div>
              <div className="timer-only-controls-row">{timerControls}</div>
            </div>
          </section>

          <div className="timer-only-info-grid">
            <p className={`timer-only-meta level-${levelState.state}`}>{timerOnlyLevelText}</p>
            <p className="timer-only-next">
              {t('overlay.nextLabel', { zone: guideView?.nextZoneName ?? t('common.notAvailable') })}
            </p>
          </div>
          <footer className="timer-only-footer">
            <button className="timer-only-expand-button no-drag" type="button" onClick={handleTimerOnlyExpand}>
              {t('overlay.expand')}
            </button>
          </footer>


          <div
            className={getResizeGripClassName(config.overlayMovementLocked)}
            aria-label={config.overlayMovementLocked ? t('overlay.resizeLocked') : t('overlay.resize')}
            role="button"
            tabIndex={-1}
            onPointerDown={beginResize}
          />
        </section>
      </main>
    );
  }

  if (isOverlayCollapsed) {
    return (
      <main
        ref={overlayPageRef}
        className={`overlay-page is-overlay-collapsed density-${config.overlayDensity} scale-${config.overlayScale} text-size-${config.overlayTextSize} ${overlayFxClass} ${overlayThemeClass}${overlayDebugClass}${overlayLockClass}${overlayModeTransitionClass}`}
      >
        <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-main-compact overlay-collapsed-shell" onPointerDownCapture={beginOverlayDrag}>
          <header className="hud-collapsed-bar">
            <div className="hud-collapsed-main">
              <span className="hud-zone-act-pill">{overlayActLabel}</span>
              <h1 className="hud-collapsed-zone-name" title={overlayZoneName}>{overlayZoneName}</h1>
            </div>
            <div className="hud-title-actions no-drag">
              {overlayQuickActions}
            </div>
          </header>
          {themePreferencePrompt}
        </section>
      </main>
    );
  }

  return (
    <main
      ref={overlayPageRef}
      className={`overlay-page density-${config.overlayDensity} scale-${config.overlayScale} text-size-${config.overlayTextSize} ${overlayFxClass} ${overlayThemeClass}${overlayDebugClass}${overlayLockClass}${overlayModeTransitionClass}`}
    >
      <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-main-compact" onPointerDownCapture={beginOverlayDrag}>
        <header className="hud-header">
          <div className="hud-title-row">
            <div className="hud-zone-title-card">
              <div className="hud-zone-kicker-row">
                <span className="hud-zone-act-pill">{overlayActLabel}</span>
              </div>
              <h1 className="hud-zone-name">{overlayZoneName}</h1>
            </div>
            <div className="hud-title-actions no-drag">
              {overlayQuickActions}
            </div>
          </div>
          <div className="hud-header-divider" aria-hidden="true" />
          <p className={`hud-meta level-${levelState.state}`}>
            <LiveTimerMeta
              runTimer={displayRunTimer}
              settings={config.runTimerSettings}
              snapshotNowMs={runtime.timerNowMs}
              overlayMode={runtime.overlayMode}
              zoneName={guide?.zone_ru ?? currentZone.rawZoneName ?? overlayZoneName}
              language={language}
              currentAct={currentActTimerAct}
              currentActLabel={currentActTimerLabel}
              currentLevel={config.currentLevel}
              recommendedLabel={guideView?.recommendedLevelLabel ?? t('common.notAvailable')}
              statusLabel={levelState.label}
            />
          </p>
        </header>
        {themePreferencePrompt}

        {endgameT15CompletionBlock}

        {runtime.logWatcherStatus !== 'ready' && (
          <section className="hud-banner">
            <strong>{translateSystemText(runtime.logWatcherMessage, language)}</strong>
          </section>
        )}

        {visibleSections.nearby && !isCompactOverlay && upcomingOverlayReminders.length > 0 && (
          <section className="hud-block reminder-section upcoming-overlay-section">
            <div className="reminder-header-row">
              <h2>{t('overlay.nearby')}</h2>
              <span className="overlay-upcoming-range">{t('overlay.upcomingRange')}</span>
            </div>
            <ul className="overlay-upcoming-list">
              {upcomingOverlayReminders.map((entry) => (
                <li
                  key={entry.id}
                  className={`overlay-upcoming-item ${entry.level === config.currentLevel ? 'is-current-level' : ''}`}
                >
                  <div className="overlay-upcoming-line">
                    <span className="overlay-upcoming-level">{t('common.level')} {entry.level}</span>
                    <span className="overlay-upcoming-title">{entry.title}</span>
                    {entry.level === config.currentLevel && (
                      <span className="overlay-upcoming-badge">{t('overlay.currentBadge')}</span>
                    )}
                  </div>
                  {entry.items.length > 0 && (
                    <p className="overlay-upcoming-note">{entry.items.slice(0, 2).join(' · ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {visibleSections.zoneInfo && (
          <section className="hud-block checklist-section">
          <h2>{t('overlay.inThisZone')}</h2>
          {guide ? (
            guideChecklist.length > 0 ? (
              <>
                <ul className="checklist-list overlay-checklist-list">
                  {visibleChecklist.map((item) => (
                    <li key={item.id} className={`checklist-item${getChecklistItemTone(item)}`}>
                      {item.text}
                    </li>
                  ))}
                </ul>
                {hiddenChecklistCount > 0 && (
                  <p className="helper-text checklist-more-note">
                    {t('overlay.compactMore', { count: hiddenChecklistCount })}
                  </p>
                )}
              </>
            ) : (
              <p className="hud-empty">{t('overlay.emptyZoneNotes')}</p>
            )
          ) : (
            shouldShowNoGuideForZone ? overlayNoGuideBlock : overlayOnboardingBlock
          )}
          </section>
        )}

        {visibleSections.zoneBonuses && !isCompactOverlay && zoneBonusItems.length > 0 && (
          <section className="hud-block zone-bonuses-section">
            <h2>{t('overlay.zoneBonuses')}</h2>
            <ul className="section-list compact-list overlay-bonus-list">
              {zoneBonusItems.map(({ bonus, done }) => {
                const bonusView = getCampaignBonusView(bonus, language) ?? bonus;

                return (
                  <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                    <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                    <span>{'displayTitle' in bonusView ? bonusView.displayTitle : bonus.title}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {visibleSections.league && !isCompactOverlay && leagueRewardItem && (
          <section className="hud-block league-reward-section">
            <h2>{t('overlay.league')}</h2>
            <div className="league-reward-line">
              <span>{language === 'en' ? leagueRewardItem.reward_en : leagueRewardItem.reward_ru}</span>
            </div>
            {leagueRewardItem.oneTimeGuaranteed && (
              <p className="league-reward-note">{t('overlay.oneTimeLeagueReward')}</p>
            )}
          </section>
        )}

        {visibleSections.next && (
          <section className="hud-block hud-next-block">
            <h2>{t('overlay.next')}</h2>
            <p className="hud-next-zone">{guideView?.nextZoneName || t('common.notAvailable')}</p>
          </section>
        )}

        {visibleSections.skip && !isCompactOverlay && skipLines.length > 0 && (
          <section className="hud-block skip-section">
            <h2>{t('common.skip')}</h2>
            <ul className="section-list compact-list">
              {skipLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {visibleSections.speedrun && !isCompactOverlay && speedrunLines.length > 0 && (
          <section className="hud-block speedrun-section">
            <h2>{t('overlay.speedrun')}</h2>
            <ul className="section-list compact-list">
              {speedrunLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {visibleSections.important && !isCompactOverlay && importantLines.length > 0 && (
          <section className="hud-block info-section">
            <h2>{t('common.important')}</h2>
            <ul className="section-list compact-list">
              {importantLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="hud-footer-row">
          <div className="hud-footer-actions">
            <button className="timer-only-collapse-button compact-mode-button no-drag" type="button" onClick={handleCompactOverlayToggle}>
              {isCompactOverlay ? t('overlay.expand') : t('overlay.compact')}
            </button>
            <button className="timer-only-collapse-button no-drag" type="button" onClick={toggleTimerOnlyMode}>
              {t('overlay.timerOnly')}
            </button>
          </div>
        </div>

        <div
            className={getResizeGripClassName(config.overlayMovementLocked)}
            aria-label={config.overlayMovementLocked ? t('overlay.resizeLocked') : t('overlay.resize')}
            role="button"
            tabIndex={-1}
            onPointerDown={beginResize}
          />
      </section>
    </main>
  );
}
