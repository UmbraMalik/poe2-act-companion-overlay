import { useEffect, useState } from 'react';
import { useAppSnapshot, useLiveRunTimer } from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import {
  getActTimeRowsFromSplits,
  getCurrentActElapsedMsForAct,
  getCurrentRouteAct,
  getDismissedReminderHistory,
  getLongestZones,
  getNearestPowerSpike,
  getRequiredRewardLabelsForZone,
  getRouteActs,
  getRouteOverviewForAct,
  getSceneDisplayName,
  getUpcomingVendorReminders,
  getXpStatus
} from '../companion-helpers';
import { formatDuration, formatRecommendedLevelLabel } from '../utils';
import type { ActTimeRow } from '../companion-helpers';
import { getCampaignBonusView, getGuideView, translateDataText } from '../../i18n/data';
import { translate } from '../../i18n/translations';
import { isEndgameT15Act } from '../../shared/timers';
import { getGuideUpdateClassName } from '../guide-update-highlights';
import type { AppLanguage, CampaignBonusDefinition, CampaignBonusProgress, GuideEntry, RunSummary, SavedRunHistoryEntry, ZoneAct } from '../../shared/types';

type CompanionTab = 'zone' | 'route' | 'timer' | 'actTimes' | 'reminders' | 'bonuses' | 'summary';
type RunConfirmDialog =
  | { type: 'reset' }
  | { type: 'restore'; runId: string }
  | { type: 'delete'; runId: string }
  | null;

const ROUTE_OVERVIEW_VISIBLE_ITEMS = 2;
const TOTAL_CAMPAIGN_ACTS = 5;

function getRouteStatusLabel(
  status: 'current' | 'missed' | 'completed' | 'visited' | 'pending',
  language: AppLanguage
) {
  switch (status) {
    case 'current':
      return translate(language, 'companion.routeStatusCurrent');
    case 'missed':
      return translate(language, 'companion.routeStatusMissed');
    default:
      return null;
  }
}

function getGuideDetailsList(guide: GuideEntry, key: string): string[] {
  if (!guide.details || Array.isArray(guide.details)) {
    return [];
  }

  const value = (guide.details as Record<string, unknown>)[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getRouteFallbackLabels(guide: GuideEntry, language: AppLanguage): string[] {
  const guideView = getGuideView(guide, language);
  const localizedDetails = guideView?.details;
  const detailsRoute = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.route)
    ? localizedDetails.route.filter((item): item is string => typeof item === 'string')
    : [];
  const navigation = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.navigation)
    ? localizedDetails.navigation.filter((item): item is string => typeof item === 'string')
    : [];
  const craftPlan = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.craft_plan)
    ? localizedDetails.craft_plan.filter((item): item is string => typeof item === 'string')
    : [];
  const timeSaves = localizedDetails && !Array.isArray(localizedDetails) && Array.isArray(localizedDetails.time_saves)
    ? localizedDetails.time_saves.filter((item): item is string => typeof item === 'string')
    : [];

  const candidates = [
    ...(guideView?.checklist ?? []).map((item) => item.text),
    ...detailsRoute,
    ...(guideView?.important ?? []),
    ...navigation,
    ...craftPlan,
    ...timeSaves,
    ...(guideView?.rewards ?? []).map((item) => translate(language, 'companion.routeRewardPrefix', { text: item })),
    guideView?.nextZoneName ? translate(language, 'companion.routeNextPrefix', { text: guideView.nextZoneName }) : ''
  ];

  const seen = new Set<string>();

  return candidates
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const key = item.toLocaleLowerCase(language === 'en' ? 'en' : 'ru');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function formatRouteCardTitle(guide: GuideEntry, language: AppLanguage): string {
  if (guide.id === 'interlude_level_52_power_spike') {
    return translate(language, 'companion.setup52');
  }

  return getGuideView(guide, language)?.zoneName ?? (language === 'en' ? guide.zone_en : guide.zone_ru);
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

function formatRunStatus(status: string, language: AppLanguage) {
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

function formatActTimeStatus(status: ActTimeRow['status'], language: AppLanguage) {
  return status === 'finished'
    ? translate(language, 'companion.actStatusFinished')
    : translate(language, 'companion.actStatusCurrent');
}

function renderActTimeTable(rows: ActTimeRow[], emptyMessage: string, language: AppLanguage) {
  if (rows.length === 0) {
    return <p className="helper-text">{emptyMessage}</p>;
  }

  return (
    <div className="compact-table-wrap">
      <table className="compact-table">
        <thead>
          <tr>
            <th>{translate(language, 'route.act', { act: '' }).trim()}</th>
            <th>{translate(language, 'companion.timerTitle')}</th>
            <th>{translate(language, 'common.status')}</th>
            <th>{translate(language, 'common.summary')} / {translate(language, 'companion.totalTime')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`act-time-${row.act}`}>
              <td>{formatActLabel(row.act, language)}</td>
              <td>{formatDuration(row.elapsedMs)}</td>
              <td>{formatActTimeStatus(row.status, language)}</td>
              <td>{formatDuration(row.totalElapsedMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function getCompletedActCount(rows: ActTimeRow[]): number {
  return rows.filter((row) => row.status === 'finished' && !isEndgameT15Act(row.act)).length;
}

function getSlowestActRow(rows: ActTimeRow[]): ActTimeRow | null {
  return rows.length > 0
    ? [...rows].sort((left, right) => right.elapsedMs - left.elapsedMs)[0]
    : null;
}

function getAverageActElapsedMs(rows: ActTimeRow[]): number | null {
  const finishedRows = rows.filter((row) => row.status === 'finished' && row.elapsedMs > 0 && !isEndgameT15Act(row.act));

  if (finishedRows.length === 0) {
    return null;
  }

  return Math.round(finishedRows.reduce((total, row) => total + row.elapsedMs, 0) / finishedRows.length);
}

function formatActLabel(act: number, language: AppLanguage): string {
  return isEndgameT15Act(act)
    ? translate(language, 'route.endgameToT15')
    : translate(language, 'route.act', { act });
}

function formatCurrentSegmentMetric(row: ActTimeRow | null, language: AppLanguage): string {
  if (!row) {
    return translate(language, 'companion.noCurrentAct');
  }

  return isEndgameT15Act(row.act)
    ? translate(language, 'route.endgameToT15')
    : translate(language, 'companion.currentActMetric', { act: row.act });
}

function renderMetricCard(
  label: string,
  value: string,
  hint?: string | null,
  variant?: 'accent' | 'muted'
) {
  return (
    <div className={`run-metric-card ${variant ? `is-${variant}` : ''}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function renderActTimeCards(rows: ActTimeRow[], emptyMessage: string, language: AppLanguage) {
  if (rows.length === 0) {
    return <p className="helper-text">{emptyMessage}</p>;
  }

  return (
    <div className="act-time-card-grid">
      {rows.map((row, index) => {
        const statusLabel = formatActTimeStatus(row.status, language);
        const isCurrent = row.status === 'current';

        return (
          <article key={`act-time-card-${row.act}`} className={`act-time-card ${isCurrent ? 'is-current' : 'is-finished'}`}>
            <div className="act-time-card-topline">
              <span className="act-time-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="act-time-status-pill">{statusLabel}</span>
            </div>
            <h4>{formatActLabel(row.act, language)}</h4>
            <div className="act-time-main-value">{formatDuration(row.elapsedMs)}</div>
            <div className="act-time-card-footer">
              <span>{translate(language, 'companion.cumulativeTime')}</span>
              <strong>{formatDuration(row.totalElapsedMs)}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function renderLongestZoneList(
  longestZones: { zoneId: string; zone_ru: string; elapsedMs: number; enteredAt: number }[],
  language: AppLanguage,
  emptyMessage: string
) {
  if (longestZones.length === 0) {
    return <p className="helper-text">{emptyMessage}</p>;
  }

  return (
    <ol className="longest-zone-list">
      {longestZones.map((entry, index) => (
        <li key={`${entry.zoneId}-${entry.enteredAt}`}>
          <span className="longest-zone-rank">#{index + 1}</span>
          <span className="longest-zone-name">{translateDataText(entry.zone_ru, language)}</span>
          <strong>{formatDuration(entry.elapsedMs)}</strong>
        </li>
      ))}
    </ol>
  );
}


function formatSavedRunDate(timestamp: number, language: AppLanguage): string {
  return new Date(timestamp).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU');
}

function getSavedRunActRows(entry: SavedRunHistoryEntry): ActTimeRow[] {
  return getActTimeRowsFromSplits(entry.actSplits, entry.totalElapsedMs, {
    currentAct: typeof entry.currentAct === 'number' ? entry.currentAct : null,
    includeCurrentAct: entry.status !== 'finished',
    currentStatus: entry.status
  });
}

function getBestSavedRun(history: SavedRunHistoryEntry[]): SavedRunHistoryEntry | null {
  const candidates = history.filter((entry) => entry.totalElapsedMs > 0);
  return candidates.length > 0
    ? [...candidates].sort((left, right) => left.totalElapsedMs - right.totalElapsedMs)[0]
    : null;
}

function formatDelta(ms: number): string {
  if (ms === 0) {
    return '±00:00';
  }

  return `${ms > 0 ? '+' : '-'}${formatDuration(Math.abs(ms))}`;
}

function renderActTimesDashboard(
  rows: ActTimeRow[],
  totalElapsedMs: number,
  emptyMessage: string,
  language: AppLanguage
) {
  const completedActCount = getCompletedActCount(rows);
  const slowestAct = getSlowestActRow(rows);
  const averageActElapsedMs = getAverageActElapsedMs(rows);
  const currentAct = rows.find((row) => row.status === 'current') ?? rows[rows.length - 1] ?? null;

  return (
    <div className="act-times-dashboard">
      <section className="companion-block act-times-hero-card">
        <div>
          <h3>{translate(language, 'companion.actTimesTitle')}</h3>
          <p className="helper-text">{translate(language, 'companion.actTimesIntro')}</p>
        </div>
        <div className="run-metric-grid">
          {renderMetricCard(
            translate(language, 'companion.totalTime'),
            formatDuration(totalElapsedMs),
            translate(language, 'companion.totalTimeHint'),
            'accent'
          )}
          {renderMetricCard(
            translate(language, 'companion.completedActs'),
            `${completedActCount} / ${TOTAL_CAMPAIGN_ACTS}`,
            formatCurrentSegmentMetric(currentAct, language)
          )}
          {renderMetricCard(
            translate(language, 'companion.longestAct'),
            slowestAct ? formatDuration(slowestAct.elapsedMs) : '—',
            slowestAct ? formatActLabel(slowestAct.act, language) : translate(language, 'companion.noActSplits')
          )}
          {renderMetricCard(
            translate(language, 'companion.averageAct'),
            averageActElapsedMs !== null ? formatDuration(averageActElapsedMs) : '—',
            translate(language, 'companion.finishedActsOnly'),
            'muted'
          )}
        </div>
      </section>

      <section className="companion-block act-times-card-list">
        <h3>{translate(language, 'companion.actSplitCards')}</h3>
        {renderActTimeCards(rows, emptyMessage, language)}
      </section>
    </div>
  );
}


function renderRunComparison(
  history: SavedRunHistoryEntry[],
  currentElapsedMs: number,
  currentRows: ActTimeRow[],
  language: AppLanguage
) {
  const bestRun = getBestSavedRun(history);

  if (!bestRun) {
    return (
      <section className="companion-block run-compare-card">
        <h3>{translate(language, 'companion.runCompareTitle')}</h3>
        <p className="helper-text">{translate(language, 'companion.runCompareEmpty')}</p>
      </section>
    );
  }

  const bestRows = getSavedRunActRows(bestRun);
  const bestRowsByAct = new Map(bestRows.map((row) => [row.act, row]));
  const currentRowsByAct = new Map(currentRows.map((row) => [row.act, row]));
  const acts = Array.from(new Set([...bestRowsByAct.keys(), ...currentRowsByAct.keys()])).sort((left, right) => left - right);

  return (
    <section className="companion-block run-compare-card">
      <div className="summary-section-heading">
        <h3>{translate(language, 'companion.runCompareTitle')}</h3>
        <span>{translate(language, 'companion.runCompareBestDate', { date: formatSavedRunDate(bestRun.savedAt, language) })}</span>
      </div>
      <div className="run-comparison-total">
        <span>{translate(language, 'companion.currentRunTime')}: <strong>{formatDuration(currentElapsedMs)}</strong></span>
        <span>{translate(language, 'companion.bestSavedRun')}: <strong>{formatDuration(bestRun.totalElapsedMs)}</strong></span>
        <span className={currentElapsedMs <= bestRun.totalElapsedMs ? 'delta-good' : 'delta-bad'}>
          {translate(language, 'companion.delta')}: <strong>{formatDelta(currentElapsedMs - bestRun.totalElapsedMs)}</strong>
        </span>
      </div>
      {acts.length > 0 && (
        <div className="run-comparison-grid">
          {acts.map((act) => {
            const current = currentRowsByAct.get(act);
            const best = bestRowsByAct.get(act);
            const delta = current && best ? current.elapsedMs - best.elapsedMs : null;
            return (
              <div key={`run-compare-act-${act}`} className="run-comparison-act-row">
                <span>{formatActLabel(act, language)}</span>
                <strong>{current ? formatDuration(current.elapsedMs) : '—'}</strong>
                <small className={delta === null ? '' : delta <= 0 ? 'delta-good' : 'delta-bad'}>
                  {delta === null ? '—' : formatDelta(delta)}
                </small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function renderRunHistory(
  history: SavedRunHistoryEntry[],
  language: AppLanguage,
  onRestore: (runId: string) => void,
  onDelete: (runId: string) => void
) {
  return (
    <section className="companion-block run-history-card">
      <div className="summary-section-heading">
        <h3>{translate(language, 'companion.runHistoryTitle')}</h3>
        <span>{translate(language, 'companion.runHistoryCount', { count: history.length })}</span>
      </div>
      {history.length === 0 ? (
        <p className="helper-text">{translate(language, 'companion.runHistoryEmpty')}</p>
      ) : (
        <div className="run-history-list">
          {history.slice(0, 8).map((entry) => {
            const rows = getSavedRunActRows(entry);
            const slowestAct = getSlowestActRow(rows);
            const longestZone = entry.longestZones[0] ?? null;
            return (
              <article key={entry.id} className="run-history-item">
                <div>
                  <strong>{entry.label || translate(language, 'companion.savedRunFallback')}</strong>
                  <span>{formatSavedRunDate(entry.savedAt, language)}</span>
                </div>
                <div className="run-history-stats">
                  <span>{translate(language, 'companion.totalTime')}: <b>{formatDuration(entry.totalElapsedMs)}</b></span>
                  <span>{translate(language, 'companion.completedActs')}: <b>{getCompletedActCount(rows)} / {TOTAL_CAMPAIGN_ACTS}</b></span>
                  <span>{translate(language, 'companion.longestAct')}: <b>{slowestAct ? `${formatActLabel(slowestAct.act, language)} · ${formatDuration(slowestAct.elapsedMs)}` : '—'}</b></span>
                  <span>{translate(language, 'companion.longestZone')}: <b>{longestZone ? `${translateDataText(longestZone.zone_ru, language)} · ${formatDuration(longestZone.elapsedMs)}` : '—'}</b></span>
                </div>
                <div className="button-row run-history-actions">
                  <button type="button" className="button-secondary" onClick={() => onRestore(entry.id)}>
                    {translate(language, 'companion.continueSavedRun')}
                  </button>
                  <button type="button" className="button-danger" onClick={() => onDelete(entry.id)}>
                    {translate(language, 'companion.deleteSavedRun')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function renderStringSection(
  title: string,
  items: string[],
  className?: string
) {
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


function renderCompactReminderList(
  items: { id: string; level: number; title: string; items?: string[] }[],
  language: AppLanguage,
  limit?: number,
  highlightedId?: string | null
) {
  const visible = typeof limit === 'number' ? items.slice(0, limit) : items;

  if (visible.length === 0) {
    return <p className="helper-text">{translate(language, 'companion.remindersEmpty')}</p>;
  }

  return (
    <ul className="reminder-list">
      {visible.map((entry) => {
        const isHighlighted = highlightedId === entry.id;

        return (
          <li key={entry.id} className={`reminder-item ${isHighlighted ? 'is-nearest' : ''}`}>
            <div className="reminder-line">
              <span className="reminder-level">{translate(language, 'common.level')} {entry.level}</span>
              <span className="reminder-title">{translateDataText(entry.title, language)}</span>
              {isHighlighted && <span className="reminder-badge">{translate(language, 'overlay.currentBadge')}</span>}
            </div>
            {entry.items && entry.items.length > 0 && (
              <ul className="reminder-sublist">
                {entry.items.slice(0, 3).map((item) => (
                  <li key={`${entry.id}-${item}`}>{translateDataText(item, language)}</li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}


function renderPowerSpikeTimeline(
  items: { id: string; level: number; title: string; items?: string[] }[],
  language: AppLanguage,
  currentLevel: number | null,
  highlightedId?: string | null
) {
  const visible = [...items].sort((left, right) => left.level - right.level);

  if (visible.length === 0) {
    return <p className="helper-text">{translate(language, 'companion.remindersEmpty')}</p>;
  }

  return (
    <ol className="power-spike-timeline">
      {visible.map((entry) => {
        const isHighlighted = highlightedId === entry.id;
        const isPast = currentLevel !== null && entry.level < currentLevel;
        const isFuture = currentLevel !== null && entry.level > currentLevel;

        return (
          <li
            key={entry.id}
            className={[
              'power-spike-timeline-item',
              isHighlighted ? 'is-nearest' : '',
              isPast ? 'is-past' : '',
              isFuture ? 'is-future' : ''
            ].filter(Boolean).join(' ')}
          >
            <div className="power-spike-timeline-node" aria-hidden="true">
              <span className="power-spike-timeline-level">{entry.level}</span>
            </div>
            <div className="power-spike-timeline-card">
              <div className="power-spike-timeline-header">
                <span className="power-spike-timeline-label">
                  {translate(language, 'common.level')} {entry.level}
                </span>
                {isHighlighted && <span className="reminder-badge">{translate(language, 'overlay.currentBadge')}</span>}
              </div>
              <strong>{translateDataText(entry.title, language)}</strong>
              {entry.items && entry.items.length > 0 && (
                <ul className="power-spike-timeline-list">
                  {entry.items.slice(0, 3).map((item) => (
                    <li key={`${entry.id}-${item}`}>{translateDataText(item, language)}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function renderDetails(
  details: GuideEntry['details'] | ReturnType<typeof getGuideView>['details'],
  language: AppLanguage
) {
  if (!details) {
    return null;
  }

  if (Array.isArray(details)) {
    return renderStringSection(
      translate(language, 'companion.detailsTitle'),
      details.filter(Boolean).map((item) => translateDataText(item, language))
    );
  }

  if (typeof details === 'object') {
    const duplicatedSectionKeys = new Set([
      'route',
      'rewards',
      'skip',
      'important',
      'after',
      'boss_tips',
      'xp_notes',
      'crafting_tips'
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
                {(value as string[]).map((item) => (
                  <li key={`${key}-${item}`} className={getGuideUpdateClassName(translateDataText(item, language)).trim()}>
                    {translateDataText(item, language)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return null;
}


function formatBonusAct(act: ZoneAct, language: AppLanguage): string {
  return act === 'interlude'
    ? translate(language, 'companion.interludes')
    : translate(language, 'route.act', { act });
}

function getBonusCategoryLabel(
  category: CampaignBonusDefinition['category'],
  language: AppLanguage
): string {
  switch (category) {
    case 'weapon_set_passive':
      return translate(language, 'companion.bonusCategories.weapon_set_passive');
    case 'resistance':
      return translate(language, 'companion.bonusCategories.resistance');
    case 'spirit':
      return translate(language, 'companion.bonusCategories.spirit');
    case 'life':
      return translate(language, 'companion.bonusCategories.life');
    case 'mana':
      return translate(language, 'companion.bonusCategories.mana');
    case 'choice':
      return translate(language, 'companion.bonusCategories.choice');
    case 'utility':
      return translate(language, 'companion.bonusCategories.utility');
    default:
      return translate(language, 'companion.bonusCategories.default');
  }
}

function isBonusDone(
  bonus: CampaignBonusDefinition,
  progress: Record<string, CampaignBonusProgress>
): boolean {
  return Boolean(progress[bonus.id]);
}

function getCampaignBonusTotals(
  bonuses: CampaignBonusDefinition[],
  progress: Record<string, CampaignBonusProgress>
) {
  const totals = {
    weaponSetPassivePoints: 0,
    coldResistance: 0,
    fireResistance: 0,
    lightningResistance: 0,
    spirit: 0,
    flatLife: 0,
    increasedLife: 0,
    increasedMana: 0,
    choiceDone: 0,
    choiceTotal: 0,
    done: 0,
    total: bonuses.length
  };

  for (const bonus of bonuses) {
    const done = isBonusDone(bonus, progress);

    if (bonus.category === 'choice') {
      totals.choiceTotal += 1;
      if (done) totals.choiceDone += 1;
    }

    if (!done) {
      continue;
    }

    totals.done += 1;
    const value = Number(bonus.reward.value) || 0;

    switch (bonus.reward.type) {
      case 'weapon_set_passive_points':
        totals.weaponSetPassivePoints += value;
        break;
      case 'cold_resistance':
        totals.coldResistance += value;
        break;
      case 'fire_resistance':
        totals.fireResistance += value;
        break;
      case 'lightning_resistance':
        totals.lightningResistance += value;
        break;
      case 'all_elemental_resistance':
        totals.coldResistance += value;
        totals.fireResistance += value;
        totals.lightningResistance += value;
        break;
      case 'spirit':
        totals.spirit += value;
        break;
      case 'flat_life':
        totals.flatLife += value;
        break;
      case 'increased_life':
        totals.increasedLife += value;
        break;
      case 'increased_mana':
        totals.increasedMana += value;
        break;
    }
  }

  return totals;
}

function normalizeZoneBonusName(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

function renderSummary(summary: RunSummary | null, language: AppLanguage) {
  if (!summary) {
    return <p className="helper-text">{translate(language, 'companion.summaryEmpty')}</p>;
  }

  const actTimeRows = getActTimeRowsFromSplits(summary.actSplits, summary.totalElapsedMs);
  const completedActCount = getCompletedActCount(actTimeRows);
  const slowestAct = getSlowestActRow(actTimeRows);

  return (
    <div className="summary-dashboard">
      <section className="companion-block summary-hero-card">
        <div>
          <h3>{translate(language, 'companion.summaryTitle')}</h3>
          <p className="helper-text">{translate(language, 'companion.summaryFinishedIntro')}</p>
        </div>
        <div className="run-metric-grid">
          {renderMetricCard(translate(language, 'companion.totalTime'), formatDuration(summary.totalElapsedMs), translate(language, 'companion.finalTime'), 'accent')}
          {renderMetricCard(translate(language, 'companion.completedActs'), `${completedActCount} / ${TOTAL_CAMPAIGN_ACTS}`, translate(language, 'companion.completedActsHint'))}
          {renderMetricCard(translate(language, 'companion.pauses'), String(summary.pauseCount), translate(language, 'companion.pauseCountHint'), 'muted')}
          {renderMetricCard(
            translate(language, 'companion.record'),
            summary.isNewPb ? translate(language, 'companion.newRecord') : translate(language, 'companion.noRecordUpdate'),
            translate(language, 'companion.recordHint')
          )}
        </div>
      </section>

      <section className="companion-block act-times-card-list">
        <h3>{translate(language, 'common.actTimes')}</h3>
        {renderActTimeCards(actTimeRows, translate(language, 'companion.actTimesEmptyFinished'), language)}
      </section>

      <section className="companion-block summary-longest-card">
        <div className="summary-section-heading">
          <h3>{translate(language, 'companion.longestZones')}</h3>
          {slowestAct && <span>{translate(language, 'companion.longestActShort', { act: formatActLabel(slowestAct.act, language), time: formatDuration(slowestAct.elapsedMs) })}</span>}
        </div>
        {renderLongestZoneList(summary.longestZones, language, translate(language, 'companion.zoneHistoryEmpty'))}
      </section>
    </div>
  );
}

export function CompanionPage() {
  const snapshot = useAppSnapshot();
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const liveRunTimer = useLiveRunTimer(
    snapshot?.config.runTimer,
    snapshot?.config.runTimerSettings,
    snapshot?.runtime.timerNowMs,
    32,
    snapshot ? {
      overlayMode: snapshot.runtime.overlayMode,
      zoneName: snapshot.currentGuideEntry?.zone_ru ?? snapshot.currentZone.rawZoneName ?? null,
      act: snapshot.currentGuideEntry?.act ?? snapshot.currentZone.actHint ?? null,
      component: 'companion-live-timer'
    } : undefined
  );
  const [activeTab, setActiveTab] = useState<CompanionTab>('zone');
  const [selectedAct, setSelectedAct] = useState<ZoneAct | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [runSaveNotice, setRunSaveNotice] = useState<string | null>(null);
  const [runConfirmDialog, setRunConfirmDialog] = useState<RunConfirmDialog>(null);

  useDocumentTitle(t('titles.companion'));

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    const currentAct = getCurrentRouteAct(snapshot);
    const availableActs = new Set(getRouteActs(snapshot, language).map((entry) => entry.act));
    if (selectedAct === null || !availableActs.has(selectedAct)) {
      setSelectedAct(currentAct);
    }
  }, [snapshot, selectedAct, language]);

  useEffect(() => {
    const unsubscribe = window.poe2Overlay.onRunResetConfirmationRequested(() => {
      setActiveTab('timer');
      setRunConfirmDialog({ type: 'reset' });
    });

    return unsubscribe;
  }, []);

  if (!snapshot) {
    return <div className="settings-shell">{t('companion.loading')}</div>;
  }

  const { config, currentGuideEntry, currentZone, activeLevelReminder } =
    snapshot;
  const displayRunTimer = liveRunTimer.runTimer ?? config.runTimer;
  const nowAct = getCurrentRouteAct(snapshot);
  const guide = currentGuideEntry;
  const guideView = getGuideView(guide, language);
  const guideChecklist = guideView?.checklist ?? [];
  const sceneName = getSceneDisplayName(snapshot, language);
  const routeActs = getRouteActs(snapshot, language);
  const routeZones = getRouteOverviewForAct(snapshot, selectedAct ?? nowAct, language);
  const xpStatus = getXpStatus(snapshot, language);
  const countdownMs = liveRunTimer.countdownMs;
  const currentRunElapsed = liveRunTimer.runElapsedMs;
  const currentNumericAct = typeof nowAct === 'number' ? nowAct : null;
  const currentActElapsed = getCurrentActElapsedMsForAct(
    displayRunTimer,
    currentNumericAct,
    liveRunTimer.nowMs
  );
  const nearestPowerSpike = getNearestPowerSpike(
    snapshot.powerSpikes,
    config.currentLevel,
    config.guideProfile,
    99
  );
  const visibleActiveLevelReminder =
    activeLevelReminder && (config.currentLevel === null || activeLevelReminder.level >= config.currentLevel)
      ? activeLevelReminder
      : null;
  const upcomingVendorReminders = getUpcomingVendorReminders(
    snapshot.vendorCheckpoints,
    config.currentLevel
  );
  const dismissedReminders = getDismissedReminderHistory(
    snapshot.vendorCheckpoints,
    config.levelRemindersState.dismissed
  );
  const longestZones = getLongestZones(config.zoneTimeHistory);
  const campaignBonusProgress = config.campaignBonusProgress ?? {};
  const campaignBonusTotals = getCampaignBonusTotals(
    snapshot.campaignBonuses,
    campaignBonusProgress
  );
  const runHistory = config.runHistory ?? [];
  const currentZoneBonuses = getCurrentZoneCampaignBonuses(snapshot);
  const localizedCurrentZoneBonuses = currentZoneBonuses.map(({ bonus, done }) => ({
    bonus: getCampaignBonusView(bonus, language) ?? bonus,
    done
  }));
  const actTimeRows = getActTimeRowsFromSplits(displayRunTimer.actSplits, currentRunElapsed, {
    currentAct: currentNumericAct,
    includeCurrentAct: displayRunTimer.status === 'running' || displayRunTimer.status === 'paused',
    currentStatus: displayRunTimer.status
  });
  const hasNoGuideForKnownZone =
    !guide &&
    Boolean(currentZone.rawZoneName) &&
    (
      currentZone.sceneKind === 'unknown' ||
      currentZone.sceneKind === 'gameplay' ||
      currentZone.sceneKind === 'town'
    );

  const runTask = async (name: string, action: () => Promise<unknown>) => {
    try {
      setBusy(name);
      return await action();
    } finally {
      setBusy(null);
    }
  };

  const hasRunDataToSave = currentRunElapsed > 0 || displayRunTimer.actSplits.length > 0 || config.zoneTimeHistory.length > 0;

  const createDefaultRunLabel = () =>
    `${t('companion.savedRunFallback')} · ${new Date().toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')}`;

  const saveCurrentRun = async () => {
    if (!hasRunDataToSave) {
      return;
    }

    const label = createDefaultRunLabel();
    await runTask('save-run', async () => {
      await window.poe2Overlay.saveCurrentRunToHistory(label);
    });
    setRunSaveNotice(t('companion.runSavedNotice'));
  };

  const resetRunWithoutSaving = async () => {
    await runTask('reset-run', async () => {
      await window.poe2Overlay.resetRunTimer();
    });
  };

  const saveAndResetRun = async () => {
    const defaultLabel = createDefaultRunLabel();
    await runTask('save-and-reset-run', async () => {
      await window.poe2Overlay.saveCurrentRunToHistory(defaultLabel);
      await window.poe2Overlay.resetRunTimer();
    });
    setRunSaveNotice(t('companion.runSavedAndResetNotice'));
  };

  const resetRunWithOptionalSave = async () => {
    if (!hasRunDataToSave) {
      await resetRunWithoutSaving();
      return;
    }

    setRunConfirmDialog({ type: 'reset' });
  };

  const restoreSavedRun = async (runId: string) => {
    setRunConfirmDialog({ type: 'restore', runId });
  };

  const deleteSavedRun = async (runId: string) => {
    setRunConfirmDialog({ type: 'delete', runId });
  };

  const closeRunConfirmDialog = () => setRunConfirmDialog(null);

  const confirmRestoreSavedRun = async (runId: string) => {
    await runTask('restore-run', async () => {
      await window.poe2Overlay.restoreSavedRun(runId);
    });
  };

  const confirmDeleteSavedRun = async (runId: string) => {
    await runTask('delete-run', async () => {
      await window.poe2Overlay.deleteSavedRun(runId);
    });
  };

  const openExternalLink = async (name: string, url: string) => {
    await runTask(name, async () => {
      await window.poe2Overlay.openExternal(url);
    });
  };

  const focusCurrentZone = () => {
    if (nowAct !== null) {
      setSelectedAct(nowAct);
    }

    window.requestAnimationFrame(() => {
      const currentZoneId = snapshot.currentGuideEntry?.id;
      if (!currentZoneId) {
        return;
      }

      document.getElementById(`route-zone-${currentZoneId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    });
  };

  const zoneTab = (
    <div className="companion-tab-layout companion-zone-polished-layout">
      <section className="companion-block companion-overview-card zone-hero-card">
        <div className="zone-hero-copy">
          <p className="eyebrow">{guide ? formatActTitle(guide.act, language) : t('companion.currentScene')}</p>
          <h3>{sceneName}</h3>
          <p className="helper-text">
            {guideView?.nextZoneName
              ? t('companion.routeNextPrefix', { text: guideView.nextZoneName })
              : currentZone.sceneKind === 'town'
                ? t('companion.sceneTownHub')
                : t('companion.sceneGameplay')}
          </p>
        </div>
        <dl className="zone-hero-metrics">
          <div className="zone-metric-card is-accent">
            <dt>{t('companion.nextZone')}</dt>
            <dd>{guideView?.nextZoneName ?? t('common.notAvailable')}</dd>
          </div>
          <div className="zone-metric-card">
            <dt>{t('companion.levelRec')}</dt>
            <dd>{t('common.level')} {config.currentLevel ?? '?'} · {guideView?.recommendedLevelLabel ?? t('common.notAvailable')}</dd>
          </div>
          <div className="zone-metric-card">
            <dt>{t('companion.experience')}</dt>
            <dd>{xpStatus.longLabel}</dd>
          </div>
          <div className="zone-metric-card">
            <dt>{t('companion.sceneLabel')}</dt>
            <dd>{currentZone.sceneKind === 'town' ? t('companion.sceneTownHub') : t('companion.sceneGameplay')}</dd>
          </div>
        </dl>
      </section>

      <div className="companion-zone-dashboard zone-card-board">
        <div className="companion-column zone-main-column">
          <section className="companion-block zone-task-card zone-task-primary">
            <div className="zone-section-heading">
              <h3>{t('overlay.inThisZone')}</h3>
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
                {hasNoGuideForKnownZone ? t('companion.noGuideKnown') : t('overlay.emptyZoneNotes')}
              </p>
            )}
          </section>

          {localizedCurrentZoneBonuses.length > 0 && (
            <section className="companion-block zone-bonuses-card zone-task-card">
              <div className="zone-section-heading">
                <h3>{t('overlay.zoneBonuses')}</h3>
                <span>{localizedCurrentZoneBonuses.filter(({ done }) => done).length}/{localizedCurrentZoneBonuses.length}</span>
              </div>
              <ul className="details-list zone-bonus-details-list">
                {localizedCurrentZoneBonuses.map(({ bonus, done }) => (
                  <li key={bonus.id} className={done ? 'bonus-line is-done' : 'bonus-line'}>
                    <span className="bonus-state-marker">{done ? '✓' : '○'}</span>
                    <span>{'displayTitle' in bonus ? bonus.displayTitle : bonus.title}</span>
                  </li>
                ))}
              </ul>
              <p className="helper-text compact-helper-text">{t('companion.zoneBonusesHint')}</p>
            </section>
          )}

          {renderStringSection(t('common.next'), guideView?.nextZoneName ? [guideView.nextZoneName] : [], 'zone-task-card zone-next-card')}
          {renderStringSection(t('common.skip'), guideView?.skip ?? [], 'skip-section zone-task-card')}
        </div>

        <div className="companion-column">
          {renderStringSection(t('companion.take'), guideView?.rewards ?? [], 'zone-task-card zone-reward-card')}
          {renderStringSection(t('common.important'), guideView?.important ?? [], 'zone-task-card zone-important-card')}
          {renderStringSection(t('common.bossTips'), guideView?.bossTips ?? [], 'zone-task-card')}
        </div>

        <div className="companion-column">
          {renderStringSection(t('common.xpNotes'), guideView?.xpNotes ?? [], 'zone-task-card')}
          {renderStringSection(t('common.craftingTips'), guideView?.craftingTips ?? [], 'zone-task-card')}
          {renderStringSection(t('common.after'), guideView?.after ?? [], 'zone-task-card')}
          {renderDetails(guideView?.details ?? guide?.details, language)}
        </div>
      </div>
    </div>
  );

  const routeTab = (
    <div className="companion-tab-layout">
      <section className="companion-block companion-route-toolbar">
        <div className="companion-tab-row">
          {routeActs.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={selectedAct === entry.act ? 'button-primary' : 'button-secondary'}
              onClick={() => setSelectedAct(entry.act)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <div className="button-row">
          <button type="button" className="button-secondary" onClick={focusCurrentZone}>
            {t('companion.focusCurrentZone')}
          </button>
        </div>
      </section>

      <section className="companion-block companion-route-list-card">
        <h3>{formatActTitle(selectedAct ?? nowAct, language)}</h3>
        <div className="route-overview-list route-overview-grid">
          {routeZones.map((entry, index) => {
            const rewardLabels = getRequiredRewardLabelsForZone(entry.guide, snapshot, language);
            const fallbackLabels = rewardLabels.length > 0 ? [] : getRouteFallbackLabels(entry.guide, language);
            const routeLabels = rewardLabels.length > 0 ? rewardLabels : fallbackLabels;
            const visibleRouteLabels = routeLabels.slice(0, ROUTE_OVERVIEW_VISIBLE_ITEMS);
            const hiddenRouteLabelsCount = Math.max(0, routeLabels.length - visibleRouteLabels.length);
            const statusLabel = getRouteStatusLabel(entry.status, language);
            const routeCardTitle = formatRouteCardTitle(entry.guide, language);
            const routeGuideView = getGuideView(entry.guide, language);

            return (
              <article
                id={`route-zone-${entry.guide.id}`}
                key={entry.guide.id}
                className={`route-overview-card status-${entry.status}`}
              >
                <div className="route-overview-header">
                  <span className="route-step-index">{String(index + 1).padStart(2, '0')}</span>
                  <strong className="route-zone-name">{routeCardTitle}</strong>
                  <span className="route-rec-badge">{t('companion.routeCardLevel', { level: routeGuideView?.recommendedLevelLabel ?? formatRecommendedLevelLabel(entry.guide, language) })}</span>
                  {statusLabel && <span className="route-state-pill">{statusLabel}</span>}
                </div>

                {visibleRouteLabels.length > 0 ? (
                  <>
                    <ul className="details-list compact-reward-list">
                      {visibleRouteLabels.map((item) => (
                        <li key={`${entry.guide.id}-${item}`}>{item}</li>
                      ))}
                    </ul>
                    {hiddenRouteLabelsCount > 0 && (
                      <p className="route-more-note">{t('companion.routeMore', { count: hiddenRouteLabelsCount })}</p>
                    )}
                  </>
                ) : (
                  <p className="route-empty-note">{t('companion.routeEmpty')}</p>
                )}

                {entry.missedItems.length > 0 && (
                  <p className="warning-inline route-warning-inline">
                    {t('companion.missedInline', {
                      items: entry.missedItems
                        .slice(0, 2)
                        .map((item) => translateDataText(item.text, language))
                        .join(', ')
                    })}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );

  const timerTab = (
    <div className="companion-tab-layout timer-polished-layout">
      <section className="companion-block timer-hero-card">
        <div className="timer-hero-copy">
          <p className="eyebrow">{t('companion.timerTitle')}</p>
          <h3>{formatDuration(currentRunElapsed)}</h3>
          <p className="helper-text">{t('companion.timerDescription')}</p>
        </div>
        <div className="timer-metric-grid">
          {renderMetricCard(t('companion.totalTime'), formatDuration(currentRunElapsed), t('companion.totalTimeHint'), 'accent')}
          {renderMetricCard(t('settings.actTime'), currentActElapsed === null ? '—' : formatDuration(currentActElapsed), nowAct === null ? t('companion.noCurrentAct') : formatActTitle(nowAct, language))}
          {renderMetricCard(t('common.status'), formatRunStatus(displayRunTimer.status, language), currentZone.sceneKind === 'town' ? t('companion.sceneTownHub') : t('companion.sceneGameplay'))}
          {renderMetricCard(t('settings.countdown'), countdownMs === null ? '—' : formatDuration(countdownMs), countdownMs === null ? t('common.notAvailable') : t('settings.countdown'), 'muted')}
        </div>
      </section>

      <section className="companion-block timer-control-card">
        <div className="timer-control-copy">
          <h3>{t('companion.runControlsTitle')}</h3>
          <p className="helper-text">{t('companion.runControlsIntro')}</p>
        </div>
        <div className="timer-action-grid">
          {displayRunTimer.status === 'running' ? (
            <button
              type="button"
              className="button-secondary timer-action-button"
              disabled={busy !== null}
              onClick={() =>
                runTask('pause-run', async () => {
                  await window.poe2Overlay.pauseRunTimer();
                })
              }
            >
              {t('common.pause')}
            </button>
          ) : displayRunTimer.status === 'paused' ? (
            <button
              type="button"
              className="button-primary timer-action-button"
              disabled={busy !== null}
              onClick={() =>
                runTask('resume-run', async () => {
                  await window.poe2Overlay.resumeRunTimer();
                })
              }
            >
              {t('common.resume')}
            </button>
          ) : (
            <button
              type="button"
              className="button-primary timer-action-button"
              disabled={busy !== null}
              onClick={() =>
                runTask('start-run', async () => {
                  await window.poe2Overlay.startRunTimer();
                })
              }
            >
              {t('common.start')}
            </button>
          )}
          <button
            type="button"
            className="button-secondary timer-action-button"
            disabled={busy !== null}
            onClick={() =>
              runTask('finish-run', async () => {
                await window.poe2Overlay.finishRunTimer();
              })
            }
          >
            {t('common.finish')}
          </button>
          <button
            type="button"
            className="button-danger timer-action-button"
            disabled={busy !== null}
            onClick={resetRunWithOptionalSave}
          >
            {t('common.reset')}
          </button>
        </div>
      </section>
    </div>
  );

  const actTimesTab = (
    <div className="companion-tab-layout">
      {renderActTimesDashboard(
        actTimeRows,
        currentRunElapsed,
        displayRunTimer.status === 'finished'
          ? t('companion.actTimesEmptyFinished')
          : t('companion.actTimesEmptyRunning'),
        language
      )}
      <section className="companion-block run-save-card">
        <div>
          <h3>{t('companion.runSaveTitle')}</h3>
          <p className="helper-text">{t('companion.runSaveIntro')}</p>
        </div>
        <div className="run-save-actions">
          <div className="button-row">
            <button
              type="button"
              className="button-primary"
              disabled={busy !== null || !hasRunDataToSave}
              onClick={saveCurrentRun}
            >
              {busy === 'save-run' ? t('common.saving') : t('companion.saveCurrentRun')}
            </button>
            <button type="button" className="button-danger" disabled={busy !== null} onClick={resetRunWithOptionalSave}>
              {t('overlay.resetTimer')}
            </button>
          </div>
          {runSaveNotice ? <p className="helper-text run-save-notice">{runSaveNotice}</p> : null}
        </div>
      </section>
    </div>
  );

  const reminderFlasks = snapshot.vendorCheckpoints.filter((entry) => entry.type === 'flasks');
  const reminderBases = snapshot.vendorCheckpoints.filter((entry) => entry.type === 'weapon_armor_bases');
  const filteredPowerSpikes = snapshot.powerSpikes.filter(
    (entry) => !entry.profiles || entry.profiles.includes(config.guideProfile)
  );

  const remindersTab = (
    <div className="companion-tab-layout reminders-tab-layout">
      <div className="reminders-dashboard-grid">
        <section className="companion-block reminders-card reminders-card-nearest">
          <h3>{t('companion.nearest')}</h3>
          {renderCompactReminderList([
            ...(visibleActiveLevelReminder ? [visibleActiveLevelReminder] : []),
            ...upcomingVendorReminders.slice(0, 2),
            ...(nearestPowerSpike ? [nearestPowerSpike] : [])
          ], language, 4, visibleActiveLevelReminder?.id ?? null)}
        </section>

        <section className="companion-block reminders-card">
          <h3>{t('companion.flasks')}</h3>
          {renderCompactReminderList(reminderFlasks, language)}
        </section>

        <section className="companion-block reminders-card reminders-card-wide">
          <h3>{t('companion.gearBases')}</h3>
          <div className="reminder-chip-grid">
            {reminderBases.map((entry) => (
              <div key={entry.id} className="reminder-chip">
                <span>{t('common.level')} {entry.level}</span>
                <strong>{translateDataText(entry.title, language)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="companion-block reminders-card reminders-card-wide reminders-power-spikes-card">
          <h3>{t('companion.powerSpikes')}</h3>
          {renderPowerSpikeTimeline(filteredPowerSpikes, language, config.currentLevel, nearestPowerSpike?.id ?? null)}
        </section>
      </div>

      {dismissedReminders.length > 0 && (
        <section className="companion-block reminders-dismissed-card">
          <h3>{t('companion.dismissedReminders')}</h3>
          {renderCompactReminderList(dismissedReminders, language)}
        </section>
      )}
    </div>
  );

  const bonusGroups = snapshot.campaignBonuses.reduce<Record<string, CampaignBonusDefinition[]>>(
    (groups, bonus) => {
      const key = bonus.act === 'interlude' ? 'interlude' : String(bonus.act);
      groups[key] = [...(groups[key] ?? []), bonus];
      return groups;
    },
    {}
  );

  const bonusGroupOrder = Object.keys(bonusGroups).sort((left, right) => {
    if (left === 'interlude') return 1;
    if (right === 'interlude') return -1;
    return Number(left) - Number(right);
  });

  const bonusesTab = (
    <div className="companion-tab-layout bonuses-tab-layout">
      <section className="companion-block bonuses-summary-card">
        <h3>{t('companion.bonusesTitle')}</h3>
        <dl className="info-grid companion-info-grid bonuses-summary-grid">
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.weapon_set_passive')}</dt>
            <dd>{campaignBonusTotals.weaponSetPassivePoints} / 24</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.cold')}</dt>
            <dd>{campaignBonusTotals.coldResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.fire')}</dt>
            <dd>{campaignBonusTotals.fireResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.lightning')}</dt>
            <dd>{campaignBonusTotals.lightningResistance} / 20%</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.spirit')}</dt>
            <dd>{campaignBonusTotals.spirit} / 100</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.life')}</dt>
            <dd>{t('companion.lifeSummary', {
              flat: campaignBonusTotals.flatLife,
              percent: campaignBonusTotals.increasedLife
            })}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('companion.bonusCategories.mana')}</dt>
            <dd>{t('companion.manaSummary', {
              percent: campaignBonusTotals.increasedMana
            })}</dd>
          </div>
          <div className="info-cell">
            <dt>{t('common.summary')}</dt>
            <dd>{campaignBonusTotals.done} / {campaignBonusTotals.total}</dd>
          </div>
        </dl>
        <p className="helper-text">{t('companion.bonusSummaryHelp')}</p>
        <div className="button-row">
          <button
            type="button"
            className="button-secondary"
            disabled={busy !== null}
            onClick={() =>
              runTask('reset-campaign-bonuses', async () => {
                await window.poe2Overlay.resetCampaignBonuses();
              })
            }
          >
            {t('companion.resetBonusMarks')}
          </button>
        </div>
      </section>

      <div className="bonuses-act-grid">
        {bonusGroupOrder.map((groupKey) => {
          const bonuses = bonusGroups[groupKey] ?? [];
          const title = groupKey === 'interlude' ? t('companion.interludes') : t('route.act', { act: groupKey });

          return (
            <section key={groupKey} className="companion-block bonuses-act-card">
              <h3>{title}</h3>
              <div className="bonuses-list">
                {bonuses.map((bonus) => {
                  const progress = campaignBonusProgress[bonus.id];
                  const done = Boolean(progress);
                  const bonusView = getCampaignBonusView(bonus, language) ?? bonus;

                  return (
                    <article key={bonus.id} className={`bonus-row ${done ? 'is-done' : 'is-pending'}`}>
                      <div className="bonus-status-marker" aria-hidden="true">
                        {done ? '✓' : '○'}
                      </div>
                      <div className="bonus-main">
                        <div className="bonus-title-line">
                          <strong>{'displayTitle' in bonusView ? bonusView.displayTitle : bonus.title}</strong>
                          <span className="bonus-category-pill">{getBonusCategoryLabel(bonus.category, language)}</span>
                          {bonus.needsVerification && (
                            <span className="bonus-verify-pill">{t('companion.verify')}</span>
                          )}
                        </div>
                        <p className="bonus-meta">
                          {('displayZoneName' in bonusView ? bonusView.displayZoneName : bonus.zone_ru)} · {('displaySource' in bonusView ? bonusView.displaySource : bonus.source)}
                        </p>
                        {bonus.details.length > 0 && (
                          <ul className="bonus-details-list">
                            {(('displayDetails' in bonusView ? bonusView.displayDetails : bonus.details) as string[]).slice(0, 2).map((detail) => (
                              <li key={`${bonus.id}-${detail}`}>{detail}</li>
                            ))}
                          </ul>
                        )}
                        {progress && (
                          <p className="bonus-detected-line">
                            {t('companion.markedBy', {
                              method: progress.detectedBy === 'manual' ? t('companion.markedManually') : t('companion.markedByLog'),
                              time: new Date(progress.timestamp).toLocaleTimeString(language === 'en' ? 'en-US' : 'ru-RU')
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={done ? 'button-secondary bonus-toggle-button' : 'button-primary bonus-toggle-button'}
                        disabled={busy !== null}
                        onClick={() =>
                          runTask(`campaign-bonus-${bonus.id}`, async () => {
                            await window.poe2Overlay.setCampaignBonusDone(bonus.id, !done);
                          })
                        }
                      >
                        {done ? t('companion.clearMark') : t('companion.markDone')}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  const summaryHero = displayRunTimer.status === 'finished' ? (
    renderSummary(config.lastRunSummary, language)
  ) : (
    <div className="summary-dashboard">
      <section className="companion-block summary-hero-card">
        <div>
          <h3>{t('companion.summaryLiveTitle')}</h3>
          <p className="helper-text">{t('companion.summaryLiveIntro')}</p>
        </div>
        <div className="run-metric-grid">
          {renderMetricCard(t('companion.totalTime'), formatDuration(currentRunElapsed), formatRunStatus(displayRunTimer.status, language), 'accent')}
          {renderMetricCard(t('companion.completedActs'), `${getCompletedActCount(actTimeRows)} / ${TOTAL_CAMPAIGN_ACTS}`, t('companion.completedActsHint'))}
          {renderMetricCard(t('companion.currentAct'), nowAct === null ? '—' : formatActTitle(nowAct, language), currentActElapsed !== null ? formatDuration(currentActElapsed) : t('common.notAvailable'))}
          {renderMetricCard(t('companion.longestZone'), longestZones[0] ? formatDuration(longestZones[0].elapsedMs) : '—', longestZones[0] ? translateDataText(longestZones[0].zone_ru, language) : t('companion.zoneHistoryEmpty'), 'muted')}
        </div>
      </section>
    </div>
  );

  const summaryTab = (
    <div className="companion-tab-layout companion-summary-layout">
      <div className="summary-scroll-body summary-scroll-body--full">
        {summaryHero}

        <div className="summary-meta-grid">
          <section className="companion-block summary-best-card">
            <h3>{t('companion.bestRun')}</h3>
            {config.bestRun ? (
              <div className="best-run-card">
                <strong>{formatDuration(config.bestRun.totalElapsedMs)}</strong>
                <span>{new Date(config.bestRun.finishedAt).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')}</span>
              </div>
            ) : (
              <div className="summary-empty-state">
                <p className="helper-text">{t('companion.bestRunEmpty')}</p>
              </div>
            )}
          </section>

          <section className="companion-block summary-longest-card">
            <h3>{t('companion.longestZones')}</h3>
            {renderLongestZoneList(longestZones, language, t('companion.zoneHistoryEmpty'))}
          </section>
        </div>

        {renderRunComparison(runHistory, currentRunElapsed, actTimeRows, language)}
        {renderRunHistory(runHistory, language, restoreSavedRun, deleteSavedRun)}
      </div>
    </div>
  );


  const renderRunConfirmDialog = () => {
    if (!runConfirmDialog) {
      return null;
    }

    const dialogTitle = runConfirmDialog.type === 'reset'
      ? t('companion.resetDialogTitle')
      : runConfirmDialog.type === 'restore'
        ? t('companion.restoreDialogTitle')
        : t('companion.deleteDialogTitle');
    const dialogMessage = runConfirmDialog.type === 'reset'
      ? t('companion.resetDialogMessage')
      : runConfirmDialog.type === 'restore'
        ? t('companion.restoreDialogMessage')
        : t('companion.deleteDialogMessage');

    return (
      <div className="companion-modal-backdrop no-drag" role="presentation">
        <section className="companion-modal-card" role="dialog" aria-modal="true" aria-labelledby="run-confirm-title">
          <div className="companion-modal-header">
            <div>
              <p className="eyebrow">{t('companion.runDialogEyebrow')}</p>
              <h3 id="run-confirm-title">{dialogTitle}</h3>
            </div>
            <button className="button-secondary companion-modal-close" type="button" onClick={closeRunConfirmDialog}>
              ×
            </button>
          </div>
          <p className="helper-text companion-modal-message">{dialogMessage}</p>

          {runConfirmDialog.type === 'reset' ? (
            <div className="button-row companion-modal-actions">
              <button
                className="button-primary"
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  closeRunConfirmDialog();
                  void saveAndResetRun();
                }}
              >
                {t('companion.saveAndResetRun')}
              </button>
              <button
                className="button-danger"
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  closeRunConfirmDialog();
                  void resetRunWithoutSaving();
                }}
              >
                {t('companion.resetWithoutSaving')}
              </button>
              <button className="button-secondary" type="button" onClick={closeRunConfirmDialog}>
                {t('common.cancel')}
              </button>
            </div>
          ) : runConfirmDialog.type === 'restore' ? (
            <div className="button-row companion-modal-actions">
              <button
                className="button-primary"
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  const { runId } = runConfirmDialog;
                  closeRunConfirmDialog();
                  void confirmRestoreSavedRun(runId);
                }}
              >
                {t('companion.continueSavedRun')}
              </button>
              <button className="button-secondary" type="button" onClick={closeRunConfirmDialog}>
                {t('common.cancel')}
              </button>
            </div>
          ) : (
            <div className="button-row companion-modal-actions">
              <button
                className="button-danger"
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  const { runId } = runConfirmDialog;
                  closeRunConfirmDialog();
                  void confirmDeleteSavedRun(runId);
                }}
              >
                {t('companion.deleteSavedRun')}
              </button>
              <button className="button-secondary" type="button" onClick={closeRunConfirmDialog}>
                {t('common.cancel')}
              </button>
            </div>
          )}
        </section>
      </div>
    );
  };

  const tabContent = {
    zone: zoneTab,
    route: routeTab,
    timer: timerTab,
    actTimes: actTimesTab,
    reminders: remindersTab,
    bonuses: bonusesTab,
    summary: summaryTab
  } satisfies Record<CompanionTab, JSX.Element>;

  return (
    <main className="settings-page companion-page">
      <header className="settings-header window-drag-strip">
        <div className="settings-header-copy">
          <p className="eyebrow">{t('common.appName')}</p>
          <h1>{t('companion.title')}</h1>
          <p className="helper-text settings-intro">{t('companion.intro')}</p>
        </div>
        <div className="button-row no-drag companion-header-actions">
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-info', async () => {
                await window.poe2Overlay.openInfo();
              })
            }
          >
            {t('common.info')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-community', async () => {
                await window.poe2Overlay.openCommunity();
              })
            }
          >
            {t('common.community')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-support', async () => {
                await window.poe2Overlay.openSupport();
              })
            }
          >
            {t('common.support')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-settings', async () => {
                await window.poe2Overlay.openSettings();
              })
            }
          >
            {t('common.settings')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() =>
              runTask('open-report-issue', async () => {
                await window.poe2Overlay.openReportIssue();
              })
            }
          >
            {t('common.reportIssue')}
          </button>
          <button
            className="button-secondary"
            type="button"
            onClick={() => window.close()}
          >
            {t('common.close')}
          </button>
        </div>
      </header>

      <section className="settings-shell companion-shell">
        <section className="settings-card companion-card">
          <div className="companion-tab-row">
            {([
              ['zone', t('companion.tabs.zone')],
              ['route', t('companion.tabs.route')],
              ['timer', t('companion.tabs.timer')],
              ['actTimes', t('companion.tabs.actTimes')],
              ['reminders', t('companion.tabs.reminders')],
              ['bonuses', t('companion.tabs.bonuses')],
              ['summary', t('companion.tabs.summary')]
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                className={tab === activeTab ? 'button-primary' : 'button-secondary'}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="companion-tab-body">{tabContent[activeTab]}</div>
        </section>
      </section>
      {renderRunConfirmDialog()}
    </main>
  );
}
