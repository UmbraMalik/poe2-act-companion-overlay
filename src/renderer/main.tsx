import React, { Component, type ComponentType, type ReactNode } from 'react';
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

interface RendererErrorBoundaryProps {
  children: ReactNode;
}

interface RendererErrorBoundaryState {
  error: Error | null;
}

class RendererErrorBoundary extends Component<RendererErrorBoundaryProps, RendererErrorBoundaryState> {
  state: RendererErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[renderer] Page render failed', error);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return <RendererFatalError error={this.state.error} />;
  }
}

function RendererFatalError({ error }: { error: Error }) {
  return (
    <main className="overlay-page density-normal scale-90">
      <section className="overlay-shell overlay-hud overlay-main-compact renderer-fatal-error">
        <h1>Renderer error</h1>
        <p>Страница приложения не смогла отрисоваться.</p>
        <pre>{error.message}</pre>
      </section>
    </main>
  );
}

function getRendererPage(): RendererPage {
  const page = document.body.dataset.page;
  return page && page in pageLoaders ? (page as RendererPage) : 'overlay';
}

function renderPage(Page: ComponentType) {
  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Root element was not found');
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <RendererErrorBoundary>
        <Page />
      </RendererErrorBoundary>
    </React.StrictMode>
  );
}

async function bootstrapRenderer() {
  const Page = await pageLoaders[getRendererPage()]();
  renderPage(Page);
}

void bootstrapRenderer().catch((error: unknown) => {
  const pageError = error instanceof Error ? error : new Error(String(error));
  console.error('[renderer] Page bootstrap failed', pageError);
  renderPage(() => <RendererFatalError error={pageError} />);
});
