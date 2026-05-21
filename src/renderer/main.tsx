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

function getRendererPage(): RendererPage {
  const page = document.body.dataset.page;
  return page && page in pageLoaders ? (page as RendererPage) : 'overlay';
}

async function bootstrapRenderer() {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element was not found');
  }

  const Page = await pageLoaders[getRendererPage()]();

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <Page />
    </React.StrictMode>
  );
}

void bootstrapRenderer();
