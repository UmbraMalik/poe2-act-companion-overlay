import { useEffect, useRef } from 'react';

export function CloseConfirmPage() {
  const stayButtonRef = useRef<HTMLButtonElement | null>(null);

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
            <p className="eyebrow">PoE2 Campaign Codex</p>
            <h1>Таймер запущен</h1>
          </div>
          <button
            className="button-secondary close-confirm-close no-drag"
            type="button"
            aria-label="Остаться и закрыть окно подтверждения"
            title="Остаться"
            onClick={() => void window.poe2Overlay.cancelCloseConfirm()}
          >
            ×
          </button>
        </header>

        <div className="close-confirm-content">
          <p className="close-confirm-message">
            Таймер забега сейчас работает. Если закрыть приложение, таймер будет поставлен на
            паузу, а текущее время сохранится.
          </p>
          <p className="close-confirm-note">
            После следующего запуска можно будет продолжить с этого момента.
          </p>
        </div>

        <div className="button-row close-confirm-actions no-drag">
          <button
            ref={stayButtonRef}
            className="button-secondary"
            type="button"
            onClick={() => void window.poe2Overlay.cancelCloseConfirm()}
          >
            Остаться
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={() => void window.poe2Overlay.confirmCloseAndSave()}
          >
            Закрыть и сохранить
          </button>
        </div>
      </section>
    </main>
  );
}
