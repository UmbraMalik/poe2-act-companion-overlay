import { getCampaignBonusView } from '../i18n/data';
import { translate } from '../i18n/translations';
import { getCampaignBonusProvenanceView } from '../shared/campaign-bonus-provenance';
import type { AppLanguage, AppSnapshot, GuideEntry } from '../shared/types';
import { getStructuredRouteBonusIds } from './route-tab-search';

export type RouteCardBonusModel = {
  id: string;
  title: string;
  source: string;
  categoryLabel: string;
  done: boolean;
  provenanceLabel: string | null;
};

type RouteBonusSnapshot = Pick<AppSnapshot, 'campaignBonuses' | 'config'>;

type BonusCategory = AppSnapshot['campaignBonuses'][number]['category'];

function getBonusCategoryLabel(category: BonusCategory, language: AppLanguage): string {
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

export function getRouteCampaignBonusModels(
  guide: GuideEntry,
  snapshot: RouteBonusSnapshot,
  language: AppLanguage
): RouteCardBonusModel[] {
  const bonusIds = new Set(getStructuredRouteBonusIds(guide, snapshot.campaignBonuses));

  if (bonusIds.size === 0) {
    return [];
  }

  return snapshot.campaignBonuses
    .filter((bonus) => bonusIds.has(bonus.id))
    .map((bonus) => {
      const bonusView = getCampaignBonusView(bonus, language);
      const progress = snapshot.config.campaignBonusProgress?.[bonus.id] ?? null;

      return {
        id: bonus.id,
        title: bonusView?.displayTitle ?? bonus.title,
        source: bonusView?.displaySource ?? bonus.source,
        categoryLabel: getBonusCategoryLabel(bonus.category, language),
        done: Boolean(progress),
        provenanceLabel: getCampaignBonusProvenanceView(progress, language)?.label ?? null
      };
    });
}

function getRouteBonusStatusLabel(bonus: RouteCardBonusModel, language: AppLanguage): string {
  if (!bonus.done) {
    return translate(language, 'companion.routeBonusNotTaken');
  }

  return bonus.provenanceLabel ?? translate(language, 'companion.routeBonusTakenUnknown');
}

export function RouteCardBonusPanel({ bonuses, language }: { bonuses: RouteCardBonusModel[]; language: AppLanguage }) {
  if (bonuses.length === 0) {
    return null;
  }

  return (
    <div className="route-card-bonus-panel">
      <div className="route-card-bonus-heading">
        <span>{translate(language, 'companion.routeZoneBonuses')}</span>
        <strong>{translate(language, 'companion.routeZoneBonusCount', {
          done: bonuses.filter((bonus) => bonus.done).length,
          total: bonuses.length
        })}</strong>
      </div>
      <ul className="route-card-bonus-list">
        {bonuses.map((bonus) => (
          <li key={bonus.id} className={bonus.done ? 'is-done' : 'is-pending'}>
            <span className="route-card-bonus-marker" aria-hidden="true">{bonus.done ? '✓' : '○'}</span>
            <span className="route-card-bonus-copy">
              <strong>{bonus.title}</strong>
              <small>{bonus.source} · {bonus.categoryLabel}</small>
            </span>
            <span className="route-card-bonus-state">{getRouteBonusStatusLabel(bonus, language)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
