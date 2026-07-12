import type { AppLanguage } from '../shared/types';
import {
  formatRouteFilterLabel,
  getRouteFilterSummary,
  getRouteJumpDisabledReason,
  routeText,
  ROUTE_FILTER_MODES,
  type RouteFilterResultState,
  type RouteFilterMode
} from './route-tab-search';

type RouteTabControlsProps = {
  language: AppLanguage;
  filterMode: RouteFilterMode;
  searchQuery: string;
  resultState: RouteFilterResultState;
  canJumpCurrent: boolean;
  onFilterChange: (filterMode: RouteFilterMode) => void;
  onSearchChange: (query: string) => void;
  onJumpCurrent: () => void;
};

export function RouteTabControls({
  language,
  filterMode,
  searchQuery,
  resultState,
  canJumpCurrent,
  onFilterChange,
  onSearchChange,
  onJumpCurrent
}: RouteTabControlsProps) {
  const currentLabel = routeText('current', language);
  const currentReason = getRouteJumpDisabledReason('current', language);

  return (
    <div className="route-tab-tools">
      <label className="route-search-field">
        <span>{routeText('label', language)}</span>
        <input
          type="search"
          value={searchQuery}
          placeholder={routeText('placeholder', language)}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="route-filter-row" role="group" aria-label={routeText('filters', language)}>
        {ROUTE_FILTER_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`route-filter-button ${filterMode === mode ? 'button-primary' : 'button-secondary'}`}
            aria-pressed={filterMode === mode}
            onClick={() => onFilterChange(mode)}
          >
            <span className="route-filter-button-label">
              {formatRouteFilterLabel(mode, language)}
            </span>
          </button>
        ))}
      </div>

      <div className="route-tools-footer">
        <p className="route-filter-summary">
          {getRouteFilterSummary({ language, filterMode, query: searchQuery, ...resultState })}
        </p>

        <div className="route-jump-block">
          <span className="route-jump-title">{routeText('quickJump', language)}</span>
          <div className="button-row route-jump-row" aria-label={routeText('jumps', language)}>
            <button
              type="button"
              className="button-secondary"
              disabled={!canJumpCurrent}
              title={canJumpCurrent ? currentLabel : currentReason}
              aria-label={canJumpCurrent ? currentLabel : `${currentLabel}: ${currentReason}`}
              onClick={onJumpCurrent}
            >
              {currentLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
