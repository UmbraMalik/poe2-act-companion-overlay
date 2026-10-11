import { useState } from 'react';
import type { AppConfig, AppLanguage, OverlayLayoutSection, OverlayLayoutPreset } from '../../shared/types';

const DEFAULT_ORDER: OverlayLayoutSection[] = ['zoneInfo', 'route', 'nearby', 'tips'];
const LABELS: Record<OverlayLayoutSection, {ru: string; en: string}> = {
  zoneInfo: { ru: 'Задачи текущей локации', en: 'Current zone tasks' },
  route: { ru: 'Дальше и бонусы', en: 'Next zone and bonuses' },
  nearby: { ru: 'Ближайшие напоминания', en: 'Upcoming reminders' },
  tips: { ru: 'Скип, спидран и важно', en: 'Skip, speedrun and important' }
};

export function OverlayLayoutEditor({ config, language }: { config: AppConfig; language: AppLanguage }) {
  const [name, setName] = useState('');
  const order = [...new Set([...config.overlayLayoutOrder, ...DEFAULT_ORDER])];
  const saved = config.overlaySavedLayouts;
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    void window.poe2Overlay.updateSettings({ overlayLayoutOrder: next });
  };
  const save = () => {
    const trimmed = name.trim().slice(0, 48);
    if (!trimmed) return;
    const layout: OverlayLayoutPreset = { name: trimmed, order: [...order], visibleSections: { ...config.overlayVisibleSections } };
    void window.poe2Overlay.updateSettings({ overlaySavedLayouts: [
      ...saved.filter((entry) => entry.name.toLocaleLowerCase() !== trimmed.toLocaleLowerCase()), layout
    ].slice(-8) });
    setName('');
  };
  return <section className="overlay-layout-editor settings-subsection" aria-label={language === 'ru' ? 'Конструктор оверлея' : 'Overlay layout editor'}>
    <h3>{language === 'ru' ? 'Порядок блоков оверлея' : 'Overlay block order'}</h3>
    <p className="helper-text">{language === 'ru' ? 'Перемещай блоки стрелками. Сохрани макет вместе с видимостью разделов — до 8 профилей.' : 'Move blocks with arrows. Save a layout with its visible sections — up to 8 profiles.'}</p>
    <div className="overlay-layout-rows">
      {order.map((section, index) => <div className="overlay-layout-row" key={section}>
        <span>{LABELS[section][language]}</span>
        <button type="button" className="button-secondary" disabled={index === 0} aria-label={`${language === 'ru' ? 'Вверх' : 'Move up'}: ${LABELS[section][language]}`} onClick={() => move(index, -1)}>↑</button>
        <button type="button" className="button-secondary" disabled={index === order.length - 1} aria-label={`${language === 'ru' ? 'Вниз' : 'Move down'}: ${LABELS[section][language]}`} onClick={() => move(index, 1)}>↓</button>
      </div>)}
    </div>
    <div className="overlay-layout-save">
      <input value={name} maxLength={48} onChange={event => setName(event.target.value)} placeholder={language === 'ru' ? 'Название своего макета' : 'Layout name'} aria-label={language === 'ru' ? 'Название макета' : 'Layout name'} />
      <button type="button" className="button-secondary" disabled={!name.trim()} onClick={save}>{language === 'ru' ? 'Сохранить' : 'Save'}</button>
      <button type="button" className="button-secondary" onClick={() => void window.poe2Overlay.updateSettings({overlayLayoutOrder: DEFAULT_ORDER})}>{language === 'ru' ? 'По умолчанию' : 'Reset order'}</button>
    </div>
    {saved.map(layout => <div className="overlay-layout-row" key={layout.name}>
      <span>{layout.name}</span>
      <button type="button" className="button-secondary" onClick={() => void window.poe2Overlay.updateSettings({overlayLayoutOrder: layout.order, overlayVisibleSections: layout.visibleSections})}>{language === 'ru' ? 'Применить' : 'Apply'}</button>
      <button type="button" className="button-secondary" aria-label={`${language === 'ru' ? 'Удалить' : 'Delete'}: ${layout.name}`} onClick={() => void window.poe2Overlay.updateSettings({overlaySavedLayouts: saved.filter(entry => entry.name !== layout.name)})}>×</button>
    </div>)}
  </section>;
}
