import { COMMUNITY_LINKS } from '../../shared/community-links';
import { getCommunityLinkView } from '../../i18n/data';
import { useDocumentTitle, useI18n } from '../useI18n';
import { useUiPreferencesSnapshot } from '../hooks';
import { getAppThemeClassName } from '../theme';
import { UtilityWindowFrame } from '../UtilityWindowFrame';

export function CommunityPage() {
  const snapshot = useUiPreferencesSnapshot();
  const { t, language } = useI18n(snapshot?.config.appLanguage);

  useDocumentTitle(t('titles.community'));

  const openExternal = async (url: string) => {
    await window.poe2Overlay.openExternal(url);
  };

  return (
    <UtilityWindowFrame
      appName={t('common.appName')}
      title={t('community.title')}
      intro={t('community.intro')}
      closeLabel={t('common.close')}
      visualFxIntensity={snapshot?.config.visualFxIntensity ?? 'normal'}
      themeClassName={getAppThemeClassName(snapshot?.config.theme)}
      pageClassName="info-page community-page"
      shellClassName="info-shell"
    >
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
    </UtilityWindowFrame>
  );
}
