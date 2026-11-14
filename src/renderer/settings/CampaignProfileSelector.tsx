import type { AppLanguage, CampaignProfile } from '../../shared/types';
import { SettingsSelect } from './SettingsSelect';

interface CampaignProfileSelectorProps {
  language: AppLanguage;
  value: CampaignProfile;
  onChange: (profile: CampaignProfile) => void;
}

/** A local preview only: 1.0 routes are intentionally empty until verified. */
export function CampaignProfileSelector({ language, value, onChange }: CampaignProfileSelectorProps) {
  const isRu = language === 'ru';
  return (
    <div className="settings-grid">
      <label className="settings-field">
        <span>{isRu ? 'Версия кампании (локальная подготовка)' : 'Campaign version (local preview)'}</span>
        <SettingsSelect
          ariaLabel={isRu ? 'Версия кампании' : 'Campaign version'}
          value={value}
          options={[
            { value: 'legacy-0.5', label: isRu ? '0.5 · Акты 1–4 + Интерлюдии' : '0.5 · Acts 1–4 + Interludes' },
            { value: 'release-1.0', label: isRu ? '1.0 · Акты 1–6 (заготовка)' : '1.0 · Acts 1–6 (preview)' }
          ]}
          onChange={(next) => onChange(next === 'release-1.0' ? 'release-1.0' : 'legacy-0.5')}
        />
        <small className="helper-text">{isRu
          ? 'Новые акты пока без игровых зон. Профиль меняется только после завершения или сброса таймера.'
          : 'New acts have no verified zones yet. Finish or reset the timer to switch profiles.'}</small>
      </label>
    </div>
  );
}
