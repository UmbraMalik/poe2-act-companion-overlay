import React, { type ComponentType } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

type RendererPage =
  | 'overlay'
  | 'settings'
  | 'close-confirm'
  | 'update'
  | 'companion'
  | 'info'
  | 'report'
  | 'community'
  | 'support';

type PageLoader = () => Promise<ComponentType>;

const pageLoaders: Record<RendererPage, PageLoader> = {
  overlay: async () => (await import('./pages/OverlayPage')).OverlayPage,
  settings: async () => (await import('./pages/SettingsPage')).SettingsPage,
  'close-confirm': async () => (await import('./pages/CloseConfirmPage')).CloseConfirmPage,
  update: async () => (await import('./pages/UpdatePage')).UpdatePage,
  companion: async () => (await import('./pages/CompanionPage')).CompanionPage,
  info: async () => (await import('./pages/InfoPage')).InfoPage,
  report: async () => (await import('./pages/ReportIssuePage')).ReportIssuePage,
  community: async () => (await import('./pages/CommunityPage')).CommunityPage,
  support: async () => (await import('./pages/SupportPage')).SupportPage
};

const CLICK_FEEDBACK_SCOPE_SELECTOR = [
  '.overlay-page',
  '.companion-page',
  '.settings-page',
  '.report-page',
  '.update-page',
  '.close-confirm-page',
  '.info-page',
  '.community-page',
  '.support-page'
].join(', ');

const CLICK_FEEDBACK_TARGET_SELECTOR = [
  'button'
].join(', ');

const CLICK_FEEDBACK_BURST_CLASS = 'click-feedback-burst';
const CLICK_FEEDBACK_ACTIVE_CLASS = 'is-click-feedback-active';
const clickFeedbackTimers = new WeakMap<HTMLElement, number>();

function getRendererPage(): RendererPage {
  const page = document.body.dataset.page;
  return page && page in pageLoaders ? (page as RendererPage) : 'overlay';
}

function getClickFeedbackTarget(event: PointerEvent): HTMLElement | null {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return null;
  }

  const rawTarget = event.target;

  if (!(rawTarget instanceof Element)) {
    return null;
  }

  const target = rawTarget.closest(CLICK_FEEDBACK_TARGET_SELECTOR);

  if (!(target instanceof HTMLElement) || !target.closest(CLICK_FEEDBACK_SCOPE_SELECTOR)) {
    return null;
  }

  if (
    target.matches(':disabled, [aria-disabled="true"], .is-disabled, .resize-grip') ||
    target.closest('[inert]')
  ) {
    return null;
  }

  if (target.classList.contains('toggle-card')) {
    const input = target.querySelector('input');
    return input?.disabled ? null : target;
  }

  if (rawTarget.closest('input, select, textarea')) {
    return null;
  }

  return target;
}

function triggerClickFeedback(event: PointerEvent, target: HTMLElement): void {
  const rect = target.getBoundingClientRect();
  const x = rect.width > 0 ? event.clientX - rect.left : rect.width / 2;
  const y = rect.height > 0 ? event.clientY - rect.top : rect.height / 2;
  const previousBurst = target.querySelector(`:scope > .${CLICK_FEEDBACK_BURST_CLASS}`);
  const previousTimer = clickFeedbackTimers.get(target);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  previousBurst?.remove();
  target.classList.remove(CLICK_FEEDBACK_ACTIVE_CLASS);
  void target.offsetWidth;

  const burst = document.createElement('span');
  burst.className = CLICK_FEEDBACK_BURST_CLASS;
  burst.setAttribute('aria-hidden', 'true');
  burst.style.setProperty('--click-x', `${x}px`);
  burst.style.setProperty('--click-y', `${y}px`);

  target.appendChild(burst);
  target.classList.add(CLICK_FEEDBACK_ACTIVE_CLASS);

  const cleanupTimer = window.setTimeout(() => {
    burst.remove();
    target.classList.remove(CLICK_FEEDBACK_ACTIVE_CLASS);
    clickFeedbackTimers.delete(target);
  }, 420);

  clickFeedbackTimers.set(target, cleanupTimer);
}

function installClickFeedback(): void {
  if (document.documentElement.dataset.clickFeedbackInstalled === 'true') {
    return;
  }

  document.documentElement.dataset.clickFeedbackInstalled = 'true';
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = getClickFeedbackTarget(event);

      if (!target) {
        return;
      }

      triggerClickFeedback(event, target);
    },
    { capture: true }
  );
}

async function bootstrapRenderer() {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element was not found');
  }

  installClickFeedback();

  const Page = await pageLoaders[getRendererPage()]();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>
  );
}

void bootstrapRenderer();
