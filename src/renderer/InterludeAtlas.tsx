import { useMemo, useState } from 'react';
import { getGuideView } from '../i18n/data';
import type { AppLanguage } from '../shared/types';
import { ActRouteMap, type RouteMapZone } from './ActRouteMap';
import { RouteCardBonusPanel } from './RouteCardBonuses';
import { UiIcon } from './UiIcon';
import { INTERLUDE_CHAPTERS, INTERLUDE_FINALE_ID, findInterludeChapter, type InterludeChapterId } from './interlude-atlas-data';

interface InterludeAtlasProps {
  language: AppLanguage;
  zones: RouteMapZone[];
  currentGuideId: string | null;
  visitedGuideIds: string[];
  matchingIds: string[];
  confirmedChapters: Record<InterludeChapterId, boolean>;
  onShowList: () => void;
}

const label = (language: AppLanguage, ru: string, en: string) => language === 'ru' ? ru : en;

export function InterludeAtlas({ language, zones, currentGuideId, visitedGuideIds, matchingIds, confirmedChapters, onShowList }: InterludeAtlasProps) {
  const [chapterId, setChapterId] = useState<InterludeChapterId | null>(null);
  const [showFinale, setShowFinale] = useState(false);
  const zonesById = useMemo(() => new Map(zones.map((zone) => [zone.entry.guide.id, zone])), [zones]);
  const currentChapter = findInterludeChapter(currentGuideId);
  const visitedSet = useMemo(() => new Set(visitedGuideIds), [visitedGuideIds]);
  const chapter = INTERLUDE_CHAPTERS.find((entry) => entry.id === chapterId);
  const finale = zonesById.get(INTERLUDE_FINALE_ID);
  const finaleView = finale ? getGuideView(finale.entry.guide, language) : null;
  const allConfirmed = INTERLUDE_CHAPTERS.every((entry) => confirmedChapters[entry.id]);

  if (chapter) {
    const chapterZones = chapter.zoneIds.map((id) => zonesById.get(id)).filter((zone): zone is RouteMapZone => Boolean(zone));
    return <>
      <nav className="interlude-chapter-nav" aria-label={label(language, 'Выбрать главу', 'Choose a chapter')}>
        <button type="button" className="button-secondary" onClick={() => setChapterId(null)}><UiIcon name="arrow-left" /> {label(language, 'Все три главы', 'All three chapters')}</button>
        {INTERLUDE_CHAPTERS.map((entry) => <button key={entry.id} type="button" className={entry.id === chapter.id ? 'button-primary' : 'button-secondary'} aria-pressed={entry.id === chapter.id} onClick={() => setChapterId(entry.id)}>
          {label(language, entry.titleRu, entry.titleEn)}
          {confirmedChapters[entry.id] && <UiIcon name="check" />}
        </button>)}
      </nav>
      <ActRouteMap
        key={chapter.id}
        language={language}
        act={5}
        interludeChapter={chapter.id}
        zones={chapterZones}
        currentGuideId={currentChapter?.id === chapter.id ? currentGuideId : null}
        matchingIds={matchingIds.filter((id) => chapter.zoneIds.includes(id))}
        onShowList={onShowList}
      />
    </>;
  }

  return <section className="companion-block interlude-atlas" aria-label={label(language, 'Три главы Интерлюдий', 'Three Interlude chapters')}>
    <div className="interlude-atlas-heading">
      <div>
        <strong>{label(language, 'Интерлюдии · три пути', 'Interludes · three paths')}</strong>
        <small>{label(language, 'Выберите пергамент, чтобы открыть карту и подробный маршрут. Главы можно проходить в разном порядке.', 'Choose a parchment to open its map and detailed route. The chapters can be completed in any order.')}</small>
      </div>
      <div className="interlude-atlas-head-actions">
        {currentChapter && <button className="button-secondary" type="button" onClick={() => setChapterId(currentChapter.id)}><UiIcon name="compass" /> {label(language, 'Где я', 'My location')}</button>}
        <button type="button" className="button-secondary" onClick={onShowList}><UiIcon name="menu" /> {label(language, 'Список', 'List')}</button>
      </div>
    </div>
    <div className="interlude-parchments">
      {INTERLUDE_CHAPTERS.map((entry, index) => {
        const chapterZones = entry.zoneIds.map((id) => zonesById.get(id)).filter((zone): zone is RouteMapZone => Boolean(zone));
        const visited = entry.zoneIds.filter((id) => visitedSet.has(id) || id === currentGuideId).length;
        const isCurrent = currentChapter?.id === entry.id;
        const bonusZones = chapterZones.filter((zone) => zone.bonusRewards.length > 0).length;
        return <button
          type="button"
          key={entry.id}
          className={`interlude-parchment is-${entry.id}${isCurrent ? ' is-current' : ''}`}
          onClick={() => setChapterId(entry.id)}
          aria-label={label(language, `Открыть главу «${entry.titleRu}», ${chapterZones.length} зон`, `Open ${entry.titleEn}, ${chapterZones.length} zones`)}
        >
          <span className="interlude-parchment-title">
            <small>{label(language, `ВЕТКА ${index + 1}`, `PATH ${index + 1}`)}</small>
            <strong>{label(language, entry.titleRu, entry.titleEn)}</strong>
          </span>
          <span className="interlude-parchment-stage">
            <svg className="interlude-parchment-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline points={entry.zoneIds.filter((id) => entry.positions[id]).map((id) => entry.positions[id].join(',')).join(' ')} stroke="rgba(245,212,145,.54)" strokeDasharray="1.1 1.6" strokeWidth=".55" strokeLinecap="round" fill="none" />
            </svg>
            {entry.zoneIds.map((id) => {
              const point = entry.positions[id];
              if (!point) return null;
              const zone = zonesById.get(id);
              const hasBonus = Boolean(zone?.bonusRewards.length);
              const allBonusRecorded = hasBonus && zone!.bonusRewards.every((bonus) => bonus.done);
              return <span key={id} className={`interlude-parchment-node${currentGuideId === id ? ' is-live' : ''}${hasBonus ? ' has-bonus' : ''}`} style={{ left: `${point[0]}%`, top: `${point[1]}%` }} title={zone?.routeCardTitle ?? id}>
                {hasBonus && <span className={`interlude-parchment-bonus${allBonusRecorded ? ' is-recorded' : ''}`}><UiIcon name={allBonusRecorded ? 'check' : 'diamond'} /></span>}
              </span>;
            })}
          </span>
          <span className="interlude-parchment-bottom">
            <span>{label(language, `Посещено: ${visited} / ${chapterZones.length}`, `Visited: ${visited} / ${chapterZones.length}`)}</span>
            <span>{label(language, `Зон с бонусами: ${bonusZones}`, `Bonus zones: ${bonusZones}`)}</span>
            {confirmedChapters[entry.id] ? <b className="is-confirmed"><UiIcon name="check" /> {label(language, 'Завершение подтверждено', 'Completion confirmed')}</b> : isCurrent ? <b className="is-current"><UiIcon name="compass" /> {label(language, 'Вы в этой главе', 'You are in this chapter')}</b> : <b>{label(language, 'Открыть карту →', 'Open map →')}</b>}
          </span>
        </button>;
      })}
    </div>
    <div className="interlude-finale">
      <div className="interlude-finale-summary">
        <span className="interlude-finale-seal"><UiIcon name="gift" /></span>
        <div>
          <strong>{label(language, 'Финал · Кингсмарш', 'Finale · Kingsmarch')}</strong>
          <small>{label(language, 'Вернуться после подтверждённого завершения трёх веток и забрать итоговую награду.', 'Return after confirmed completion of all three branches and claim the final reward.')}</small>
        </div>
        <button type="button" className="button-secondary" aria-expanded={showFinale} onClick={() => setShowFinale((value) => !value)}>
          {allConfirmed ? <UiIcon name="check" /> : <UiIcon name="circle" />}
          {label(language, showFinale ? 'Скрыть' : 'Подробнее', showFinale ? 'Hide' : 'Details')}
        </button>
      </div>
      {showFinale && finale && finaleView && <div className="interlude-finale-detail">
        <div><h4>{finale.routeCardTitle}</h4><p>{label(language, 'Переход после трёх веток', 'After all three branches')}</p></div>
        {finaleView.checklist && finaleView.checklist.length > 0 && <ul>{finaleView.checklist.map((item, i) => <li key={`${i}-${item.text}`}>{item.text}</li>)}</ul>}
        <RouteCardBonusPanel bonuses={finale.bonusRewards} language={language} />
        <p className="interlude-finale-disclaimer">{label(language, 'Посещение Кингсмарша само по себе не подтверждает получение награды.', 'Visiting Kingsmarch does not by itself confirm claiming the reward.')}</p>
      </div>}
    </div>
    <p className="interlude-atlas-note">{label(language, 'Карты схематичные. Значки бонусов показывают их наличие и сохранённое состояние, а не автоматически подтверждают получение.', 'Maps are schematic. Bonus badges show availability and recorded status, not automatic completion.')}</p>
  </section>;
}
