import supportQrImage from '../assets/support-qr.png';
import alfaBankLogo from '../assets/support-alfa-bank-logo.png';
import donationAlertsLogo from '../assets/support-donationalerts-logo.png';
import { PROJECT_DONATION_ALERTS_URL } from '../../shared/community-links';
import { useDocumentTitle, useI18n } from '../useI18n';


export function SupportPage() {
  const { t } = useI18n();

  useDocumentTitle(t('titles.support'));

  const openExternal = async (url: string) => {
    await window.poe2Overlay.openExternal(url);
  };

  return (
    <main className="settings-page info-page support-page">
      <section className="settings-shell info-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{t('support.title')}</h1>
            <p className="helper-text settings-intro">{t('support.intro')}</p>
          </div>
          <div className="button-row no-drag">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              {t('common.close')}
            </button>
          </div>
        </header>

        <section className="settings-card support-card support-card-updated">
          <h2 className="settings-section-title">{t('support.supportTitle')}</h2>
          <div className="support-copy">
            <div className="support-copy-intro">
              <h3 className="support-main-title">{t('support.supportSubtitle')}</h3>
              <p className="helper-text">{t('support.supportDescription')}</p>
            </div>

            <div className="support-method-grid">
              <article className="support-method-card support-method-card-alfa">
                <div className="support-method-header">
                  <span className="support-method-icon" aria-hidden="true">
                    <img src={alfaBankLogo} alt="" className="support-method-icon-image support-method-icon-image-alfa" />
                  </span>
                  <div>
                    <p className="eyebrow support-method-kicker">Alfa-Bank</p>
                    <h4>{t('support.qrTransfer')}</h4>
                  </div>
                </div>

                <p className="helper-text">{t('support.qrHint')}</p>

                <div className="support-method-qr-box" aria-label={t('support.qrAria')}>
                  <div className="support-method-qr-copy">
                    <strong>{t('support.qrLabel')}</strong>
                    <span>{t('support.qrSubLabel')}</span>
                  </div>
                  <img src={supportQrImage} alt={t('support.qrImageAlt')} className="support-method-qr-image" />
                </div>

                <div className="value-box support-inline-box">
                  <strong>{t('support.comment')}</strong>
                  <span>Codex</span>
                </div>
              </article>

              <article className="support-method-card">
                <div className="support-method-header">
                  <span className="support-method-icon" aria-hidden="true">
                    <img src={donationAlertsLogo} alt="" className="support-method-icon-image support-method-icon-image-da" />
                  </span>
                  <div>
                    <p className="eyebrow support-method-kicker">DonationAlerts</p>
                    <h4>{t('support.donationTitle')}</h4>
                  </div>
                </div>
                <p className="helper-text">{t('support.donationText')}</p>
                <button className="button-secondary support-method-action" type="button" onClick={() => void openExternal(PROJECT_DONATION_ALERTS_URL)}>
                  {t('support.openDonationAlerts')}
                </button>
              </article>
            </div>

            <div className="value-box support-supporters-note">
              <strong>{t('support.supportersTitle')}</strong>
              <span>{t('support.supportersText')}</span>
            </div>

            <div className="support-tags" aria-label={t('support.supportTags')}>
              <span>Alfa-Bank</span>
              <span>DonationAlerts</span>
              <span>{t('support.title')}</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
