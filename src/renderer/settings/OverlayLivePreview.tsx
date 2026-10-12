import { useMemo, useState } from 'react';
import type { AppConfig, AppLanguage } from '../../shared/types';

const PREVIEW_WIDTHS = [290, 330, 360, 400] as const;
const PREVIEW_ZONES = ['a1_grelwood', 'a1_ogham_farmlands'] as const;

/** Read-only real-renderer preview. Never invokes the Electron IPC API. */
export function OverlayLivePreview({
  config,
  settingsLanguage
}: {
  config: AppConfig;
  settingsLanguage: AppLanguage;
}) {
  const [previewLanguage, setPreviewLanguage] = useState<AppLanguage>(settingsLanguage);
  const [width, setWidth] = useState<(typeof PREVIEW_WIDTHS)[number]>(330);
  const [mode, setMode] = useState<'full' | 'compact'>('full');
  const [zone, setZone] = useState<(typeof PREVIEW_ZONES)[number]>('a1_ogham_farmlands');
  const en = settingsLanguage === 'en';
  const frameUrl = useMemo(() => {
    const params = new URLSearchParams({
      preview: '1',
      embeddedPreview: '1',
      demo: '1',
      zoneId: zone,
      level: zone === 'a1_grelwood' ? '3' : '15',
      timerStatus: 'paused',
      elapsedMs: '845000',
      previewLanguage,
      previewTheme: config.theme,
      previewDensity: mode === 'compact' ? 'compact' : config.overlayDensity === 'compact' ? 'normal' : config.overlayDensity,
      previewScale: String(config.overlayScale),
      previewTextSize: String(config.overlayTextSize),
      previewFx: config.visualFxIntensity,
      previewEffects: config.overlayEffectsEnabled ? '1' : '0',
      previewMainFlags: Object.keys(config.mainOverlaySettings).filter((key) => config.mainOverlaySettings[key as keyof typeof config.mainOverlaySettings] === true).join(','),
      previewSections: Object.keys(config.overlayVisibleSections).filter((key) => config.overlayVisibleSections[key as keyof typeof config.overlayVisibleSections]).join(','),
      previewOrder: config.overlayLayoutOrder.join(',')
    });
    return `./overlay.html?${params.toString()}`;
  }, [config.theme, config.overlayDensity, config.overlayScale, config.overlayTextSize, config.visualFxIntensity, config.overlayEffectsEnabled, config.mainOverlaySettings, config.overlayVisibleSections, config.overlayLayoutOrder, mode, previewLanguage, zone]);

  return (
    <aside className="settings-overlay-preview" aria-label={en ? 'Overlay live preview' : 'Предпросмотр оверлея'}>
      <div className="settings-overlay-preview-title-row">
        <div>
          <h3>{en ? 'Overlay preview' : 'Предпросмотр оверлея'}</h3>
          <p className="helper-text">{en ? 'Rendered by the real overlay. Demo data only.' : 'Настоящий оверлей на демонстрационных данных.'}</p>
        </div>
        <span className="settings-overlay-preview-demo">DEMO</span>
      </div>
      <div className="settings-overlay-preview-controls">
        <div className="settings-overlay-preview-control">
          <span>{en ? 'Language' : 'Язык'}</span>
          <div className="settings-overlay-preview-choice" role="group" aria-label={en ? 'Preview language' : 'Язык предпросмотра'}>
            {(['ru', 'en'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={previewLanguage === value}
                className={previewLanguage === value ? 'is-active' : ''} onClick={() => setPreviewLanguage(value)}>
                {value.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-overlay-preview-control">
          <span>{en ? 'Mode' : 'Режим'}</span>
          <div className="settings-overlay-preview-choice" role="group" aria-label={en ? 'Preview mode' : 'Режим предпросмотра'}>
            {(['full', 'compact'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={mode === value}
                className={mode === value ? 'is-active' : ''} onClick={() => setMode(value)}>
                {value === 'full' ? (en ? 'Full' : 'Полный') : (en ? 'Compact' : 'Компакт')}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-overlay-preview-control settings-overlay-preview-control-wide">
          <span>{en ? 'Width' : 'Ширина'}</span>
          <div className="settings-overlay-preview-choice" role="group" aria-label={en ? 'Preview width' : 'Ширина предпросмотра'}>
            {PREVIEW_WIDTHS.map((value) => (
              <button key={value} type="button" aria-pressed={width === value}
                className={width === value ? 'is-active' : ''} onClick={() => setWidth(value)}>{value}</button>
            ))}
          </div>
        </div>
        <label className="settings-overlay-preview-control settings-overlay-preview-zone">
          <span>{en ? 'Test area' : 'Тестовая локация'}</span>
          <select value={zone} onChange={(event) => setZone(event.target.value as typeof zone)}>
            <option value="a1_grelwood">{en ? 'Grelwood' : 'Грельвуд'}</option>
            <option value="a1_ogham_farmlands">{en ? 'Ogham Farmlands' : 'Огамские фермы'}</option>
          </select>
        </label>
      </div>
      <div className="settings-overlay-preview-stage" aria-label={en ? 'Preview canvas' : 'Область предпросмотра'}>
        <iframe
          title={en ? 'Read-only overlay preview' : 'Предпросмотр игрового оверлея'}
          src={frameUrl}
          width={width}
          height={510}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
          style={{ opacity: config.overlayOpacity }}
        />
      </div>
      <p className="settings-overlay-preview-help helper-text">
        {en ? 'Preview controls do not change the game, live overlay or progress. Changes to overlay options on the left refresh this view.' :
          'Кнопки предпросмотра не изменяют игру, настоящий оверлей или прогресс. Параметры слева обновляют эту картинку.'}
      </p>
    </aside>
  );
}
