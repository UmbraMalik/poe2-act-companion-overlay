import { useEffect, useMemo, useState } from 'react';
import { getGuideView } from '../i18n/data';
import type { AppLanguage, GuideEntry } from '../shared/types';
import { RouteCardBonusPanel, type RouteCardBonusModel } from './RouteCardBonuses';
import { UiIcon } from './UiIcon';

type RouteMapStatus = 'current' | 'missed' | 'completed' | 'visited' | 'pending';

export interface RouteMapZone {
  entry: { guide: GuideEntry; status: RouteMapStatus };
  routeCardTitle: string;
  recommendedLevelLabel: string;
  allRouteLabels: string[];
  bonusRewards: RouteCardBonusModel[];
}

interface ActRouteMapProps {
  language: AppLanguage;
  zones: RouteMapZone[];
  currentGuideId: string | null;
  matchingIds: string[];
  onShowList: () => void;
}

/* Hand-authored positions form a ROUTE DIAGRAM, not the geographic map of PoE 2.
 * Edges between main zones are taken from guide.next_zone_ru, not invented from positions.
 * The optional Mud Burrow branch is explicitly marked as a side area. */
const ACT_ONE_POSITIONS: Record<string, readonly [number, number]> = {
  a0_riverbank_miller: [13, 83],
  a1_clearfell_encampment: [27, 75],
  a1_clearfell: [35, 61],
  a1_mud_burrow: [27, 49],
  a1_grelwood: [46, 66],
  a1_red_vale: [61, 77],
  a1_grim_tangle: [51, 51],
  a1_cemetery: [63, 41],
  a1_tomb_of_the_consort: [74, 32],
  a1_mausoleum: [86, 40],
  a1_hunting_grounds: [73, 52],
  a1_freythorn: [84, 61],
  a1_ogham_farmlands: [88, 73],
  a1_ogham_village: [74, 16],
  a1_manor_ramparts: [86, 13],
  a1_ogham_manor: [93, 23]
};

function mapLabel(language: AppLanguage, ru: string, en: string) {
  return language === 'ru' ? ru : en;
}

function normalizedName(name: string): string {
  return name.trim().toLocaleLowerCase('ru').replace(/\s+/g, ' ');
}

// Keep complete markers, bonus badges and labels inside the visible map frame.
// Positions are illustrative; both nodes and guide-derived edges use the same inset.
function insetMapPoint(point: readonly [number, number]): readonly [number, number] {
  return [13 + (point[0] - 13) * .9, 14 + (point[1] - 13) * .86];
}

function buildRoutePath(from: readonly [number, number], to: readonly [number, number]) {
  const start = insetMapPoint(from);
  const end = insetMapPoint(to);
  const x1 = start[0] * 10;
  const y1 = start[1] * 7.4;
  const x2 = end[0] * 10;
  const y2 = end[1] * 7.4;
  const bend = Math.max(14, Math.min(65, Math.abs(x2 - x1) * .22));
  const sign = y2 >= y1 ? 1 : -1;
  return `M${x1},${y1} C${x1 + bend},${y1 + sign * 12} ${x2 - bend},${y2 - sign * 12} ${x2},${y2}`;
}

function getMapGuideList(guide: GuideEntry, language: AppLanguage, key: string): string[] {
  const details = getGuideView(guide, language)?.details;
  if (!details || Array.isArray(details)) return [];
  const values = (details as Record<string, unknown>)[key];
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === 'string') : [];
}

export function ActRouteMap({ language, zones, currentGuideId, matchingIds, onShowList }: ActRouteMapProps) {
  const activeZone = zones.find(({ entry }) => entry.guide.id === currentGuideId)
    ?? zones.find(({ entry }) => entry.status === 'current')
    ?? null;
  const liveId = activeZone?.entry.guide.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(liveId);
  const [userSelected, setUserSelected] = useState(false);

  // Follow live position until the user chooses another location manually.
  useEffect(() => {
    if (!userSelected) setSelectedId(liveId);
  }, [liveId, userSelected]);

  const byId = useMemo(() => new Map(zones.map((zone) => [zone.entry.guide.id, zone])), [zones]);
  const byName = useMemo(() => new Map(zones.map((zone) => [normalizedName(zone.entry.guide.zone_ru), zone])), [zones]);
  const selected = (selectedId && byId.get(selectedId)) ?? activeZone ?? zones[0] ?? null;
  const matches = new Set(matchingIds);
  const nextActive = activeZone ? byName.get(normalizedName(activeZone.entry.guide.next_zone_ru)) ?? null : null;
  const nextId = nextActive?.entry.guide.id ?? null;

  const connections = useMemo(() => {
    const edges: { from: string; to: string; kind: 'route' | 'side' }[] = [];
    const uniqueEdges = new Set<string>();
    for (const zone of zones) {
      const to = byName.get(normalizedName(zone.entry.guide.next_zone_ru));
      if (to && zone.entry.guide.id !== to.entry.guide.id) {
        const key = `${zone.entry.guide.id}:${to.entry.guide.id}`;
        if (!uniqueEdges.has(key)) {
          edges.push({ from: zone.entry.guide.id, to: to.entry.guide.id, kind: 'route' });
          uniqueEdges.add(key);
        }
      }
    }
    // One known side-area branch; never imply clearing it is necessary.
    if (byId.has('a1_clearfell') && byId.has('a1_mud_burrow')) {
      edges.push({ from: 'a1_clearfell', to: 'a1_mud_burrow', kind: 'side' });
    }
    return edges;
  }, [zones, byId, byName]);

  if (!zones.length) {
    return <section className="companion-block act-atlas-empty">{mapLabel(language, 'Нет данных для карты.', 'No map data available.')}</section>;
  }

  const selectedView = selected ? getGuideView(selected.entry.guide, language) : null;
  const goalLines = selectedView?.checklist?.length ? selectedView.checklist.map((item) => item.text) : selected?.allRouteLabels ?? [];
  const importantLines = selectedView?.important ?? [];
  const skipLines = selectedView?.skip ?? [];
  const speedLines = selected ? getMapGuideList(selected.entry.guide, language, 'overlay_speedrun') : [];
  const bossLines = selectedView?.bossTips ?? [];
  const selectedIsLive = Boolean(selected && selected.entry.guide.id === liveId);
  const selectedIsNext = Boolean(selected && selected.entry.guide.id === nextId);

  return (
    <section className="companion-block act-atlas" aria-label={mapLabel(language, 'Схема маршрута Акта 1', 'Act 1 route diagram')}>
      <div className="act-atlas-header">
        <div>
          <strong>{mapLabel(language, 'Карта маршрута · Акт 1', 'Route map · Act 1')}</strong>
          <small>{mapLabel(language, 'Схема прохождения — расположение условное, не игровой атлас', 'Progression diagram — positions are illustrative, not the in-game atlas')}</small>
        </div>
        <div className="act-atlas-header-actions">
          <button type="button" className="button-secondary" disabled={!liveId} onClick={() => { setUserSelected(false); setSelectedId(liveId); }}>
            <UiIcon name="compass" /> {mapLabel(language, 'Где я', 'My location')}
          </button>
          <button type="button" className="button-secondary" onClick={onShowList}>
            <UiIcon name="menu" /> {mapLabel(language, 'Список', 'List')}
          </button>
        </div>
      </div>
      <div className="act-atlas-layout">
        <div className="act-atlas-map-column">
          <div className="act-atlas-location-strip" aria-live="polite">
            <span><b>{mapLabel(language, 'ВЫ ЗДЕСЬ', 'YOU ARE HERE')}</b><strong>{activeZone?.routeCardTitle ?? mapLabel(language, 'Нет данных для Акта 1', 'No Act 1 position')}</strong></span>
            <span><b>{mapLabel(language, 'СЛЕДУЮЩИЙ ПЕРЕХОД', 'NEXT IN GUIDE')}</b><strong>{nextActive?.routeCardTitle ?? (activeZone ? (getGuideView(activeZone.entry.guide, language)?.nextZoneName || '—') : '—')}</strong></span>
          </div>
        <div className="act-atlas-scroll" role="group" aria-label={mapLabel(language, 'Интерактивная карта маршрута. Весь акт виден сразу.', 'Interactive route map. The entire act is visible at once.')}>
          <div className="act-atlas-canvas">
            <svg className="act-atlas-edges" viewBox="0 0 1000 740" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <marker id="act-atlas-next-arrow" markerWidth="7" markerHeight="7" refX="5.6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7" fill="none" stroke="#f5bf64" strokeWidth="1.8"/></marker>
              </defs>
              {connections.map((edge) => {
                const a = ACT_ONE_POSITIONS[edge.from];
                const b = ACT_ONE_POSITIONS[edge.to];
                if (!a || !b) return null;
                const isRecommendedNext = edge.from === liveId && edge.to === nextId;
                return <path key={`${edge.from}:${edge.to}`} className={`act-atlas-edge ${edge.kind === 'side' ? 'is-side' : ''}${isRecommendedNext ? ' is-recommended' : ''}`} d={buildRoutePath(a, b)} markerEnd={isRecommendedNext ? 'url(#act-atlas-next-arrow)' : undefined} />;
              })}
            </svg>
            {zones.map((zone) => {
              const id = zone.entry.guide.id;
              const originalPoint = ACT_ONE_POSITIONS[id];
              if (!originalPoint) return null;
              const point = insetMapPoint(originalPoint);
              const isCurrent = id === liveId;
              const isNext = id === nextId;
              const isSelected = selected?.entry.guide.id === id;
              const isMatch = matches.has(id);
              const bonusCount = zone.bonusRewards.length;
              const bonusDone = bonusCount > 0 && zone.bonusRewards.every((bonus) => bonus.done);
              return (
                <button
                  key={id}
                  type="button"
                  style={{ left: `${point[0]}%`, top: `${point[1]}%` }}
                  className={`act-atlas-node status-${zone.entry.status}${isCurrent ? ' is-live' : ''}${isNext ? ' is-next' : ''}${isSelected ? ' is-selected' : ''}${!isMatch ? ' is-filtered' : ''}${point[0] > 69 ? ' edge-right' : point[0] < 26 ? ' edge-left' : point[1] > 70 ? ' edge-bottom' : ''}`}
                  aria-pressed={isSelected}
                  aria-label={`${zone.routeCardTitle}${isCurrent ? mapLabel(language, ', текущая зона', ', current zone') : ''}${isNext ? mapLabel(language, ', следующая по гайду', ', next in guide') : ''}${bonusCount ? mapLabel(language, `, бонусов: ${bonusCount}`, `, bonuses: ${bonusCount}`) : ''}`}
                  title={`${zone.routeCardTitle}${bonusCount ? ` · ${zone.bonusRewards.map((b) => b.title).join(', ')}` : ''}`}
                  onClick={() => { setSelectedId(id); setUserSelected(true); }}
                >
                  <span className="act-atlas-node-ring"><span className="act-atlas-node-core">{zone.entry.guide.id.includes('encampment') || zone.entry.guide.id.includes('village') ? '⌂' : isCurrent ? '◆' : '✦'}</span></span>
                  {bonusCount > 0 && (
                    <span className={`act-atlas-bonus${bonusDone ? ' is-collected' : ''}`} title={zone.bonusRewards.map((b) => `${b.title} (${b.done ? mapLabel(language, 'учтено', 'recorded') : mapLabel(language, 'не подтверждено', 'not confirmed')})`).join('\n')}>
                      <UiIcon name={bonusDone ? 'check' : 'diamond'} />{bonusCount > 1 ? bonusCount : ''}
                    </span>
                  )}
                  <span className="act-atlas-node-caption">{zone.routeCardTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
        </div>
        <aside className="act-atlas-info" aria-label={mapLabel(language, 'Информация о выбранной локации', 'Selected zone information')}>
          {selected && selectedView && <>
            <header className="act-atlas-info-top">
              <small>{mapLabel(language, 'ЛОКАЦИЯ', 'LOCATION')} {zones.findIndex((z) => z.entry.guide.id === selected.entry.guide.id) + 1} / {zones.length}</small>
              <h3>{selected.routeCardTitle}</h3>
              <div className="act-atlas-info-tags">
                <span>{mapLabel(language, 'Рек.', 'Rec.')} {selected.recommendedLevelLabel}</span>
                {selectedIsLive && <span className="is-live">{mapLabel(language, 'Вы здесь', 'You are here')}</span>}
                {selectedIsNext && <span className="is-next">{mapLabel(language, 'Следующая', 'Next')}</span>}
                {!selectedIsLive && !selectedIsNext && selected.entry.status === 'visited' && <span>{mapLabel(language, 'Посещена', 'Visited')}</span>}
              </div>
            </header>
            <div className="act-atlas-info-scroll">
              {goalLines.length > 0 && <div className="act-atlas-info-section">
                <h4>{mapLabel(language, 'Что делать', 'Objectives')}</h4>
                <ul>{goalLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
              </div>}
              <RouteCardBonusPanel bonuses={selected.bonusRewards} language={language} />
              {importantLines.length > 0 && <div className="act-atlas-info-section is-important">
                <h4>{mapLabel(language, 'Важно', 'Important')}</h4>
                <ul>{importantLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
              </div>}
              {skipLines.length > 0 && <div className="act-atlas-info-section is-skip">
                <h4>{mapLabel(language, 'Пропустить', 'Skip')}</h4>
                <ul>{skipLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
              </div>}
              {speedLines.length > 0 && <div className="act-atlas-info-section">
                <h4>{mapLabel(language, 'Спидран', 'Speedrun')}</h4>
                <ul>{speedLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
              </div>}
              {bossLines.length > 0 && <div className="act-atlas-info-section">
                <h4>{mapLabel(language, 'Советы по боссу', 'Boss tips')}</h4>
                <ul>{bossLines.map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ul>
              </div>}
              <div className="act-atlas-next-box">
                <small>{mapLabel(language, 'ДАЛЬШЕ ПО ГАЙДУ', 'NEXT IN GUIDE')}</small>
                <strong>{selectedView.nextZoneName || '—'}</strong>
                {byName.has(normalizedName(selected.entry.guide.next_zone_ru)) && (
                  <button type="button" className="button-secondary" onClick={() => {
                    const target = byName.get(normalizedName(selected.entry.guide.next_zone_ru));
                    if (target) { setSelectedId(target.entry.guide.id); setUserSelected(true); }
                  }}>
                    <UiIcon name="arrow-right" /> {mapLabel(language, 'Показать точку', 'Show on map')}
                  </button>
                )}
              </div>
            </div>
            <footer className="act-atlas-info-foot">
              {mapLabel(language, 'Точка на схеме не подтверждает выполнение заданий или получение наград.', 'A map location does not confirm objectives or rewards.')}
            </footer>
          </>}
        </aside>
      </div>
      <div className="act-atlas-legend">
        <span><i className="is-live" />{mapLabel(language, 'Текущая', 'Current')}</span>
        <span><i className="is-next" />{mapLabel(language, 'Следующая по гайду', 'Next in guide')}</span>
        <span><i className="is-regular" />{mapLabel(language, 'Локация', 'Zone')}</span>
        <span><UiIcon name="diamond" />{mapLabel(language, 'Постоянный бонус', 'Permanent bonus')}</span>
        <span>{mapLabel(language, 'Клик по точке — подробности справа', 'Click a node for details')}</span>
      </div>
    </section>
  );
}
