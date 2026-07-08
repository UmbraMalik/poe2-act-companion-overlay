import type { AppLanguage } from '../shared/types';
import {
  formatRouteFilterLabel,
  routeText,
  ROUTE_FILTER_MODES,
  type RouteFilterMode
} from './route-tab-search';

type RouteTabControlsProps = {
  language: AppLanguage;
  filterMode: RouteFilterMode;
  searchQuery: string;
  canJumpCurrent: boolean;
  canJumpNext: boolean;
  canJumpMissed: boolean;
  onFilterChange: (filterMode: RouteFilterMode) => void;
  onSearchChange: (query: string) => void;
  onJumpCurrent: () => void;
  onJumpNext: () => void;
  onJumpMissed: () => void;
};

export function RouteTabControls({
  language,
  filterMode,
  searchQuery,
  canJumpCurrent,
  canJumpNext,
  canJumpMissed,
  onFilterChange,
  onSearchChange,
  onJumpCurrent,
  onJumpNext,
  onJumpMissed
}: RouteTabControlsProps) {
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
            className={filterMode === mode ? 'button-primary' : 'button-secondary'}
            aria-pressed={filterMode === mode}
            onClick={() => onFilterChange(mode)}
          >
            {formatRouteFilterLabel(mode, language)}
          </button>
        ))}
      </div>

      <div className="button-row route-jump-row" aria-label={routeText('jumps', language)}>
        <button type="button" className="button-secondary" disabled={!canJumpCurrent} onClick={onJumpCurrent}>
          {routeText('current', language)}
        </button>
        <button type="button" className="button-secondary" disabled={!canJumpNext} onClick={onJumpNext}>
          {routeText('next', language)}
        </button>
        <button type="button" className="button-secondary" disabled={!canJumpMissed} onClick={onJumpMissed}>
          {routeText('missed', language)}
        </button>
      </div>
    </div>
  );
}
