import React from 'react';
import ReactDOM from 'react-dom/client';
import { CompanionPage } from './pages/CompanionPage';
import { CloseConfirmPage } from './pages/CloseConfirmPage';
import { OverlayPage } from './pages/OverlayPage';
import { SettingsPage } from './pages/SettingsPage';
import { InfoPage } from './pages/InfoPage';
import { ReportIssuePage } from './pages/ReportIssuePage';
import { UpdatePage } from './pages/UpdatePage';
import './styles.css';

const page = document.body.dataset.page;
const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {page === 'settings' ? (
      <SettingsPage />
    ) : page === 'close-confirm' ? (
      <CloseConfirmPage />
    ) : page === 'update' ? (
      <UpdatePage />
    ) : page === 'companion' ? (
      <CompanionPage />
    ) : page === 'info' ? (
      <InfoPage />
    ) : page === 'report' ? (
      <ReportIssuePage />
    ) : (
      <OverlayPage />
    )}
  </React.StrictMode>
);
