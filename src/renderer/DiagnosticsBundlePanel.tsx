import { useEffect, useMemo, useState } from 'react';
import {
  buildDebugBundle,
  type DebugBundle
} from '../shared/debug-bundle';
import type { AppLanguage, AppSnapshot, AutoUpdateState } from '../shared/types';

type DiagnosticsBundlePanelProps = {
  snapshot: AppSnapshot | null;
  appVersion: string;
  language: AppLanguage;
  updateState?: AutoUpdateState | null;
  diagnosticsText?: string;
  variant?: 'card' | 'inline';
  id?: string;
  hidden?: boolean;
};

const LABELS = {
  ru: {
    title: 'Безопасный отладочный пакет',
    description: 'Проверь предпросмотр перед копированием или экспортом. Пути и приватные фрагменты скрыты.',
    preview: 'Предпросмотр отладочного пакета',
    copyDiagnostics: 'Копировать диагностику',
    copyBundle: 'Копировать отладочный пакет',
    exportBundle: 'Экспортировать отладочный пакет',
    copied: 'Скопировано',
    exported: 'Экспортировано',
    exportCanceled: 'Экспорт отменён',
    exportFailed: 'Не удалось экспортировать'
  },
  en: {
    title: 'Safe debug bundle',
    description: 'Review the preview before copying or exporting. Paths and private fragments are hidden.',
    preview: 'Debug bundle preview',
    copyDiagnostics: 'Copy diagnostics',
    copyBundle: 'Copy debug bundle',
    exportBundle: 'Export debug bundle',
    copied: 'Copied',
    exported: 'Exported',
    exportCanceled: 'Export canceled',
    exportFailed: 'Export failed'
  }
} satisfies Record<AppLanguage, Record<string, string>>;

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

export function DiagnosticsBundlePanel({
  snapshot,
  appVersion,
  language,
  updateState,
  diagnosticsText,
  variant = 'card',
  id,
  hidden = false
}: DiagnosticsBundlePanelProps) {
  const labels = LABELS[language] ?? LABELS.ru;
  const [logLines, setLogLines] = useState<string[]>([]);
  const [localUpdateState, setLocalUpdateState] = useState<AutoUpdateState | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let isMounted = true;

    void window.poe2Overlay.getDebugBundleLogTail()
      .then((lines) => {
        if (isMounted) {
          setLogLines(lines);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLogLines([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    snapshot?.config.logFilePath,
    snapshot?.runtime.watchedLogPath,
    snapshot?.runtime.lastReadAt,
    snapshot?.runtime.lastLogLineAt
  ]);

  useEffect(() => {
    if (updateState !== undefined) {
      return undefined;
    }

    let isMounted = true;
    void window.poe2Overlay.getAutoUpdateState()
      .then((state) => {
        if (isMounted) {
          setLocalUpdateState(state);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocalUpdateState(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [updateState]);

  const bundle: DebugBundle = useMemo(
    () => buildDebugBundle({
      snapshot,
      appVersion: appVersion || '—',
      language,
      platform: navigator.platform || 'unknown',
      updateState: updateState ?? localUpdateState,
      diagnosticsText,
      logLines,
      userAgent: navigator.userAgent
    }),
    [snapshot, appVersion, language, updateState, localUpdateState, diagnosticsText, logLines]
  );

  const showStatus = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(''), 2200);
  };

  const handleCopyDiagnostics = async () => {
    await copyToClipboard(bundle.diagnosticsText);
    showStatus(labels.copied);
  };

  const handleCopyBundle = async () => {
    await copyToClipboard(bundle.text);
    showStatus(labels.copied);
  };

  const handleExportBundle = async () => {
    try {
      const exported = await window.poe2Overlay.exportDebugBundle(bundle.text);
      showStatus(exported ? labels.exported : labels.exportCanceled);
    } catch {
      showStatus(labels.exportFailed);
    }
  };

  return (
    <section
      id={id}
      className={`debug-bundle-panel${variant === 'card' ? ' settings-card' : ''}`}
      hidden={hidden}
    >
      <div className="settings-card-header debug-bundle-header">
        <div>
          <h2 className="settings-section-title">{labels.title}</h2>
          <p className="helper-text">{labels.description}</p>
        </div>
      </div>

      <label className="debug-bundle-preview-field no-drag">
        <span>{labels.preview}</span>
        <textarea
          className="debug-bundle-preview no-drag"
          value={bundle.text}
          readOnly
          spellCheck={false}
        />
      </label>

      <div className="button-row debug-bundle-actions no-drag">
        <button className="button-secondary" type="button" onClick={() => void handleCopyDiagnostics()}>
          {labels.copyDiagnostics}
        </button>
        <button className="button-primary" type="button" onClick={() => void handleCopyBundle()}>
          {labels.copyBundle}
        </button>
        <button className="button-secondary" type="button" onClick={() => void handleExportBundle()}>
          {labels.exportBundle}
        </button>
      </div>

      {status ? <p className="helper-text debug-bundle-status">{status}</p> : null}
    </section>
  );
}
