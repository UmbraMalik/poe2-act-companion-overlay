import { useMemo } from 'react';
import { getCampaignBonusView, getGuideView, translateDataText, type LocalizedGuideEntryView } from '../i18n/data';
import { translate } from '../i18n/translations';
import { isEndgameT15Act } from '../shared/timers';
import type {
  AppLanguage,
  AppSnapshot,
  CampaignBonusDefinition,
  GuideEntry,
  RunTimerStatus,
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
  tone: 'danger' | 'required' | 'bonus' | 'important';
};

interface CurrentRunHubProps {
  snapshot: AppSnapshot;
  routeActs: RouteActGroup[];
  guideView: LocalizedGuideEntryView | null;
  sceneName: string;
  nowAct: ZoneAct | null;
  currentRunElapsed: number;
  currentActElapsed: number | null;
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
  currentActElapsed,
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
  const zoneAttentionItems = useMemo<AttentionItem[]>(() => {
    const candidates: AttentionItem[] = [
      ...currentActMissedItems.slice(0, 3).map((item) => ({
        id: `missed:${item.id}`,
        text: item.text,
        meta: translate(language, 'companion.zoneHubMissedMeta', { zone: item.zone }),
        tone: 'danger' as const
      })),
      ...currentZoneRequiredItems.slice(0, 3).map((item) => ({
        id: `required:${item.id}`,
        text: item.text,
        meta: translate(language, 'companion.zoneHubRequiredMeta'),
        tone: 'required' as const
      })),
      ...localizedCurrentZoneBonuses
        .filter(({ done }) => !done)
        .slice(0, 2)
        .map(({ bonus, bonusView }) => ({
          id: `bonus:${bonus.id}`,
          text: bonusView?.displayTitle ?? bonus.title,
          meta: translate(language, 'companion.zoneHubBonusMeta'),
          tone: 'bonus' as const
        })),
      ...(guideView?.important ?? []).slice(0, 2).map((text, index) => ({
        id: `important:${index}:${text}`,
        text,
        meta: translate(language, 'companion.zoneHubImportantMeta'),
        tone: 'important' as const
      }))
    ];
    const seen = new Set<string>();

    return candidates.filter((item) => {
      const key = item.text.trim().toLocaleLowerCase(language === 'en' ? 'en' : 'ru');
      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    }).slice(0, 6);
  }, [currentActMissedItems, currentZoneRequiredItems, guideView?.important, language, localizedCurrentZoneBonuses]);

  const progressTotal = currentActRouteProgress.total;
  const progressCurrent = currentActRouteProgress.currentCount;
  const progressPercent = currentActRouteProgress.percent;
  const progressRemaining = Math.max(0, progressTotal - progressCurrent);
  const nextZoneName = guideView?.nextZoneName
    ?? (currentActNextRouteZone ? getCampaignZoneTitle(currentActNextRouteZone.guide, language) : null);
  const pendingBonusCount = localizedCurrentZoneBonuses.filter(({ done }) => !done).length;
  const attentionBreakdown = translate(language, 'companion.zoneHubAttentionBreakdown', {
    missed: currentActMissedItems.length,
    required: currentZoneRequiredItems.length,
    bonuses: pendingBonusCount
  });

  return (
    <div className="companion-tab-layout companion-zone-polished-layout zone-run-hub-layout">
      <section className="companion-block companion-overview-card zone-hero-card zone-run-hero-card">
        <div className="zone-hero-copy">
          <p className="eyebrow">{guide ? formatActTitle(guide.act, language) : translate(language, 'companion.currentScene')}</p>
          <h3>{sceneName}</h3>
          <p className="helper-text">{translate(language, 'companion.zoneHubIntro')}</p>
          <div className={`zone-health-row is-${zoneRecognition.tone}`}>
            <strong>{zoneRecognition.label}</strong>
            <span>{zoneRecognition.detail}</span>
          </div>
        </div>

        <div className="zone-run-progress-panel">
          <div className="zone-run-progress-heading">
            <div>
              <span>{translate(language, 'companion.zoneHubActProgress')}</span>
              <strong>{formatActTitle(nowAct, language)}</strong>
            </div>
            <b>{progressTotal > 0 ? `${Math.round(progressPercent)}%` : '—'}</b>
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
          <div className="zone-run-progress-meta">
            <span>
              {progressTotal > 0
                ? translate(language, 'companion.zoneHubPosition', { current: progressCurrent, total: progressTotal })
                : translate(language, 'companion.zoneHubProgressUnknown')}
            </span>
            <span>
              {progressTotal > 0
                ? translate(language, 'companion.zoneHubRemaining', { count: progressRemaining })
                : zoneRecognition.sceneLabel}
            </span>
          </div>
          <div className="zone-run-progress-next">
            <span>{translate(language, 'common.next')}</span>
            <strong>{nextZoneName ?? translate(language, 'common.notAvailable')}</strong>
          </div>
        </div>
      </section>

      <section className="zone-run-status-grid" aria-label={translate(language, 'companion.zoneHubStatusTitle')}>
        <article className={`zone-run-status-card is-xp-${activeXpStatus.variant}`}>
          <span>{translate(language, 'companion.experience')}</span>
          <strong>{activeXpStatus.longLabel}</strong>
          <small>
            {translate(language, 'common.level')} {snapshot.config.currentLevel ?? '?'} · {guideView?.recommendedLevelLabel ?? translate(language, 'common.notAvailable')}
          </small>
        </article>

        <article className={`zone-run-status-card is-timer-${timerStatus}`}>
          <span>{translate(language, 'companion.zoneHubActTime')}</span>
          <strong>{currentActElapsed === null ? '—' : formatDuration(currentActElapsed)}</strong>
          <small>
            {translate(language, 'companion.zoneHubRunTime')}: {formatDuration(currentRunElapsed)} · {formatRunStatus(timerStatus, language)}
          </small>
        </article>

        <article className="zone-run-status-card is-reminder">
          <span>{translate(language, 'companion.zoneHubUpcomingTitle')}</span>
          <strong>
            {nearestReminder
              ? translateDataText(nearestReminder.title, language)
              : translate(language, 'companion.zoneHubNoReminderTitle')}
          </strong>
          <small>
            {nearestReminder
              ? `${translate(language, 'common.level')} ${nearestReminder.level}`
              : translate(language, 'companion.zoneHubNoReminder')}
          </small>
        </article>

        <article className={`zone-run-status-card is-attention${zoneAttentionItems.length > 0 ? ' has-items' : ''}`}>
          <span>{translate(language, 'companion.zoneHubAttentionTitle')}</span>
          <strong>
            {zoneAttentionItems.length > 0
              ? translate(language, 'companion.zoneHubAttentionCount', { count: zoneAttentionItems.length })
              : translate(language, 'companion.zoneHubAllClear')}
          </strong>
          <small>{attentionBreakdown}</small>
        </article>
      </section>

      <div className="zone-run-command-grid">
        <section className="companion-block zone-attention-card">
          <div className="zone-section-heading">
            <h3>{translate(language, 'companion.zoneHubAttentionTitle')}</h3>
            {zoneAttentionItems.length > 0 && <span>{zoneAttentionItems.length}</span>}
          </div>
          {zoneAttentionItems.length > 0 ? (
            <ul className="zone-attention-list">
              {zoneAttentionItems.map((item) => (
                <li key={item.id} className={`zone-attention-item is-${item.tone}`}>
                  <span className="zone-attention-marker" aria-hidden="true" />
                  <div>
                    <strong>{item.text}</strong>
                    <small>{item.meta}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="zone-attention-clear">
              <strong>{translate(language, 'companion.zoneHubAllClear')}</strong>
              <span>{translate(language, 'companion.zoneHubAttentionClear')}</span>
            </div>
          )}
        </section>

        <section className="companion-block zone-next-step-card">
          <div className="zone-section-heading">
            <h3>{translate(language, 'companion.zoneHubNextTitle')}</h3>
            <span>{formatActTitle(nowAct, language)}</span>
          </div>
          <div className="zone-next-destination">
            <span>{translate(language, 'companion.nextZone')}</span>
            <strong>{nextZoneName ?? translate(language, 'common.notAvailable')}</strong>
          </div>

          {guideChecklist[0] && (
            <div className="zone-current-focus">
              <span>{translate(language, 'companion.zoneHubCurrentFocus')}</span>
              <strong>{guideChecklist[0].text}</strong>
              {guideChecklist.length > 1 && (
                <small>{translate(language, 'companion.routeMore', { count: guideChecklist.length - 1 })}</small>
              )}
            </div>
          )}

          {(guideView?.after?.length ?? 0) > 0 && (
            <div className="zone-next-notes">
              <span>{translate(language, 'common.after')}</span>
              <ul>
                {guideView?.after.slice(0, 2).map((item) => (
                  <li key={`zone-next-after-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {(guideView?.skip?.length ?? 0) > 0 && (
            <div className="zone-next-skip">
              <span>{translate(language, 'common.skip')}</span>
              <strong>{guideView?.skip[0]}</strong>
            </div>
          )}

          <button type="button" className="button-secondary zone-open-route-button" onClick={onOpenCurrentActRoute}>
            {translate(language, 'companion.zoneHubOpenRoute')}
          </button>
        </section>
      </div>

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
