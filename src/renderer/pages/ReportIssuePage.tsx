import { useEffect, useMemo, useState } from 'react';
import { useAppSnapshot } from '../hooks';
import { useDocumentTitle, useI18n } from '../useI18n';
import {
  buildReportDiagnostics,
  buildReportTemplateBody,
  getReportTemplateLabels,
  PROJECT_FEEDBACK_URL,
  type ReportTemplate
} from '../../shared/report-issue';

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
  const { t, language } = useI18n(snapshot?.config.appLanguage);
  const [appVersion, setAppVersion] = useState('—');
  const [template, setTemplate] = useState<ReportTemplate>('bug');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useDocumentTitle(t('titles.report'));

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

  const templateLabels = useMemo(() => getReportTemplateLabels(language), [language]);
  const diagnostics = useMemo(
    () => buildReportDiagnostics(snapshot, appVersion, language),
    [snapshot, appVersion, language]
  );

  useEffect(() => {
    setMessage(buildReportTemplateBody(template, diagnostics, language));
    setCopied(false);
  }, [template, diagnostics, language]);

  const handleCopy = async () => {
    await copyToClipboard(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const openTelegram = async () => {
    await window.poe2Overlay.openExternal(PROJECT_FEEDBACK_URL);
  };

  return (
    <main className={`settings-page report-page fx-${snapshot?.config.visualFxIntensity ?? 'normal'}`}>
      <section className="settings-shell report-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{t('report.title')}</h1>
            <p className="helper-text settings-intro">{t('report.intro')}</p>
          </div>
          <div className="button-row no-drag report-header-actions">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              {t('common.close')}
            </button>
          </div>
        </header>

        <section className="settings-card report-card">
          <div className="settings-card-header report-card-header">
            <div>
              <h2 className="settings-section-title">{t('report.templateTitle')}</h2>
              <p className="helper-text">{t('report.templateDescription')}</p>
            </div>
            <label className="select-field report-template-field no-drag">
              <span>{t('report.requestType')}</span>
              <select value={template} onChange={(event) => setTemplate(event.target.value as ReportTemplate)}>
                {(Object.keys(templateLabels) as ReportTemplate[]).map((key) => (
                  <option key={key} value={key}>
                    {templateLabels[key]}
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
            <button
              className={`button-primary report-copy-button${copied ? ' is-copied' : ''}`}
              type="button"
              onClick={() => void handleCopy()}
            >
              {copied ? t('report.copied') : t('report.copy')}
            </button>
            <button className="button-secondary" type="button" onClick={() => void openTelegram()}>
              {t('report.messageTelegram')}
            </button>
          </div>

          <p className="helper-text report-action-note">{t('report.actionHint')}</p>
        </section>
      </section>
    </main>
  );
}
