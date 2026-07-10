import { useMemo } from 'react';
import leagueMechanicRewardsData from '../data/league-mechanic-rewards.json';
import { getCampaignBonusView, getGuideView, translateDataText, type LocalizedGuideEntryView } from '../i18n/data';
import { translate } from '../i18n/translations';
import { isEndgameT15Act } from '../shared/timers';
import type {
  AppLanguage,
  AppSnapshot,
  CampaignBonusDefinition,
  GuideEntry,
  RunTimerStatus,
  SavedRunHistoryEntry,
  ZoneAct
} from '../shared/types';
import {
  getRouteProgressState,
  getXpStatus,
  type RouteActGroup
} from './companion-helpers';
import { getGuideUpdateClassName } from './guide-update-highlights';
import { getZoneRecognitionView } from './log-health';
import { formatDuration } from './utils';

type RenderableGuideDetails = GuideEntry['details'] | LocalizedGuideEntryView['details'];

type ReminderItem = {
  id: string;
  level: number;
  title: string;
  items?: string[];
};

type AttentionItem = {
  id: string;
  text: string;
  meta: string;
  tone: 'danger' | 'required' | 'bonus' | 'league' | 'important' | 'xp';
};

type PrimaryAction = {
  id: string;
  text: string;
  meta: string;
  tone: 'required' | 'bonus' | 'league' | 'important' | 'route' | 'neutral';
};

type PaceView = {
  label: string;
  detail: string;
  tone: 'ahead' | 'behind' | 'even' | 'empty';
};

interface LeagueMechanicRewardEntry {
  id: string;
  zone_en: string;
  zone_ru: string;
  guideZoneId: string | null;
  guideZoneRu: string | null;
  aliases_ru?: string[];
  reward_en: string;
  reward_ru: string;
  hasReward: boolean;
  displayInOverlay: boolean;
  oneTimeGuaranteed: boolean;
}

const LEAGUE_MECHANIC_REWARDS = (
  leagueMechanicRewardsData as { rewards?: LeagueMechanicRewardEntry[] }
).rewards ?? [];

interface CurrentRunHubProps {
  snapshot: AppSnapshot;
  routeActs: RouteActGroup[];
  guideView: LocalizedGuideEntryView | null;
  sceneName: string;
  nowAct: ZoneAct | null;
  currentRunElapsed: number;
  currentZoneElapsed: number;
  currentActElapsed: number | null;
  runHistory: SavedRunHistoryEntry[];
  timerStatus: RunTimerStatus;
  nearestReminder: ReminderItem | null;
  zoneRecognition: ReturnType<typeof getZoneRecognitionView>;
  hasNoGuideForKnownZone: boolean;
  language: AppLanguage;
  onOpenCurrentActRoute: () => void;
}

function formatActTitle(act: ZoneAct | null, language: AppLanguage) {
  if (act === null) {
    return translate(language, 'companion.routeTitleFallback');
  }

  if (typeof act === 'number' && isEndgameT15Act(act)) {
    return translate(language, 'route.endgameToT15');
  }

  return act === 'interlude'
    ? translate(language, 'companion.interludes')
    : translate(language, 'route.act', { act });
}

function formatRunStatus(status: RunTimerStatus, language: AppLanguage) {
  switch (status) {
    case 'armed':
      return translate(language, 'companion.runStatus.armed');
    case 'running':
      return translate(language, 'companion.runStatus.running');
    case 'paused':
      return translate(language, 'companion.runStatus.paused');
    case 'finished':
      return translate(language, 'companion.runStatus.finished');
    default:
      return translate(language, 'companion.runStatus.idle');
  }
}

function renderStringSection(title: string, items: string[], className?: string) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={`companion-block ${className ?? ''}`.trim()}>
      <h3>{title}</h3>
      <ul className="details-list">
        {items.map((item) => (
          <li key={`${title}-${item}`} className={getGuideUpdateClassName(item).trim()}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function renderDetails(details: RenderableGuideDetails, language: AppLanguage) {
  if (!details) {
    return null;
  }

  if (Array.isArray(details)) {
    return renderStringSection(
      translate(language, 'companion.detailsTitle'),
      details.filter(Boolean).map((item) => translateDataText(item, language))
    );
  }

  if (typeof details !== 'object') {
    return null;
  }

  const duplicatedSectionKeys = new Set([
    'route',
    'rewards',
    'skip',
    'important',
    'after',
    'boss_tips',
    'xp_notes',
    'crafting_tips',
    'overlay_speedrun'
  ]);
  const groups = Object.entries(details).filter(
    ([key, value]) =>
      !duplicatedSectionKeys.has(key) &&
      Array.isArray(value) &&
      value.length > 0
  );

  if (groups.length === 0) {
    return null;
  }

  return (
    <section className="companion-block companion-details-block">
      <h3>{translate(language, 'companion.detailsTitle')}</h3>
      <div className="companion-stack">
        {groups.map(([key, value]) => (
          <div key={key}>
            <p className="companion-inline-title">
              {translate(language, `companion.detailsGroup.${key}`)}
            </p>
            <ul className="details-list">
              {(value as string[]).map((item) => {
                const localizedItem = translateDataText(item, language);
                return (
                  <li key={`${key}-${item}`} className={getGuideUpdateClassName(localizedItem).trim()}>
                    {localizedItem}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function normalizeZoneBonusName(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('ru')
    .replace(/ё/g, 'е')
    .replace(/[’'`]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeLeagueZoneName(value: string | null | undefined): string {
  return (value ?? '')
    .toLocaleLowerCase('ru')
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
  snapshot: AppSnapshot,
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

  return LEAGUE_MECHANIC_REWARDS.find((reward) => {
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
  }) ?? null;
}

function normalizeCommandText(value: string): string {
  return value.trim().toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

function getBestZoneEntryCheckpoint(
  runHistory: SavedRunHistoryEntry[],
  zoneId: string | null
): number | null {
  if (!zoneId) {
    return null;
  }

  const checkpoints = runHistory.flatMap((entry) => {
    const history = Array.isArray(entry.zoneTimeHistory) ? entry.zoneTimeHistory : [];
    const currentZoneIndex = history.findIndex((zone) => zone.zoneId === zoneId);

    if (currentZoneIndex <= 0) {
      return [];
    }

    const elapsedMs = history
      .slice(0, currentZoneIndex)
      .reduce((total, zone) => total + Math.max(0, zone.elapsedMs), 0);

    return elapsedMs > 0 ? [elapsedMs] : [];
  });

  return checkpoints.length > 0 ? Math.min(...checkpoints) : null;
}

function getPaceView(
  runHistory: SavedRunHistoryEntry[],
  guide: GuideEntry | null,
  currentRunElapsed: number,
  currentZoneElapsed: number,
  timerStatus: RunTimerStatus,
  language: AppLanguage
): PaceView {
  if (timerStatus === 'not_started' || timerStatus === 'armed' || currentRunElapsed <= 0) {
    return {
      label: translate(language, 'companion.zoneHubPaceWaiting'),
      detail: translate(language, 'companion.zoneHubPaceWaitingHint'),
      tone: 'empty'
    };
  }

  const bestCheckpoint = getBestZoneEntryCheckpoint(runHistory, guide?.id ?? null);
  if (bestCheckpoint === null) {
    return {
      label: translate(language, 'companion.zoneHubPaceNoHistory'),
      detail: translate(language, 'companion.zoneHubPaceNoHistoryHint'),
      tone: 'empty'
    };
  }

  const currentCheckpoint = Math.max(0, currentRunElapsed - currentZoneElapsed);
  const deltaMs = currentCheckpoint - bestCheckpoint;
  const absoluteDelta = formatDuration(Math.abs(deltaMs));

  if (Math.abs(deltaMs) < 1000) {
    return {
      label: translate(language, 'companion.zoneHubPaceEven'),
      detail: translate(language, 'companion.zoneHubPaceCheckpoint'),
      tone: 'even'
    };
  }

  return deltaMs < 0
    ? {
      label: translate(language, 'companion.zoneHubPaceAhead', { time: absoluteDelta }),
      detail: translate(language, 'companion.zoneHubPaceCheckpoint'),
      tone: 'ahead'
    }
    : {
      label: translate(language, 'companion.zoneHubPaceBehind', { time: absoluteDelta }),
      detail: translate(language, 'companion.zoneHubPaceCheckpoint'),
      tone: 'behind'
    };
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
  const values = [guide?.id, guide?.zone_ru, guide?.zone_en, rawZoneName].map(normalizeZoneBonusName);
  return values.some((value) => (
    value === 'interlude_khari_crossing' ||
    value === 'кхарийский перевал' ||
    value === 'the khari crossing' ||
    value === 'khari crossing'
  ));
}

function isGalaiGatesGuide(guide: GuideEntry | null, rawZoneName: string | null | undefined): boolean {
  const values = [guide?.id, guide?.zone_ru, guide?.zone_en, rawZoneName].map(normalizeZoneBonusName);
  return values.some((value) => (
    value === 'interlude_galai_gates' ||
    value === 'ворота галаи' ||
    value === 'врата голай' ||
    value === 'the galai gates' ||
    value === 'galai gates'
  ));
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

function getCurrentZoneCampaignBonuses(snapshot: AppSnapshot) {
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

    if (isGalaiGates && isKhariBonus) {
      return false;
    }

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

export function CurrentRunHub({
  snapshot,
  routeActs,
  guideView,
  sceneName,
  nowAct,
  currentRunElapsed,
  currentZoneElapsed,
  currentActElapsed,
  runHistory,
  timerStatus,
  nearestReminder,
  zoneRecognition,
  hasNoGuideForKnownZone,
  language,
  onOpenCurrentActRoute
}: CurrentRunHubProps) {
  const guide = snapshot.currentGuideEntry;
  const guideChecklist = guideView?.checklist ?? [];
  const currentActRouteZones = useMemo(
    () => routeActs.find((entry) => entry.act === nowAct)?.zones ?? [],
    [routeActs, nowAct]
  );
  const currentActRouteProgress = useMemo(
    () => getRouteProgressState(currentActRouteZones, {
      isSelectedRouteActCurrent: nowAct !== null,
      isSelectedRouteActBeforeCurrent: false
    }),
    [currentActRouteZones, nowAct]
  );
  const currentActRouteZone = currentActRouteProgress.currentIndex >= 0
    ? currentActRouteZones[currentActRouteProgress.currentIndex] ?? null
    : null;
  const currentActNextRouteZone = currentActRouteProgress.currentIndex >= 0
    ? currentActRouteZones.find((entry, index) => entry.status === 'pending' && index > currentActRouteProgress.currentIndex) ?? null
    : currentActRouteZones.find((entry) => entry.status === 'pending') ?? null;
  const activeXpStatus = useMemo(
    () => getXpStatus(snapshot, language),
    [snapshot.config.currentLevel, snapshot.currentGuideEntry?.id, language]
  );
  const localizedCurrentZoneBonuses = useMemo(
    () => getCurrentZoneCampaignBonuses(snapshot).map(({ bonus, done }) => ({
      bonus,
      bonusView: getCampaignBonusView(bonus, language),
      done
    })),
    [
      snapshot.currentGuideEntry,
      snapshot.currentZone.rawZoneName,
      snapshot.campaignBonuses,
      snapshot.config.campaignBonusProgress,
      language
    ]
  );
  const currentZoneLeagueReward = useMemo(
    () => getCurrentZoneLeagueReward(snapshot, sceneName),
    [snapshot, sceneName]
  );
  const currentActMissedItems = useMemo(
    () => currentActRouteZones.flatMap((entry) => entry.missedItems.map((item) => ({
      id: `${entry.guide.id}:${item.id}`,
      text: translateDataText(item.text, language),
      zone: getCampaignZoneTitle(entry.guide, language)
    }))),
    [currentActRouteZones, language]
  );
  const currentZoneRequiredItems = useMemo(() => {
    const localizedChecklist = new Map(guideChecklist.map((item) => [item.id, item.text]));

    return (currentActRouteZone?.rewardItems ?? [])
      .filter((item) => item.displayState !== 'done' && item.displayState !== 'likely_done')
      .map((item) => ({
        id: item.id,
        text: localizedChecklist.get(item.id) ?? translateDataText(item.text, language)
      }));
  }, [currentActRouteZone, guideChecklist, language]);
  const progressTotal = currentActRouteProgress.total;
  const progressCurrent = currentActRouteProgress.currentCount;
  const progressPercent = currentActRouteProgress.percent;
  const progressRemaining = Math.max(0, progressTotal - progressCurrent);
  const nextZoneName = guideView?.nextZoneName
    ?? (currentActNextRouteZone ? getCampaignZoneTitle(currentActNextRouteZone.guide, language) : null);
  const pendingBonuses = useMemo(
    () => localizedCurrentZoneBonuses.filter(({ done }) => !done),
    [localizedCurrentZoneBonuses]
  );
  const primaryAction = useMemo<PrimaryAction>(() => {
    if (currentZoneRequiredItems[0]) {
      return {
        id: `required:${currentZoneRequiredItems[0].id}`,
        text: currentZoneRequiredItems[0].text,
        meta: translate(language, 'companion.zoneHubRequiredMeta'),
        tone: 'required'
      };
    }

    if (guideChecklist[0]) {
      return {
        id: `checklist:${guideChecklist[0].id}`,
        text: guideChecklist[0].text,
        meta: translate(language, 'companion.zoneHubPrimaryChecklistMeta'),
        tone: 'neutral'
      };
    }

    if (currentZoneLeagueReward) {
      return {
        id: `league:${currentZoneLeagueReward.id}`,
        text: language === 'en' ? currentZoneLeagueReward.reward_en : currentZoneLeagueReward.reward_ru,
        meta: translate(language, 'companion.zoneHubLeagueMeta'),
        tone: 'league'
      };
    }

    if (pendingBonuses[0]) {
      return {
        id: `bonus:${pendingBonuses[0].bonus.id}`,
        text: pendingBonuses[0].bonusView?.displayTitle ?? pendingBonuses[0].bonus.title,
        meta: translate(language, 'companion.zoneHubBonusMeta'),
        tone: 'bonus'
      };
    }

    if (guideView?.important[0]) {
      return {
        id: `important:${guideView.important[0]}`,
        text: guideView.important[0],
        meta: translate(language, 'companion.zoneHubImportantMeta'),
        tone: 'important'
      };
    }

    if (nextZoneName) {
      return {
        id: `route:${nextZoneName}`,
        text: translate(language, 'companion.zoneHubMoveTo', { zone: nextZoneName }),
        meta: translate(language, 'companion.zoneHubRouteMeta'),
        tone: 'route'
      };
    }

    return {
      id: 'neutral',
      text: translate(language, 'companion.zoneHubNoPrimaryTask'),
      meta: translate(language, 'companion.zoneHubNoPrimaryTaskHint'),
      tone: 'neutral'
    };
  }, [
    currentZoneRequiredItems,
    guideChecklist,
    currentZoneLeagueReward,
    pendingBonuses,
    guideView?.important,
    language,
    nextZoneName
  ]);
  const attentionResult = useMemo(() => {
    const candidates: AttentionItem[] = [
      ...(currentZoneLeagueReward ? [{
        id: `league:${currentZoneLeagueReward.id}`,
        text: language === 'en'
          ? currentZoneLeagueReward.reward_en
          : currentZoneLeagueReward.reward_ru,
        meta: translate(language, 'companion.zoneHubLeagueMeta'),
        tone: 'league' as const
      }] : []),
      ...pendingBonuses.map(({ bonus, bonusView }) => ({
        id: `bonus:${bonus.id}`,
        text: bonusView?.displayTitle ?? bonus.title,
        meta: translate(language, 'companion.zoneHubBonusMeta'),
        tone: 'bonus' as const
      })),
      ...currentActMissedItems.map((item) => ({
        id: `missed:${item.id}`,
        text: item.text,
        meta: translate(language, 'companion.zoneHubMissedMeta', { zone: item.zone }),
        tone: 'danger' as const
      })),
      ...(activeXpStatus.variant === 'low' ? [{
        id: 'xp-low',
        text: activeXpStatus.longLabel,
        meta: translate(language, 'companion.zoneHubXpMeta', {
          current: snapshot.config.currentLevel ?? '?',
          recommended: guide?.recommended_level ?? '?'
        }),
        tone: 'xp' as const
      }] : []),
      ...currentZoneRequiredItems.map((item) => ({
        id: `required:${item.id}`,
        text: item.text,
        meta: translate(language, 'companion.zoneHubRequiredMeta'),
        tone: 'required' as const
      })),
      ...guideChecklist.slice(1, 3).map((item) => ({
        id: `checklist:${item.id}`,
        text: item.text,
        meta: translate(language, 'companion.zoneHubPrimaryChecklistMeta'),
        tone: 'required' as const
      })),
      ...(guideView?.important ?? []).map((text, index) => ({
        id: `important:${index}:${text}`,
        text,
        meta: translate(language, 'companion.zoneHubImportantMeta'),
        tone: 'important' as const
      }))
    ];
    const seen = new Set([normalizeCommandText(primaryAction.text)]);
    const unique = candidates.filter((item) => {
      const key = normalizeCommandText(item.text);
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    return {
      total: unique.length,
      items: unique.slice(0, 3)
    };
  }, [
    activeXpStatus.longLabel,
    activeXpStatus.variant,
    currentActMissedItems,
    currentZoneLeagueReward,
    currentZoneRequiredItems,
    guide?.recommended_level,
    guideChecklist,
    guideView?.important,
    language,
    pendingBonuses,
    primaryAction.text,
    snapshot.config.currentLevel
  ]);
  const paceView = useMemo(
    () => getPaceView(
      runHistory,
      guide,
      currentRunElapsed,
      currentZoneElapsed,
      timerStatus,
      language
    ),
    [runHistory, guide, currentRunElapsed, currentZoneElapsed, timerStatus, language]
  );
  const routePositionLabel = progressTotal > 0
    ? translate(language, 'companion.zoneHubPosition', { current: progressCurrent, total: progressTotal })
    : translate(language, 'companion.zoneHubProgressUnknown');
  const runStatusLabel = formatRunStatus(timerStatus, language);

  return (
    <div className="companion-tab-layout companion-zone-polished-layout zone-run-hub-layout">
      <section className="companion-block zone-command-center" aria-label={translate(language, 'companion.zoneHubCommandCenter')}>
        <div className="zone-command-header">
          <div className="zone-command-location">
            <p className="eyebrow">{formatActTitle(nowAct, language)}</p>
            <h2>{sceneName}</h2>
            <div className={`zone-health-row is-${zoneRecognition.tone}`}>
              <strong>{zoneRecognition.label}</strong>
              <span>{zoneRecognition.detail}</span>
            </div>
          </div>

          <div className="zone-command-clock">
            <span>{translate(language, 'companion.zoneHubRunTime')}</span>
            <strong>{formatDuration(currentRunElapsed)}</strong>
            <div className={`zone-command-pace is-${paceView.tone}`}>
              <b>{paceView.label}</b>
              <small>{paceView.detail}</small>
            </div>
          </div>
        </div>

        <div className="zone-command-progress">
          <div className="zone-command-progress-copy">
            <span>{translate(language, 'companion.zoneHubActProgress')}</span>
            <strong>{routePositionLabel}</strong>
          </div>
          <div
            className={`zone-run-progress-track${progressTotal === 0 ? ' is-unknown' : ''}`}
            role="progressbar"
            aria-label={translate(language, 'companion.zoneHubActProgress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPercent)}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="zone-command-progress-copy is-right">
            <span>{progressTotal > 0 ? `${Math.round(progressPercent)}%` : '—'}</span>
            <strong>
              {progressTotal > 0
                ? translate(language, 'companion.zoneHubRemaining', { count: progressRemaining })
                : zoneRecognition.sceneLabel}
            </strong>
          </div>
        </div>

        <div className="zone-command-grid">
          <article className={`zone-command-panel zone-command-primary is-${primaryAction.tone}`}>
            <span>{translate(language, 'companion.zoneHubPrimaryTask')}</span>
            <strong>{primaryAction.text}</strong>
            <small>{primaryAction.meta}</small>
          </article>

          <article className="zone-command-panel zone-command-attention">
            <div className="zone-command-panel-heading">
              <span>{translate(language, 'companion.zoneHubAttentionTitle')}</span>
              {attentionResult.total > 0 && (
                <b>{attentionResult.items.length}{attentionResult.total > attentionResult.items.length ? ` / ${attentionResult.total}` : ''}</b>
              )}
            </div>
            {attentionResult.items.length > 0 ? (
              <ul>
                {attentionResult.items.map((item) => (
                  <li key={item.id} className={`is-${item.tone}`}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{item.text}</strong>
                      <small>{item.meta}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="zone-command-empty">
                <strong>{translate(language, 'companion.zoneHubAllClear')}</strong>
                <small>{translate(language, 'companion.zoneHubAttentionClear')}</small>
              </div>
            )}
          </article>

          <article className="zone-command-panel zone-command-route">
            <span>{translate(language, 'companion.zoneHubRouteTitle')}</span>
            <div className="zone-command-route-flow">
              <strong>{sceneName}</strong>
              <b aria-hidden="true">→</b>
              <strong>{nextZoneName ?? translate(language, 'common.notAvailable')}</strong>
            </div>
            <small>{routePositionLabel}</small>
            <button type="button" className="button-secondary" onClick={onOpenCurrentActRoute}>
              {translate(language, 'companion.zoneHubOpenRoute')}
            </button>
          </article>

          <article className="zone-command-panel zone-command-upcoming">
            <span>{translate(language, 'companion.zoneHubUpcomingTitle')}</span>
            <strong>
              {nearestReminder
                ? translateDataText(nearestReminder.title, language)
                : translate(language, 'companion.zoneHubNoReminderTitle')}
            </strong>
            <small>
              {nearestReminder
                ? translate(language, 'companion.zoneHubReminderAtLevel', { level: nearestReminder.level })
                : translate(language, 'companion.zoneHubNoReminder')}
            </small>
          </article>
        </div>

        <div className="zone-command-quick-status" aria-label={translate(language, 'companion.zoneHubStatusTitle')}>
          <span className={`is-xp-${activeXpStatus.variant}`}>
            <b>{translate(language, 'companion.experience')}</b>
            {activeXpStatus.longLabel}
          </span>
          <span>
            <b>{translate(language, 'companion.zoneHubActTime')}</b>
            {currentActElapsed === null ? '—' : formatDuration(currentActElapsed)}
          </span>
          <span>
            <b>{translate(language, 'common.status')}</b>
            {runStatusLabel}
          </span>
        </div>
      </section>

      <details className="companion-block zone-detail-drawer">
        <summary>
          <span>
            <strong>{translate(language, 'companion.zoneHubDetailsSummary')}</strong>
            <small>{translate(language, 'companion.zoneHubDetailsHint')}</small>
          </span>
          <span className="zone-detail-toggle-icon" aria-hidden="true">⌄</span>
        </summary>

        <div className="zone-detail-drawer-body">
          <section className="companion-block zone-task-card zone-task-primary">
            <div className="zone-section-heading">
              <h3>{translate(language, 'overlay.inThisZone')}</h3>
              {guideChecklist.length > 0 && <span>{guideChecklist.length}</span>}
            </div>
            {guideChecklist.length > 0 ? (
              <ul className="checklist-list companion-checklist-list zone-checklist-list">
                {guideChecklist.map((item) => (
                  <li key={item.id} className={`checklist-item${getGuideUpdateClassName(item.text)}`}>
                    {item.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text">
                {hasNoGuideForKnownZone ? zoneRecognition.noGuideText : translate(language, 'overlay.emptyZoneNotes')}
              </p>
            )}
          </section>

          {localizedCurrentZoneBonuses.length > 0 && (
            <section className="companion-block zone-bonuses-card zone-task-card">
              <div className="zone-section-heading">
                <h3>{translate(language, 'overlay.zoneBonuses')}</h3>
                <span>{localizedCurrentZoneBonuses.filter(({ done }) => done).length}/{localizedCurrentZoneBonuses.length}</span>
              </div>
              <ul className="details-list zone-bonus-details-list">
                {localizedCurrentZoneBonuses.map(({ bonus, bonusView, done }) => (
                  <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                    <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                    <span>{bonusView?.displayTitle ?? bonus.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {renderStringSection(translate(language, 'companion.take'), guideView?.rewards ?? [], 'zone-task-card zone-reward-card')}
          {renderStringSection(translate(language, 'common.important'), guideView?.important ?? [], 'zone-task-card zone-important-card')}
          {renderStringSection(translate(language, 'common.bossTips'), guideView?.bossTips ?? [], 'zone-task-card')}
          {renderStringSection(translate(language, 'common.xpNotes'), guideView?.xpNotes ?? [], 'zone-task-card')}
          {renderStringSection(translate(language, 'common.craftingTips'), guideView?.craftingTips ?? [], 'zone-task-card')}
          {renderStringSection(translate(language, 'common.after'), guideView?.after ?? [], 'zone-task-card')}
          {renderStringSection(translate(language, 'common.skip'), guideView?.skip ?? [], 'skip-section zone-task-card')}
          {renderDetails(guideView?.details ?? guide?.details, language)}
        </div>
      </details>
    </div>
  );
}

function getCampaignZoneTitle(guide: GuideEntry, language: AppLanguage): string {
  return getGuideView(guide, language)?.zoneName
    ?? (language === 'en' ? guide.zone_en : guide.zone_ru)
    ?? (language === 'en' ? guide.zone_ru : guide.zone_en);
}
