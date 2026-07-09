import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translateDataText } from '../i18n/data';
import { translate } from '../i18n/translations';
import { isEndgameT15Act } from '../shared/timers';
import type { AppLanguage, SavedRunHistoryEntry } from '../shared/types';
import { formatDuration } from './utils';
import {
  buildRunHistoryDetailModel,
  formatRunHistoryDelta,
  getRunHistoryDeltaClass,
  type RunHistoryDetailModel
} from './run-history-detail';

type RunHistoryDetailPanelProps = {
  history: SavedRunHistoryEntry[];
  historySignature: string;
  language: AppLanguage;
  onRestore: (runId: string) => void;
  onDelete: (runId: string) => void;
};

const TOTAL_CAMPAIGN_ACTS = 5;
const DETAIL_MODEL_CACHE_LIMIT = 8;

function getDetailModelCacheKey(historySignature: string, runId: string): string {
  return `${historySignature}\u0000${runId}`;
}

function trimDetailModelCache(cache: Map<string, RunHistoryDetailModel>): void {
  while (cache.size > DETAIL_MODEL_CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (typeof firstKey !== 'string') {
      return;
    }

    cache.delete(firstKey);
  }
}

function formatSavedRunDate(timestamp: number, language: AppLanguage): string {
  return new Date(timestamp).toLocaleString(language === 'en' ? 'en-US' : 'ru-RU');
}

function formatNullableDate(timestamp: number | null, language: AppLanguage): string {
  return timestamp === null ? '—' : formatSavedRunDate(timestamp, language);
}

function formatActLabel(act: number, language: AppLanguage): string {
  return isEndgameT15Act(act)
    ? translate(language, 'route.endgameToT15')
    : translate(language, 'route.act', { act });
}

function getCompletedActCount(entry: SavedRunHistoryEntry): number {
  const acts = new Set<number>();

  for (const split of Array.isArray(entry.actSplits) ? entry.actSplits : []) {
    if (Number.isFinite(split.act) && !isEndgameT15Act(split.act)) {
      acts.add(split.act);
    }
  }

  return acts.size;
}

function getLongestZoneLabel(entry: SavedRunHistoryEntry, language: AppLanguage): string {
  const longestZone = (Array.isArray(entry.longestZones) ? entry.longestZones : [])[0] ?? null;
  return longestZone
    ? `${translateDataText(longestZone.zone_ru, language)} · ${formatDuration(longestZone.elapsedMs)}`
    : '—';
}

function renderDeltaCell(deltaMs: number | null) {
  return (
    <small className={getRunHistoryDeltaClass(deltaMs)}>
      {formatRunHistoryDelta(deltaMs)}
    </small>
  );
}

function RunHistoryDetailPlaceholder({ language }: { language: AppLanguage }) {
  return (
    <div className="run-history-detail-placeholder">
      <strong>{translate(language, 'companion.runHistoryDetailEmptyTitle')}</strong>
      <span>{translate(language, 'companion.runHistoryDetailEmptyText')}</span>
    </div>
  );
}

function RunHistoryDetailCard({
  model,
  language
}: {
  model: RunHistoryDetailModel;
  language: AppLanguage;
}) {
  if (!model.selectedRun) {
    return null;
  }

  return (
    <div className="run-history-detail-card">
      <div className="summary-section-heading">
        <h3>{translate(language, 'companion.runHistoryDetailTitle')}</h3>
        <span>{model.selectedRun.label || translate(language, 'companion.savedRunFallback')}</span>
      </div>

      <div className="run-history-detail-metrics">
        <div>
          <span>{translate(language, 'companion.totalTime')}</span>
          <strong>{formatDuration(model.selectedRun.totalElapsedMs)}</strong>
        </div>
        <div>
          <span>{translate(language, 'companion.savedAt')}</span>
          <strong>{formatSavedRunDate(model.selectedRun.savedAt, language)}</strong>
        </div>
        <div>
          <span>{translate(language, 'companion.startedAt')}</span>
          <strong>{formatNullableDate(model.startedAt, language)}</strong>
        </div>
        <div>
          <span>{translate(language, 'companion.finishedAt')}</span>
          <strong>{formatNullableDate(model.finishedAt, language)}</strong>
        </div>
        <div>
          <span>{translate(language, 'companion.previousRun')}</span>
          <strong>{model.previousRun ? formatRunHistoryDelta(model.selectedRun.totalElapsedMs - model.previousRun.totalElapsedMs) : '—'}</strong>
        </div>
        <div>
          <span>{translate(language, 'companion.bestSavedRun')}</span>
          <strong>{model.bestRun ? formatRunHistoryDelta(model.selectedRun.totalElapsedMs - model.bestRun.totalElapsedMs) : '—'}</strong>
        </div>
      </div>

      <div className="run-history-detail-grid">
        <div className="run-history-detail-table" role="table" aria-label={translate(language, 'companion.actBreakdownTitle')}>
          <div className="run-history-detail-table-head" role="row">
            <span role="columnheader">{translate(language, 'companion.actColumn')}</span>
            <span role="columnheader">{translate(language, 'companion.segmentTime')}</span>
            <span role="columnheader">{translate(language, 'companion.previousRunShort')}</span>
            <span role="columnheader">{translate(language, 'companion.bestRunShort')}</span>
          </div>
          {model.actRows.length === 0 ? (
            <p className="helper-text">{translate(language, 'companion.noActSplits')}</p>
          ) : model.actRows.map((row) => (
            <div key={`run-detail-act-${row.act}`} className="run-history-detail-table-row" role="row">
              <strong role="cell">{formatActLabel(row.act, language)}</strong>
              <span role="cell">{formatDuration(row.elapsedMs)}</span>
              <span role="cell">{renderDeltaCell(row.previousDeltaMs)}</span>
              <span role="cell">{renderDeltaCell(row.bestDeltaMs)}</span>
            </div>
          ))}
        </div>

        <div className="run-history-detail-table" role="table" aria-label={translate(language, 'companion.zoneBreakdownTitle')}>
          <div className="run-history-detail-table-head" role="row">
            <span role="columnheader">{translate(language, 'companion.zoneColumn')}</span>
            <span role="columnheader">{translate(language, 'companion.segmentTime')}</span>
            <span role="columnheader">{translate(language, 'companion.previousRunShort')}</span>
            <span role="columnheader">{translate(language, 'companion.bestRunShort')}</span>
          </div>
          {model.zoneRows.length === 0 ? (
            <p className="helper-text">{translate(language, 'companion.zoneHistoryEmpty')}</p>
          ) : model.zoneRows.map((row) => (
            <div key={`run-detail-zone-${row.zoneId}-${row.enteredAt}`} className="run-history-detail-table-row" role="row">
              <strong role="cell">{translateDataText(row.zone_ru, language)}</strong>
              <span role="cell">{formatDuration(row.elapsedMs)}</span>
              <span role="cell">{renderDeltaCell(row.previousDeltaMs)}</span>
              <span role="cell">{renderDeltaCell(row.bestDeltaMs)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RunHistoryDetailPanelInner({
  history,
  historySignature,
  language,
  onRestore,
  onDelete
}: RunHistoryDetailPanelProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailModelCacheRef = useRef<Map<string, RunHistoryDetailModel>>(new Map());
  const sortedHistory = useMemo(
    () => [...history].sort((left, right) => right.savedAt - left.savedAt),
    [history]
  );
  const visibleHistoryRows = useMemo(
    () => sortedHistory.slice(0, 8).map((entry) => ({
      entry,
      completedActCount: getCompletedActCount(entry),
      longestZoneLabel: getLongestZoneLabel(entry, language)
    })),
    [sortedHistory, language]
  );
  const model = useMemo(
    () => {
      if (!isDetailOpen || !selectedRunId) {
        return null;
      }

      const cacheKey = getDetailModelCacheKey(historySignature, selectedRunId);
      const cachedModel = detailModelCacheRef.current.get(cacheKey);
      if (cachedModel) {
        return cachedModel;
      }

      const nextModel = buildRunHistoryDetailModel(history, selectedRunId);
      detailModelCacheRef.current.set(cacheKey, nextModel);
      trimDetailModelCache(detailModelCacheRef.current);
      return nextModel;
    },
    [history, historySignature, selectedRunId, isDetailOpen]
  );
  const selectedRunIdFromModel = model?.selectedRun?.id ?? (isDetailOpen ? selectedRunId : null);

  const openRunDetails = useCallback((runId: string) => {
    setSelectedRunId(runId);
    setIsDetailOpen(true);
  }, []);

  useEffect(() => {
    for (const cacheKey of detailModelCacheRef.current.keys()) {
      if (!cacheKey.startsWith(`${historySignature}\u0000`)) {
        detailModelCacheRef.current.delete(cacheKey);
      }
    }
  }, [historySignature]);

  useEffect(() => {
    if (selectedRunId !== null && !history.some((entry) => entry.id === selectedRunId)) {
      setSelectedRunId(null);
      setIsDetailOpen(false);
    }
  }, [history, selectedRunId]);

  return (
    <section className={`companion-block summary-history-panel ${isDetailOpen ? 'is-detail-open' : ''}`}>
      <div className="summary-section-heading">
        <h3>{translate(language, 'companion.runHistoryTitle')}</h3>
        <span>{translate(language, 'companion.runHistoryCount', { count: history.length })}</span>
      </div>

      {sortedHistory.length === 0 ? (
        <p className="helper-text">{translate(language, 'companion.runHistoryEmpty')}</p>
      ) : (
        <div className="run-history-detail-layout">
          <div className="summary-history-list" aria-label={translate(language, 'companion.runHistoryTitle')}>
            {visibleHistoryRows.map(({ entry, completedActCount, longestZoneLabel }) => {
              const isSelected = isDetailOpen && entry.id === selectedRunIdFromModel;
              return (
                <article key={entry.id} className={`summary-history-row ${isSelected ? 'is-selected' : ''}`}>
                  <div className="summary-history-main">
                    <strong>{entry.label || translate(language, 'companion.savedRunFallback')}</strong>
                    <span>{formatSavedRunDate(entry.savedAt, language)}</span>
                  </div>
                  <div className="summary-history-stats">
                    <span><b>{formatDuration(entry.totalElapsedMs)}</b></span>
                    <span>{completedActCount} / {TOTAL_CAMPAIGN_ACTS}</span>
                    <span>{longestZoneLabel}</span>
                  </div>
                  <div className="button-row summary-history-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => openRunDetails(entry.id)}
                    >
                      {translate(language, 'companion.runHistoryDetails')}
                    </button>
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
          <aside className="run-history-detail-dock" aria-live="polite">
            {model ? <RunHistoryDetailCard model={model} language={language} /> : <RunHistoryDetailPlaceholder language={language} />}
          </aside>
        </div>
      )}
    </section>
  );
}

function areRunHistoryDetailPanelPropsEqual(
  previous: RunHistoryDetailPanelProps,
  next: RunHistoryDetailPanelProps
): boolean {
  return previous.historySignature === next.historySignature &&
    previous.language === next.language &&
    previous.onRestore === next.onRestore &&
    previous.onDelete === next.onDelete;
}

export const RunHistoryDetailPanel = memo(RunHistoryDetailPanelInner, areRunHistoryDetailPanelPropsEqual);
