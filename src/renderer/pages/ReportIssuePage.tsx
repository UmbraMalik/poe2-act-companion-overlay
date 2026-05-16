import { useEffect, useMemo, useState } from 'react';
import { useAppSnapshot } from '../hooks';
import { formatDuration, formatTimestamp } from '../utils';
import type { AppSnapshot } from '../../shared/types';

const PROJECT_FEEDBACK_URL = 'https://t.me/POE2CampaignCodex?direct';

type ReportTemplate = 'bug' | 'data' | 'ui' | 'idea';

const TEMPLATE_LABELS: Record<ReportTemplate, string> = {
  bug: 'Баг / не работает',
  data: 'Ошибка в подсказке или данных',
  ui: 'UI / отображение',
  idea: 'Предложение'
};

function yesNo(value: boolean): string {
  return value ? 'да' : 'нет';
}

function getZoneLabel(snapshot: AppSnapshot | null): string {
  const guide = snapshot?.currentGuideEntry ?? snapshot?.currentZone.guide ?? null;

  if (guide) {
    const actLabel = guide.act === 'interlude' ? 'интерлюдия' : `акт ${guide.act}`;
    return `${guide.zone_ru} / ${guide.zone_en} (${actLabel})`;
  }

  return snapshot?.currentZone.rawZoneName || snapshot?.runtime.lastRawZoneName || 'не определена';
}

function getDiagnostics(snapshot: AppSnapshot | null, appVersion: string): string {
  const config = snapshot?.config;
  const runtime = snapshot?.runtime;
  const runTimer = config?.runTimer;
  const currentGuide = snapshot?.currentGuideEntry ?? snapshot?.currentZone.guide ?? null;
  const currentLevel = config?.currentLevel ?? null;

  return [
    `Версия приложения: ${appVersion}`,
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    `Текущая зона: ${getZoneLabel(snapshot)}`,
    `ID зоны: ${currentGuide?.id ?? '—'}`,
    `Сырой лог зоны: ${snapshot?.currentZone.rawZoneName ?? runtime?.lastRawZoneName ?? '—'}`,
    `Источник зоны: ${runtime?.lastZoneSource ?? '—'}`,
    `Причина матчинга: ${runtime?.lastMatcherReason ?? '—'}`,
    `Клиент / сцена: ${snapshot?.currentZone.sceneKind ?? '—'}`,
    `Уровень персонажа: ${currentLevel ?? '—'}`,
    `Рекомендованный уровень: ${currentGuide?.recommended_level_label ?? '—'}`,
    `Лог-файл выбран: ${yesNo(Boolean(config?.logFilePath))}`,
    `Путь к логу: ${config?.logFilePath ?? '—'}`,
    `Лог существует: ${yesNo(Boolean(runtime?.logFileExists))}`,
    `Статус watcher: ${runtime?.logWatcherStatus ?? '—'} / ${runtime?.logWatcherMessage ?? '—'}`,
    `Последняя строка лога: ${runtime?.lastLogLine ? runtime.lastLogLine.slice(0, 220) : '—'}`,
    `Последнее чтение лога: ${formatTimestamp(runtime?.lastReadAt ?? null)}`,
    `Последний матч зоны: ${formatTimestamp(runtime?.lastMatchedAt ?? null)}`,
    `Режим оверлея: ${runtime?.overlayMode ?? config?.mainOverlaySettings.overlayMode ?? '—'}`,
    `Плотность / масштаб: ${config?.overlayDensity ?? '—'} / ${config?.overlayScale ?? '—'}%`,
    `Таймер: ${runTimer?.status ?? '—'}`,
    `Время забега: ${runTimer ? formatDuration(runTimer.elapsedMs) : '—'}`,
    `Паузы таймера: ${runTimer?.pauseCount ?? '—'}`,
    `OS/UserAgent: ${navigator.userAgent}`
  ].join('\n');
}

function getTemplateBody(template: ReportTemplate, diagnostics: string): string {
  if (template === 'data') {
    return `Тип: ошибка в подсказке / данных

Локация / акт:
${getDiagnosticsZoneLine(diagnostics)}

Что неверно:


Как должно быть:


Скрин / видео, если есть:


--- Диагностика ---
${diagnostics}`;
  }

  if (template === 'ui') {
    return `Тип: проблема с UI / отображением

Где видно проблему:


Что разъехалось / выглядит странно:


Какой режим оверлея использовался:


Скрин / видео, если есть:


--- Диагностика ---
${diagnostics}`;
  }

  if (template === 'idea') {
    return `Тип: предложение

Идея:


Зачем это нужно / какую боль решает:


Как это примерно должно выглядеть:


--- Диагностика ---
${diagnostics}`;
  }

  return `Тип: баг / что-то не работает

Что случилось:


Шаги, как повторить:
1. 
2. 
3. 

Что ожидалось:


Что получилось:


Скрин / видео, если есть:


--- Диагностика ---
${diagnostics}`;
}

function getDiagnosticsZoneLine(diagnostics: string): string {
  const line = diagnostics.split('\n').find((item) => item.startsWith('Текущая зона:'));
  return line?.replace('Текущая зона:', '').trim() || '';
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

export function ReportIssuePage() {
  const snapshot = useAppSnapshot();
  const [appVersion, setAppVersion] = useState('—');
  const [template, setTemplate] = useState<ReportTemplate>('bug');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!window.poe2Overlay?.getAppVersion) {
      return () => {
        isMounted = false;
      };
    }

    void window.poe2Overlay.getAppVersion().then((version) => {
      if (isMounted) {
        setAppVersion(version || '—');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const diagnostics = useMemo(() => getDiagnostics(snapshot, appVersion), [snapshot, appVersion]);

  useEffect(() => {
    setMessage(getTemplateBody(template, diagnostics));
    setCopied(false);
  }, [template, diagnostics]);

  const handleCopy = async () => {
    await copyToClipboard(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const openTelegram = async () => {
    await window.poe2Overlay.openExternal(PROJECT_FEEDBACK_URL);
  };

  return (
    <main className="settings-page report-page">
      <section className="settings-shell report-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">PoE2 Campaign Codex</p>
            <h1>Сообщить о проблеме</h1>
            <p className="helper-text settings-intro">
              Заполни шаблон, скопируй текст и отправь его в Telegram. Так проще понять, что именно сломалось.
            </p>
          </div>
          <div className="button-row no-drag report-header-actions">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              Закрыть
            </button>
          </div>
        </header>

        <section className="settings-card report-card">
          <div className="settings-card-header report-card-header">
            <div>
              <h2 className="settings-section-title">ШАБЛОН СООБЩЕНИЯ</h2>
              <p className="helper-text">
                Диагностика подставляется автоматически. Личные пути к файлам можно удалить перед отправкой, если не хочешь их показывать.
              </p>
            </div>
            <label className="select-field report-template-field no-drag">
              <span>Тип обращения</span>
              <select value={template} onChange={(event) => setTemplate(event.target.value as ReportTemplate)}>
                {(Object.keys(TEMPLATE_LABELS) as ReportTemplate[]).map((key) => (
                  <option key={key} value={key}>
                    {TEMPLATE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <textarea
            className="report-message-textarea no-drag"
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setCopied(false);
            }}
            spellCheck={false}
          />

          <div className="report-actions no-drag">
            <button className="button-primary" type="button" onClick={() => void handleCopy()}>
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
            <button className="button-secondary" type="button" onClick={() => void openTelegram()}>
              Написать в Telegram
            </button>
          </div>

          <p className="helper-text report-action-note">
            Лучше сначала нажать “Скопировать”, потом “Написать в Telegram” и вставить шаблон в сообщение.
          </p>
        </section>
      </section>
    </main>
  );
}
