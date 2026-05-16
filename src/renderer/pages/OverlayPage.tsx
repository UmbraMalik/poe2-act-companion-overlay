import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  useAppSnapshot,
  useLiveRunTimerDisplay,
  useRunTimerState
} from '../hooks';
import {
  getCurrentActElapsedMs,
  getNearestPowerSpike,
  getRunElapsedMs,
  getSceneDisplayName,
  getXpStatus
} from '../companion-helpers';
import { formatDuration, getLevelState } from '../utils';
import { getOverlayMinimumSize } from '../../shared/overlay-layout';
import leagueMechanicRewardsData from '../../data/league-mechanic-rewards.json';
import type {
  GuideEntry,
  GuideProfile,
  LevelReminder,
  PowerSpike,
  RunTimerSettings,
  RunTimerState,
  ZoneAct
} from '../../shared/types';

function formatActTitle(act: ZoneAct | null): string {
  if (act === null) {
    return 'ТЕКУЩАЯ ЗОНА';
  }

  return act === 'interlude' ? 'ИНТЕРЛЮДИИ' : `АКТ ${act}`;
}

function formatHotkeyLabel(value: string | null | undefined, fallback: string): string {
  const label = (value ?? fallback).trim();
  return label.length > 0 ? label : fallback;
}

function getTimerLeadText(
  runTimer: RunTimerState,
  now: number,
  countdownMs: number | null,
  actElapsedMs: number | null,
  currentActLabel: string | null,
  currentLevel: number | null,
  recommendedLabel: string,
  statusLabel: string
): string {
  if (runTimer.status === 'armed' && countdownMs !== null) {
    return `⏳ Старт через ${formatDuration(countdownMs)}`;
  }

  const total = formatDuration(getRunElapsedMs(runTimer, now));
  const actPart = actElapsedMs === null ? null : `${currentActLabel ?? 'Акт'} ${formatDuration(actElapsedMs)}`;
  const levelPart = `Ур: ${currentLevel ?? '?'} · Рек: ${recommendedLabel} · ${statusLabel}`;

  if (runTimer.status === 'paused') {
    return `⏸ ${total}${actPart ? ` · ${actPart}` : ''} · ПАУЗА · ${levelPart}`;
  }

  if (runTimer.status === 'finished') {
    return `⏱ ${total} · ФИНИШ${actPart ? ` · ${actPart}` : ''} · ${levelPart}`;
  }

  if (runTimer.status === 'running') {
    return `⏱ ${total}${actPart ? ` · ${actPart}` : ''} · ${levelPart}`;
  }

  return `⏱ 00:00 · ${levelPart}`;
}

function formatTimerOnlyRunStatus(runTimer: RunTimerState): string {
  if (runTimer.status === 'armed') {
    return 'ОЖИДАЕТ СТАРТ';
  }

  if (runTimer.status === 'paused') {
    return 'ПАУЗА';
  }

  if (runTimer.status === 'finished') {
    return 'ФИНИШ';
  }

  if (runTimer.status === 'running') {
    return 'ТАЙМЕР АКТИВЕН';
  }

  return 'ГОТОВ К СТАРТУ';
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

function supportsActiveProfile(entry: PowerSpike, activeProfile: GuideProfile): boolean {
  return !entry.profiles || entry.profiles.length === 0 || entry.profiles.includes(activeProfile);
}

function getOverlayUpcomingReminders(
  snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>,
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
      title: entry.title,
      items: entry.items,
      source: 'vendor'
    })
  );

  const powerSpikes: OverlayUpcomingReminder[] = snapshot.powerSpikes
    .filter((entry) => supportsActiveProfile(entry, snapshot.config.guideProfile))
    .map((entry) => ({
      id: `power-${entry.id}`,
      level: entry.level,
      title: entry.title,
      items: entry.items,
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

      return left.title.localeCompare(right.title, 'ru');
    })
    .filter((entry) => {
      const key = `${entry.level}-${entry.title.toLocaleLowerCase('ru')}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function getImportantOverlayLines(snapshot: NonNullable<ReturnType<typeof useAppSnapshot>>) {
  const guide = snapshot.currentGuideEntry;
  if (!guide) {
    return [];
  }

  const nearestPowerSpike = getNearestPowerSpike(
    snapshot.powerSpikes,
    snapshot.config.currentLevel,
    snapshot.config.guideProfile
  );
  const xpStatus = getXpStatus(snapshot);
  const lines: string[] = [];

  if (snapshot.config.mainOverlaySettings.showOverlayCriticalImportant) {
    lines.push(...guide.important);
  }

  if (snapshot.config.mainOverlaySettings.showOverlayBossTip) {
    lines.push(...(guide.boss_tips ?? []));
  }

  if (
    snapshot.config.mainOverlaySettings.showOverlayXpStatus &&
    (xpStatus.variant === 'low' || xpStatus.variant === 'farm')
  ) {
    lines.push(xpStatus.longLabel);
  }

  if (snapshot.config.mainOverlaySettings.showOverlayPowerSpike && nearestPowerSpike) {
    lines.push(`Скачок силы: ур. ${nearestPowerSpike.level} · ${nearestPowerSpike.title}`);
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
      if (!reward.displayInOverlay || !reward.hasReward || reward.duplicateInCurrentGuide) {
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
    guideId === 'interlude_golye_gates' ||
    zoneRu === 'ворота галаи' ||
    zoneRu === 'врата голай' ||
    zoneEn === 'the galai gates' ||
    zoneEn === 'golye gates' ||
    raw === 'ворота галаи' ||
    raw === 'врата голай' ||
    raw === 'the galai gates' ||
    raw === 'golye gates'
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
    (id.includes('golye_gates') && (isLifeBonus || isWeaponBonus) && mentionsKhariSource) ||
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

function getDetailLines(guide: GuideEntry | null, key: string): string[] {
  const details = guide?.details;

  if (!details || Array.isArray(details) || typeof details !== 'object') {
    return [];
  }

  const value = (details as Record<string, unknown>)[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getOverlaySpeedrunLines(guide: GuideEntry | null): string[] {
  const groups: Array<[string, string]> = [
    ['checkpoint', 'Чекпоинт'],
    ['town_plan', 'Город'],
    ['navigation', 'Навигация'],
    ['time_saves', 'Скип времени'],
    ['opportunistic', 'По пути'],
    ['xp_strategy', 'XP'],
    ['craft_plan', 'Крафт']
  ];

  return groups
    .flatMap(([key, label]) =>
      getDetailLines(guide, key)
        .slice(0, 1)
        .map((line) => `${label}: ${line}`)
    )
    .slice(0, 3);
}

interface LiveRunTimeTextProps {
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  overlayMode?: string | null;
}

const LiveRunTimeText = memo(function LiveRunTimeText({
  runTimer,
  settings,
  snapshotNowMs,
  overlayMode
}: LiveRunTimeTextProps) {
  const liveRunTimer = useLiveRunTimerDisplay(
    runTimer,
    settings,
    snapshotNowMs,
    32,
    overlayMode ? { overlayMode } : undefined
  );
  const displayMs =
    runTimer.status === 'armed' && liveRunTimer.countdownMs !== null
      ? liveRunTimer.countdownMs
      : liveRunTimer.runElapsedMs;

  return <>{formatDuration(displayMs)}</>;
});

interface LiveActTimeTextProps {
  runTimer: RunTimerState;
  guide: GuideEntry | null;
  snapshotNowMs: number | null | undefined;
}

const LiveActTimeText = memo(function LiveActTimeText({
  runTimer,
  guide,
  snapshotNowMs
}: LiveActTimeTextProps) {
  const liveRunTimer = useLiveRunTimerDisplay(runTimer, null, snapshotNowMs, 32);
  const actElapsedMs = getCurrentActElapsedMs(runTimer, guide, liveRunTimer.nowMs);

  if (actElapsedMs === null) {
    return null;
  }

  return <>{formatDuration(actElapsedMs)}</>;
});

interface LiveTimerMetaProps {
  runTimer: RunTimerState;
  settings: RunTimerSettings | null | undefined;
  snapshotNowMs: number | null | undefined;
  overlayMode: string | null | undefined;
  guide: GuideEntry | null;
  currentActLabel: string | null;
  currentLevel: number | null;
  recommendedLabel: string;
  statusLabel: string;
}

const LiveTimerMeta = memo(function LiveTimerMeta({
  runTimer,
  settings,
  snapshotNowMs,
  overlayMode,
  guide,
  currentActLabel,
  currentLevel,
  recommendedLabel,
  statusLabel
}: LiveTimerMetaProps) {
  const liveRunTimer = useLiveRunTimerDisplay(
    runTimer,
    settings,
    snapshotNowMs,
    32,
    { overlayMode }
  );
  const actElapsedMs = getCurrentActElapsedMs(runTimer, guide, liveRunTimer.nowMs);

  return (
    <>
      {getTimerLeadText(
        runTimer,
        liveRunTimer.nowMs,
        liveRunTimer.countdownMs,
        actElapsedMs,
        currentActLabel,
        currentLevel,
        recommendedLabel,
        statusLabel
      )}
    </>
  );
});

const DEFAULT_OVERLAY_MINIMUM_SIZE = getOverlayMinimumSize('full', 'normal', 90);

export function OverlayPage() {
  const snapshot = useAppSnapshot();
  const syncedRunTimer = useRunTimerState(snapshot?.config.runTimer);
  const resizeStateRef = useRef<{
    startX: number;
    startWidth: number;
    frame: number | null;
  } | null>(null);
  const overlayPageRef = useRef<HTMLElement | null>(null);
  const overlayShellRef = useRef<HTMLElement | null>(null);
  const autoResizeFrameRef = useRef<number | null>(null);
  const autoResizeMinimumHeight = snapshot
    ? getOverlayMinimumSize(
        snapshot.runtime.overlayMode,
        snapshot.config.overlayDensity,
        snapshot.config.overlayScale
      ).height
    : DEFAULT_OVERLAY_MINIMUM_SIZE.height;

  const scheduleAdaptiveOverlayHeight = useCallback(() => {
    if (autoResizeFrameRef.current !== null) {
      cancelAnimationFrame(autoResizeFrameRef.current);
    }

    autoResizeFrameRef.current = requestAnimationFrame(() => {
      autoResizeFrameRef.current = null;

      const page = overlayPageRef.current;
      const shell = overlayShellRef.current;
      const api = window.poe2Overlay;

      if (!page || !shell || !api) {
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
      const desiredHeight = Math.ceil(
        pagePaddingY +
          dragStripHeight +
          contentBottom +
          shellPaddingBottom +
          shellBorderY +
          2
      );
      const nextHeight = Math.max(autoResizeMinimumHeight, desiredHeight);
      const currentHeight = Math.round(window.outerHeight || document.documentElement.clientHeight);

      if (Math.abs(currentHeight - nextHeight) < 8) {
        return;
      }

      const currentWidth = Math.round(window.outerWidth || document.documentElement.clientWidth);
      void api.resizeOverlay(currentWidth, nextHeight);
    });
  }, [autoResizeMinimumHeight]);

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
        cancelAnimationFrame(autoResizeFrameRef.current);
        autoResizeFrameRef.current = null;
      }
    };
  }, [
    scheduleAdaptiveOverlayHeight,
    snapshot?.runtime.overlayMode,
    snapshot?.currentGuideEntry?.id,
    snapshot?.currentGuideEntry?.checklist?.length,
    snapshot?.config.overlayScale,
    snapshot?.config.overlayDensity,
    snapshot?.config.mainOverlaySettings.showOverlaySkip,
    snapshot?.config.mainOverlaySettings.showOverlayCriticalImportant,
    snapshot?.config.mainOverlaySettings.showOverlayBossTip,
    snapshot?.config.mainOverlaySettings.showOverlayVendorReminder,
    snapshot?.config.mainOverlaySettings.showOverlayXpStatus,
    snapshot?.config.mainOverlaySettings.showOverlayPowerSpike
  ]);

  const toggleTimerOnlyMode = useCallback(() => {
    const switchMode = async () => {
      const api = window.poe2Overlay;
      if (!api) {
        return;
      }

      await api.resizeOverlay(
        Math.round(window.outerWidth || document.documentElement.clientWidth),
        Math.round(window.outerHeight || document.documentElement.clientHeight)
      );
      await api.toggleOverlayMode();
    };

    void switchMode();
  }, []);

  if (!snapshot) {
    return <div className="overlay-shell loading-shell">Загрузка состояния…</div>;
  }

  const { config, currentGuideEntry, currentZone, runtime } = snapshot;
  const displayRunTimer = syncedRunTimer ?? config.runTimer;
  const guide = currentGuideEntry;
  const guideChecklist = guide?.checklist ?? [];
  const sceneName = getSceneDisplayName(snapshot);
  const levelState = getLevelState(snapshot);
  const currentActTimerLabel =
    guide && typeof guide.act === 'number'
      ? `Акт ${guide.act}`
      : guide?.act === 'interlude'
        ? 'Интерлюдии'
        : null;
  const importantLines = getImportantOverlayLines(snapshot);
  const zoneBonusItems = getCurrentZoneCampaignBonuses(snapshot);
  const leagueRewardItem = getCurrentZoneLeagueReward(snapshot, sceneName);
  // Always keep near-level vendor/power reminders visible in the main overlay.
  // Rule: show reminders from the current level up to +2 levels, and hide them after the target level is passed.
  const upcomingOverlayReminders = getOverlayUpcomingReminders(snapshot);
  const skipLines =
    config.mainOverlaySettings.showOverlaySkip && guide
      ? guide.skip.slice(0, 3)
      : [];
  const speedrunLines = getOverlaySpeedrunLines(guide);
  const actTitle = formatActTitle(currentZone.actHint ?? guide?.act ?? null);
  const overlayTitle = guide ? `${actTitle} · ${sceneName}` : sceneName;
  const isTimerOnlyMode = runtime.overlayMode === 'timer_only';
  const isCompactOverlay = config.overlayDensity === 'compact';
  const visibleChecklist = isCompactOverlay ? guideChecklist.slice(0, 3) : guideChecklist;
  const hiddenChecklistCount = Math.max(0, guideChecklist.length - visibleChecklist.length);
  const isOverlayMovementLocked = config.overlayMovementLocked;
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
  const unknownZoneName = currentZone.rawZoneName ?? runtime.lastSceneSource ?? runtime.lastRawZoneName ?? 'эта локация';
  const overlayMovementHint = isOverlayMovementLocked
    ? 'Окно закреплено. Нажми "Открепить", чтобы передвинуть.'
    : 'Потяни верхнюю часть окна, чтобы передвинуть.';
  const openCompanionHotkey = formatHotkeyLabel(config.hotkeys.openCompanion, 'F9');
  const toggleOverlayModeHotkey = formatHotkeyLabel(config.hotkeys.toggleOverlayMode, 'F10');
  const timerOnlyShowsCountdown =
    displayRunTimer.status === 'armed' &&
    typeof config.runTimerSettings.leagueStartAt === 'number';
  const minimumSize = getOverlayMinimumSize(
    runtime.overlayMode,
    config.overlayDensity,
    config.overlayScale
  );

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (isOverlayMovementLocked) {
      return;
    }

    resizeStateRef.current = {
      startX: event.screenX,
      startWidth: window.outerWidth || document.documentElement.clientWidth,
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
        window.outerHeight || document.documentElement.clientHeight
      );

      if (state.frame !== null) {
        cancelAnimationFrame(state.frame);
      }

      state.frame = requestAnimationFrame(() => {
        void window.poe2Overlay.resizeOverlay(nextWidth, currentHeight);
        scheduleAdaptiveOverlayHeight();
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
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const timerOnlyPrimaryLabel =
    timerOnlyShowsCountdown ? 'СТАРТ ЧЕРЕЗ' : 'ОБЩЕЕ ВРЕМЯ';
  const timerOnlyStatus = formatTimerOnlyRunStatus(displayRunTimer);
  const timerOnlyLevelText = `Ур. ${config.currentLevel ?? '?'} · Рек: ${guide?.recommended_level_label ?? '—'} · ${levelState.label}`;
  const timerPrimaryLabel =
    displayRunTimer.status === 'running'
      ? '⏸ Пауза'
      : displayRunTimer.status === 'paused'
        ? '▶ Продолжить'
        : '▶ Старт';
  const timerPrimaryTitle =
    displayRunTimer.status === 'running'
      ? 'Поставить таймер на паузу'
      : displayRunTimer.status === 'paused'
        ? 'Продолжить таймер'
        : 'Запустить таймер прохождения';
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
  const handleTimerReset = () => {
    void window.poe2Overlay?.resetRunTimer();
  };
  const handleCompactOverlayToggle = async () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    await api.resizeOverlay(
      Math.round(window.outerWidth || document.documentElement.clientWidth),
      Math.round(window.outerHeight || document.documentElement.clientHeight)
    );

    await api.updateSettings({
      overlayDensity: isCompactOverlay ? 'normal' : 'compact'
    });

    window.setTimeout(scheduleAdaptiveOverlayHeight, 0);
  };

  const handleTimerOnlyExpand = async () => {
    const api = window.poe2Overlay;
    if (!api) {
      return;
    }

    await api.resizeOverlay(
      Math.round(window.outerWidth || document.documentElement.clientWidth),
      Math.round(window.outerHeight || document.documentElement.clientHeight)
    );

    if (config.overlayDensity === 'compact') {
      await api.updateSettings({ overlayDensity: 'normal' });
    }

    await api.setOverlayMode('full');
    window.setTimeout(scheduleAdaptiveOverlayHeight, 0);
  };

  const handleOverlayMovementLockToggle = () => {
    void window.poe2Overlay?.updateSettings({
      overlayMovementLocked: !isOverlayMovementLocked
    });
  };
  const handleToggleSettings = () => {
    void window.poe2Overlay?.toggleSettings();
  };
  const handleToggleCompanion = () => {
    void window.poe2Overlay?.toggleCompanionPanel();
  };
  const overlayOpenCompanionButton = (
    <button
      className="overlay-icon-button no-drag"
      type="button"
      title={`Открыть/закрыть подробную панель (${openCompanionHotkey})`}
      aria-label={`Открыть/закрыть подробную панель (${openCompanionHotkey})`}
      onClick={handleToggleCompanion}
    >
      ☰
    </button>
  );
  const overlayOpenSettingsButton = (
    <button
      className="overlay-icon-button no-drag"
      type="button"
      title="Открыть/закрыть настройки"
      aria-label="Открыть/закрыть настройки"
      onClick={handleToggleSettings}
    >
      ⚙
    </button>
  );
  const overlayLockButton = (
    <button
      className={`overlay-lock-button no-drag ${isOverlayMovementLocked ? 'is-locked' : ''}`}
      type="button"
      title={
        isOverlayMovementLocked
          ? 'Снять закрепление и снова разрешить перемещение оверлея'
          : 'Закрепить оверлей, чтобы случайно не передвинуть его'
      }
      aria-pressed={isOverlayMovementLocked}
      onClick={handleOverlayMovementLockToggle}
    >
      {isOverlayMovementLocked ? '🔒 Открепить' : '🔓 Закрепить'}
    </button>
  );
  const overlayQuickActions = (
    <div className="overlay-quick-actions no-drag" aria-label="Быстрые элементы управления оверлея">
      {overlayLockButton}
      {overlayOpenCompanionButton}
      {overlayOpenSettingsButton}
    </div>
  );
  const overlayNoGuideBlock = (
    <div className="overlay-onboarding-card overlay-no-guide-card">
      <p className="overlay-onboarding-title">Инфы по этой локации нет</p>
      <p className="overlay-onboarding-text">
        Логи подключены, зона определена как <strong>{unknownZoneName}</strong>, но для неё пока нет подсказок в гайде.
      </p>
      <p className="overlay-onboarding-move-hint">
        Можно продолжать забег: таймер и ручные панели остаются доступны.
      </p>
    </div>
  );

  const overlayOnboardingBlock = (
    <div className="overlay-onboarding-card">
      <p className="overlay-onboarding-title">Зона не определена</p>
      <ol className="overlay-onboarding-list">
        <li>
          <strong>Выбери лог-файл игры</strong>
          <span>Обычно он находится тут:</span>
          <code className="overlay-onboarding-path">Path of Exile 2/logs/LatestClient.txt</code>
        </li>
        <li>
          <strong>Запусти игру и зайди в любую зону</strong>
          <span>Оверлей сам обновится по логам.</span>
        </li>
      </ol>
      <div className="overlay-onboarding-actions">
        <button
          className="overlay-timer-control overlay-timer-control-primary no-drag overlay-onboarding-button"
          type="button"
          onClick={() => { void window.poe2Overlay?.openSettings(); }}
        >
          Настроить лог-файл
        </button>
      </div>
      <p className="overlay-onboarding-move-hint">
        Как передвинуть окно: открепи его кнопкой сверху и потяни оверлей за верхнюю часть.
      </p>
    </div>
  );
  const timerControls = (
    <div className="overlay-timer-controls no-drag" aria-label="Управление таймером">
      <button
        className="overlay-timer-control overlay-timer-control-primary"
        type="button"
        title={timerPrimaryTitle}
        onClick={handleTimerPrimaryAction}
      >
        {timerPrimaryLabel}
      </button>
      <button
        className="overlay-timer-control"
        type="button"
        title="Сбросить таймер"
        onClick={handleTimerReset}
      >
        ↺ Сброс
      </button>
    </div>
  );

  if (isTimerOnlyMode) {
    return (
      <main
        ref={overlayPageRef}
        className={`overlay-page overlay-page-timer-only density-${config.overlayDensity} scale-${config.overlayScale} ${
          isOverlayMovementLocked ? 'is-movement-locked' : ''
        }`}
      >
        <div className={`window-drag-strip ${isOverlayMovementLocked ? 'is-locked no-drag' : ''}`}>
          {isOverlayMovementLocked ? 'PoE2 Campaign Codex Overlay · закреплено' : 'PoE2 Campaign Codex Overlay'}
        </div>
        <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-timer-only-card">
          <header className="timer-only-header">
            <div className="timer-only-heading">
              <p className="timer-only-kicker">{overlayTitle}</p>
              <div className="timer-only-state-row">
                <span className={`timer-only-status status-${displayRunTimer.status}`}>{timerOnlyStatus}</span>
                {guide && typeof guide.act === 'number' && (
                  <span className="timer-only-actline">
                    {currentActTimerLabel} ·{' '}
                    <LiveActTimeText
                      runTimer={displayRunTimer}
                      guide={guide}
                      snapshotNowMs={runtime.timerNowMs}
                    />
                  </span>
                )}
              </div>
            </div>
            <div className="overlay-top-control-row timer-only-top-control-row no-drag">
              {overlayQuickActions}
            </div>
          </header>

          <section className="timer-only-main-panel" aria-label="Основной таймер">
            <p className="timer-only-main-label">{timerOnlyPrimaryLabel}</p>
            <div className="timer-only-time">
              <LiveRunTimeText
                runTimer={displayRunTimer}
                settings={config.runTimerSettings}
                snapshotNowMs={runtime.timerNowMs}
                overlayMode={runtime.overlayMode}
              />
            </div>
            <div className="timer-only-controls-row">{timerControls}</div>
          </section>

          <div className="timer-only-info-grid">
            <p className={`timer-only-meta level-${levelState.state}`}>{timerOnlyLevelText}</p>
            <p className="timer-only-next">Дальше: {guide?.next_zone_ru || '—'}</p>
          </div>
          <p className="overlay-movement-hint timer-only-movement-hint">{overlayMovementHint}</p>

          <footer className="timer-only-footer">
            <button className="timer-only-expand-button no-drag" type="button" onClick={handleTimerOnlyExpand}>
              Развернуть
            </button>
            <span>{toggleOverlayModeHotkey} — развернуть · {openCompanionHotkey} — подробности</span>
          </footer>

          {!isOverlayMovementLocked && (
            <div
              className="resize-grip no-drag"
              aria-label="Изменить размер оверлея"
              role="button"
              tabIndex={-1}
              onPointerDown={beginResize}
            />
          )}
        </section>
      </main>
    );
  }

  return (
    <main
      ref={overlayPageRef}
      className={`overlay-page density-${config.overlayDensity} scale-${config.overlayScale} ${
        isOverlayMovementLocked ? 'is-movement-locked' : ''
      }`}
    >
      <div className={`window-drag-strip ${isOverlayMovementLocked ? 'is-locked no-drag' : ''}`}>
        {isOverlayMovementLocked ? 'PoE2 Campaign Codex Overlay · закреплено' : 'PoE2 Campaign Codex Overlay'}
      </div>
      <section ref={overlayShellRef} className="overlay-shell overlay-hud overlay-main-compact">
        <header className="hud-header">
          <div className="hud-title-row">
            <h1>{overlayTitle}</h1>
          </div>
          <div className="overlay-top-control-row no-drag">
            {overlayQuickActions}
            {timerControls}
          </div>
          {!isCompactOverlay && <p className="overlay-movement-hint">{overlayMovementHint}</p>}
          <p className={`hud-meta level-${levelState.state}`}>
            <LiveTimerMeta
              runTimer={displayRunTimer}
              settings={config.runTimerSettings}
              snapshotNowMs={runtime.timerNowMs}
              overlayMode={runtime.overlayMode}
              guide={guide}
              currentActLabel={currentActTimerLabel}
              currentLevel={config.currentLevel}
              recommendedLabel={guide?.recommended_level_label ?? '—'}
              statusLabel={levelState.label}
            />
          </p>
        </header>

        {runtime.logWatcherStatus !== 'ready' && (
          <section className="hud-banner">
            <strong>{runtime.logWatcherMessage}</strong>
          </section>
        )}

        {!isCompactOverlay && upcomingOverlayReminders.length > 0 && (
          <section className="hud-block reminder-section upcoming-overlay-section">
            <div className="reminder-header-row">
              <h2>Ближайшее</h2>
              <span className="overlay-upcoming-range">следующие 1–2 уровня</span>
            </div>
            <ul className="overlay-upcoming-list">
              {upcomingOverlayReminders.map((entry) => (
                <li
                  key={entry.id}
                  className={`overlay-upcoming-item ${entry.level === config.currentLevel ? 'is-current-level' : ''}`}
                >
                  <div className="overlay-upcoming-line">
                    <span className="overlay-upcoming-level">Ур. {entry.level}</span>
                    <span className="overlay-upcoming-title">{entry.title}</span>
                    {entry.level === config.currentLevel && (
                      <span className="overlay-upcoming-badge">сейчас</span>
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

        <section className="hud-block checklist-section">
          <h2>Что в локации</h2>
          {guide ? (
            guideChecklist.length > 0 ? (
              <>
                <ul className="checklist-list overlay-checklist-list">
                  {visibleChecklist.map((item) => (
                    <li key={item.id} className="checklist-item">
                      {item.text}
                    </li>
                  ))}
                </ul>
                {hiddenChecklistCount > 0 && (
                  <p className="helper-text checklist-more-note">
                    Ещё {hiddenChecklistCount} пункт(а) в полном режиме.
                  </p>
                )}
              </>
            ) : (
              <p className="hud-empty">Для этой зоны пока нет заметок.</p>
            )
          ) : (
            shouldShowNoGuideForZone ? overlayNoGuideBlock : overlayOnboardingBlock
          )}
        </section>

        {!isCompactOverlay && zoneBonusItems.length > 0 && (
          <section className="hud-block zone-bonuses-section">
            <h2>Бонусы зоны</h2>
            <ul className="section-list compact-list overlay-bonus-list">
              {zoneBonusItems.map(({ bonus, done }) => (
                <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                  <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                  <span>{bonus.title}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {!isCompactOverlay && leagueRewardItem && (
          <section className="hud-block league-reward-section">
            <h2>Лига</h2>
            <div className="league-reward-line">
              <span className="league-reward-marker">◆</span>
              <span>
                Гарант: {leagueRewardItem.reward_ru}
                {leagueRewardItem.uncertain ? ' · проверить' : ''}
              </span>
            </div>
            {leagueRewardItem.oneTimeGuaranteed && (
              <p className="league-reward-note">Одноразовая награда за механику в этой зоне</p>
            )}
          </section>
        )}

        <section className="hud-block hud-next-block">
          <h2>Дальше</h2>
          <p className="hud-next-zone">{guide?.next_zone_ru || '—'}</p>
        </section>

        {!isCompactOverlay && skipLines.length > 0 && (
          <section className="hud-block skip-section">
            <h2>Скип</h2>
            <ul className="section-list compact-list">
              {skipLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {!isCompactOverlay && speedrunLines.length > 0 && (
          <section className="hud-block speedrun-section">
            <h2>Спидран</h2>
            <ul className="section-list compact-list">
              {speedrunLines.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {!isCompactOverlay && importantLines.length > 0 && (
          <section className="hud-block info-section">
            <h2>Сейчас важно</h2>
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
              {isCompactOverlay ? 'Развернуть' : 'Компактно'}
            </button>
            <button className="timer-only-collapse-button no-drag" type="button" onClick={toggleTimerOnlyMode}>
              Только таймер
            </button>
          </div>
          <p className="hud-footnote">Подробности: {openCompanionHotkey} · {toggleOverlayModeHotkey} свернуть</p>
        </div>

        {!isOverlayMovementLocked && (
          <div
            className="resize-grip no-drag"
            aria-label="Изменить размер оверлея"
            role="button"
            tabIndex={-1}
            onPointerDown={beginResize}
          />
        )}
      </section>
    </main>
  );
}
