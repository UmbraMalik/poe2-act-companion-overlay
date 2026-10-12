import { useEffect, useMemo, useState } from 'react';
import { getOverlayMinimumSize } from '../../shared/overlay-layout';
import type { AppConfig, AppLanguage, OverlayMode } from '../../shared/types';

const PREVIEW_WIDTHS = [290, 330, 360, 400] as const;
const PREVIEW_ZONES = ['a1_grelwood', 'a1_ogham_farmlands'] as const;

/** Uses demo data inside the iframe; width presets resize the live Electron window via the settings page only. */
export function OverlayLivePreview({
  config,
  settingsLanguage,
  overlayMode
}: {
  config: AppConfig;
  settingsLanguage: AppLanguage;
  overlayMode: OverlayMode;
}) {
  const [previewLanguage, setPreviewLanguage] = useState<AppLanguage>(settingsLanguage);
  const [width, setWidth] = useState<number>(330);
  const [actualWidth, setActualWidth] = useState<number | null>(null);
  const [widthBusy, setWidthBusy] = useState(false);
  const [widthError, setWidthError] = useState<'closed' | 'failed' | null>(null);
  const minimumWidth = getOverlayMinimumSize(overlayMode, config.overlayDensity, config.overlayScale).width;

  useEffect(() => {
    let mounted = true;
    // Display the real current size, not an invented active preset.
    void window.poe2Overlay.getOverlayBounds().then((bounds) => {
      if (!mounted) return;
      setActualWidth(bounds?.width ?? null);
      if (bounds) setWidth(bounds.width);
    }).catch(() => { if (mounted) setWidthError('failed'); });
    return () => { mounted = false; };
  }, []);

  const selectWidth = async (requestedWidth: number) => {
    if (widthBusy) return;
    setWidth(requestedWidth); // Always allow testing narrow demo widths.
    setWidthBusy(true);
    setWidthError(null);
    try {
      const before = await window.poe2Overlay.getOverlayBounds();
      if (!before) {
        setActualWidth(null);
        setWidthError('closed');
        return;
      }
      // Electron enforces the mode/scale/density minimum. Never try to bypass it.
      await window.poe2Overlay.resizeOverlay(Math.max(requestedWidth, minimumWidth), before.height);
      const after = await window.poe2Overlay.getOverlayBounds();
      if (!after) {
        setActualWidth(null);
        setWidthError('closed');
      } else {
        setActualWidth(after.width); // Native confirmed width, including clamping.
        if (after.width !== Math.max(requestedWidth, minimumWidth)) setWidthError('failed');
      }
    } catch {
      setWidthError('failed');
    } finally {
      setWidthBusy(false);
    }
  };
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
          <span>{en ? 'Width — preview and live overlay' : 'Ширина — демо и настоящий оверлей'}</span>
          <div className="settings-overlay-preview-choice" role="group" aria-label={en ? 'Preview width' : 'Ширина предпросмотра'}>
            {PREVIEW_WIDTHS.map((value) => (
              <button key={value} type="button" disabled={widthBusy} aria-pressed={width === value}
                className={width === value ? 'is-active' : ''} onClick={() => void selectWidth(value)}>{value}</button>
            ))}
          </div>
          <span className="settings-overlay-preview-width-status" role="status" aria-live="polite">
            {widthBusy
              ? (en ? 'Applying width…' : 'Применяю ширину…')
              : widthError === 'closed'
                ? (en ? 'Overlay window is closed; preview only.' : 'Оверлей закрыт — изменилась только демо-ширина.')
                : widthError === 'failed'
                  ? (en ? 'Could not confirm the new overlay width.' : 'Не удалось подтвердить новую ширину оверлея.')
                  : actualWidth === null
                    ? (en ? 'No live overlay window.' : 'Нет открытого окна оверлея.')
                    : actualWidth !== width
                      ? (en ? `Preview ${width} px · Overlay ${actualWidth} px (minimum ${minimumWidth} px for current mode).` :
                        `Демо ${width} px · Оверлей ${actualWidth} px (минимум ${minimumWidth} px при текущих настройках).`)
                      : (en ? `Live overlay: ${actualWidth} px.` : `Ширина оверлея: ${actualWidth} px.`)}
          </span>
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
        {en ? 'Width buttons resize the live overlay (subject to its minimum). Language, demo mode and test area affect only the preview; game progress remains untouched.' :
          'Кнопки ширины меняют настоящий оверлей с учётом минимального размера. Язык, демо-режим и тестовая зона влияют только на предпросмотр; прогресс не затрагивается.'}
      </p>
    </aside>
  );
}
