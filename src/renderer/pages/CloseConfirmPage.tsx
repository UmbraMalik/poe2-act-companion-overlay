import { useEffect, useRef } from 'react';
import { useDocumentTitle, useI18n } from '../useI18n';

export function CloseConfirmPage() {
  const stayButtonRef = useRef<HTMLButtonElement | null>(null);
  const { t } = useI18n();

  useDocumentTitle(t('titles.closeConfirm'));

  useEffect(() => {
    stayButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void window.poe2Overlay.cancelCloseConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <main className="close-confirm-page">
      <section className="close-confirm-shell">
        <header className="close-confirm-header">
          <div className="close-confirm-header-copy">
            <p className="eyebrow">{t('common.appName')}</p>
            <h1>{t('closeConfirm.title')}</h1>
          </div>
          <button
            className="button-secondary close-confirm-close no-drag"
            type="button"
            aria-label={t('closeConfirm.closeLabel')}
            title={t('closeConfirm.stay')}
            onClick={() => void window.poe2Overlay.cancelCloseConfirm()}
          >
            ×
          </button>
        </header>

        <div className="close-confirm-content">
          <p className="close-confirm-message">{t('closeConfirm.message')}</p>
          <p className="close-confirm-note">{t('closeConfirm.note')}</p>
        </div>

        <div className="button-row close-confirm-actions no-drag">
          <button
            ref={stayButtonRef}
            className="button-secondary"
            type="button"
            onClick={() => void window.poe2Overlay.cancelCloseConfirm()}
          >
            {t('closeConfirm.stay')}
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={() => void window.poe2Overlay.confirmCloseAndSave()}
          >
            {t('closeConfirm.closeAndSave')}
          </button>
        </div>
      </section>
    </main>
  );
}
