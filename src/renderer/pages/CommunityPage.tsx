import { COMMUNITY_LINKS } from '../../shared/community-links';
import { getCommunityLinkView } from '../../i18n/data';
import { useDocumentTitle, useI18n } from '../useI18n';

export function CommunityPage() {
  const { t, language } = useI18n();

  useDocumentTitle(t('titles.community'));

  const openExternal = async (url: string) => {
    await window.poe2Overlay.openExternal(url);
  };

  return (
    <main className="settings-page info-page">
      <section className="settings-shell info-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{t('community.title')}</h1>
            <p className="helper-text settings-intro">{t('community.intro')}</p>
          </div>
          <div className="button-row no-drag">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              {t('common.close')}
            </button>
          </div>
        </header>

        <section className="settings-card support-card">
          <h2 className="settings-section-title">{t('community.linksTitle')}</h2>
          <p className="helper-text">{t('community.linksDescription')}</p>
          <div className="support-link-list project-link-grid">
            {COMMUNITY_LINKS.map((link) => {
              const localizedLink = getCommunityLinkView(link, language);

              return (
                <div className="value-box project-link-box" key={link.url}>
                  <strong>{localizedLink.displayTitle}:</strong>
                  <span>{link.url}</span>
                  <p className="helper-text compact-helper-text">{localizedLink.displayDescription}</p>
                  <button className="button-secondary" type="button" onClick={() => void openExternal(link.url)}>
                    {localizedLink.displayAction}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
