import supportQrImage from '../assets/support-qr.png';

const PROJECT_SITE_URL = 'https://umbramalik.github.io/poe2-campaign-codex/#';
const PROJECT_TELEGRAM_URL = 'https://t.me/POE2CampaignCodex';
const PROJECT_FEEDBACK_URL = 'https://t.me/POE2CampaignCodex?direct';

export function InfoPage() {
  const openExternal = async (url: string) => {
    await window.poe2Overlay.openExternal(url);
  };

  return (
    <main className="settings-page info-page">
      <section className="settings-shell info-shell">
        <header className="settings-header window-drag-strip">
          <div className="settings-header-copy">
            <p className="eyebrow">PoE2 Campaign Codex</p>
            <h1>Инфо и ссылки</h1>
            <p className="helper-text settings-intro">
              Здесь собраны полезные ссылки проекта и QR-код для поддержки разработки.
            </p>
          </div>
          <div className="button-row no-drag">
            <button className="button-secondary" type="button" onClick={() => window.close()}>
              Закрыть
            </button>
          </div>
        </header>

        <section className="settings-card support-card">
          <h2 className="settings-section-title">ССЫЛКИ ПРОЕКТА</h2>
          <p className="helper-text">
            Отдельное окно с быстрым доступом к сайту, Telegram и каналу обратной связи.
          </p>
          <div className="support-grid">
            <div className="support-copy">
              <div className="button-row">
                <button className="button-secondary" type="button" onClick={() => void openExternal(PROJECT_SITE_URL)}>
                  Открыть сайт
                </button>
                <button className="button-secondary" type="button" onClick={() => void openExternal(PROJECT_TELEGRAM_URL)}>
                  Telegram
                </button>
                <button className="button-secondary" type="button" onClick={() => void openExternal(PROJECT_FEEDBACK_URL)}>
                  Фидбек / баги
                </button>
              </div>

              <div className="support-link-list">
                <div className="value-box">
                  <strong>Сайт:</strong>
                  <span>{PROJECT_SITE_URL}</span>
                </div>
                <div className="value-box">
                  <strong>Telegram:</strong>
                  <span>{PROJECT_TELEGRAM_URL}</span>
                </div>
                <div className="value-box">
                  <strong>Фидбек:</strong>
                  <span>{PROJECT_FEEDBACK_URL}</span>
                </div>
              </div>
            </div>

            <div className="support-qr-card">
              <img src={supportQrImage} alt="QR-код для поддержки проекта" className="support-qr-image" />
              <div className="support-qr-copy">
                <h3>Поддержка проекта</h3>
                <p className="helper-text">
                  Если оверлей помог, можешь поддержать проект через QR-код. Это добровольная поддержка, не покупка доступа.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-card">
          <h2 className="settings-section-title">ПРАВА И СТАТУС ПРОЕКТА</h2>
          <div className="support-copy">
            <p className="helper-text">
              © 2026 UmbraMalik. POE2 Campaign Codex Overlay — публичная beta-версия и fan-made tool.
            </p>
            <p className="helper-text">
              Неофициальный фанатский инструмент для Path of Exile 2. Проект не связан с Grinding Gear Games, не одобрен и не поддерживается ими.
            </p>
            <p className="helper-text">
              Path of Exile 2, Path of Exile и связанные названия принадлежат их правообладателям. Сайт и приложение не используют официальные ассеты игры.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}
