import { useDocumentTitle, useI18n } from '../useI18n';
import { useAppSnapshot } from '../hooks';
import { getAppThemeClassName } from '../theme';

export function InfoPage() {
  const snapshot = useAppSnapshot();
  const { t } = useI18n(snapshot?.config.appLanguage);

  useDocumentTitle(t('titles.info'));

  return (
    <main className={`settings-page info-page fx-${snapshot?.config.visualFxIntensity ?? 'normal'} ${getAppThemeClassName(snapshot?.config.theme)}`}>
      <section className="settings-shell info-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{t('info.title')}</h1>
            <p className="helper-text settings-intro">{t('info.intro')}</p>
          </div>
          <div className="button-row no-drag">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              {t('common.close')}
            </button>
          </div>
        </header>

        <section className="settings-card support-card">
          <h2 className="settings-section-title">{t('info.aboutTitle')}</h2>
          <div className="support-copy">
            <p className="helper-text">{t('info.aboutText1')}</p>
            <p className="helper-text">{t('info.aboutText2')}</p>
          </div>
        </section>

        <section className="settings-card support-card">
          <h2 className="settings-section-title">{t('info.safetyTitle')}</h2>
          <div className="support-link-list">
            {[
              ['info.safety1Title', 'info.safety1Text'],
              ['info.safety2Title', 'info.safety2Text'],
              ['info.safety3Title', 'info.safety3Text'],
              ['info.safety4Title', 'info.safety4Text']
            ].map(([titleKey, textKey]) => (
              <div className="value-box" key={titleKey}>
                <strong>{t(titleKey)}</strong>
                <span>{t(textKey)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-section-title">{t('info.rightsTitle')}</h2>
          <div className="support-copy">
            <p className="helper-text">{t('info.rights1')}</p>
            <p className="helper-text">{t('info.rights2')}</p>
            <p className="helper-text">{t('info.rights3')}</p>
          </div>
        </section>
      </section>
    </main>
  );
}
