import {
  getActTimeRowsFromSplits
} from '../companion-helpers';
import type { ActTimeRow } from '../companion-helpers';
import { formatDuration } from '../utils';
import { getGuideView, translateDataText } from '../../i18n/data';
import { translate } from '../../i18n/translations';
import { isEndgameT15Act } from '../../shared/timers';
import type {
  AppLanguage,
  AppSnapshot,
  CampaignBonusDefinition,
  CampaignBonusProgress,
  GuideDetails,
  GuideEntry,
  RunSummary,
  ZoneAct
} from '../../shared/types';

export type CompanionTab = 'zone' | 'route' | 'timer' | 'actTimes' | 'reminders' | 'bonuses' | 'summary';

export const ROUTE_OVERVIEW_VISIBLE_ITEMS = 2;

export function getRouteStatusLabel(
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

export function getGuideDetailsList(guide: GuideEntry, key: string): string[] {
  if (!guide.details || Array.isArray(guide.details)) {
    return [];
  }

  const value = (guide.details as Record<string, unknown>)[key];

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function getRouteFallbackLabels(guide: GuideEntry, language: AppLanguage): string[] {
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

export function formatRouteCardTitle(guide: GuideEntry, language: AppLanguage): string {
  if (guide.id === 'interlude_level_52_power_spike') {
    return translate(language, 'companion.setup52');
  }

  return getGuideView(guide, language)?.zoneName ?? (language === 'en' ? guide.zone_en : guide.zone_ru);
}


export function formatActTitle(act: ZoneAct | null, language: AppLanguage) {
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

export function formatRunStatus(status: string, language: AppLanguage) {
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

export function renderActTimeTable(rows: ActTimeRow[], emptyMessage: string, language: AppLanguage) {
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
              <td>{row.act}</td>
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

export function renderStringSection(
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
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}


export function renderCompactReminderList(
  items: { id: string; level: number; title: string; items?: string[] }[],
  language: AppLanguage,
  limit?: number
) {
  const visible = typeof limit === 'number' ? items.slice(0, limit) : items;

  if (visible.length === 0) {
    return <p className="helper-text">{translate(language, 'companion.remindersEmpty')}</p>;
  }

  return (
    <ul className="reminder-list">
      {visible.map((entry, index) => (
        <li key={entry.id} className={`reminder-item ${index === 0 ? 'is-nearest' : ''}`}>
          <div className="reminder-line">
            <span className="reminder-level">{translate(language, 'common.level')} {entry.level}</span>
            <span className="reminder-title">{translateDataText(entry.title, language)}</span>
            {index === 0 && <span className="reminder-badge">{translate(language, 'overlay.currentBadge')}</span>}
          </div>
          {entry.items && entry.items.length > 0 && (
            <ul className="reminder-sublist">
              {entry.items.slice(0, 3).map((item) => (
                <li key={`${entry.id}-${item}`}>{translateDataText(item, language)}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function renderDetails(
  details: GuideDetails | string[] | null | undefined,
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
                {(value as string[]).map((item) => (
                  <li key={`${key}-${item}`}>{translateDataText(item, language)}</li>
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


export function formatBonusAct(act: ZoneAct, language: AppLanguage): string {
  return act === 'interlude'
    ? translate(language, 'companion.interludes')
    : translate(language, 'route.act', { act });
}

export function getBonusCategoryLabel(
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

export function getCampaignBonusTotals(
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

export function getCurrentZoneCampaignBonuses(snapshot: AppSnapshot) {
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

export function renderSummary(summary: RunSummary | null, language: AppLanguage) {
  if (!summary) {
    return <p className="helper-text">{translate(language, 'companion.summaryEmpty')}</p>;
  }

  const actTimeRows = getActTimeRowsFromSplits(summary.actSplits, summary.totalElapsedMs);

  return (
    <div className="companion-stack">
      <section className="companion-block">
        <h3>{translate(language, 'companion.summaryTitle')}</h3>
        <dl className="info-grid companion-info-grid">
          <div className="info-cell">
            <dt>{translate(language, 'companion.totalTime')}</dt>
            <dd>{formatDuration(summary.totalElapsedMs)}</dd>
          </div>
          <div className="info-cell">
            <dt>{translate(language, 'companion.pauses')}</dt>
            <dd>{summary.pauseCount}</dd>
          </div>
          <div className="info-cell">
            <dt>{translate(language, 'companion.record')}</dt>
            <dd>{summary.isNewPb ? translate(language, 'companion.newRecord') : translate(language, 'companion.noRecordUpdate')}</dd>
          </div>
        </dl>
      </section>

      <section className="companion-block">
        <h3>{translate(language, 'common.actTimes')}</h3>
        {renderActTimeTable(actTimeRows, translate(language, 'companion.actTimesEmptyRunning'), language)}
      </section>

      <section className="companion-block">
        <h3>{translate(language, 'companion.longestZones')}</h3>
        <ul className="details-list">
          {summary.longestZones.map((entry) => (
            <li key={`${entry.zoneId}-${entry.enteredAt}`}>
              {translateDataText(entry.zone_ru, language)} · {formatDuration(entry.elapsedMs)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
