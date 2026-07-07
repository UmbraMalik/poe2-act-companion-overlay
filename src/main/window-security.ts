import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shell, type BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

import {
  devServerUrl,
  isDev,
  isSafeExternalUrl
} from './app-environment';
import { resolveRuntimePath } from './services/runtime-paths';

type SecureWebPreferences = NonNullable<BrowserWindowConstructorOptions['webPreferences']>;

export function getSecureWebPreferences(): SecureWebPreferences {
  return {
    preload: join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    webSecurity: true,
    backgroundThrottling: false
    // Sandbox is not forced yet: preload compatibility needs a dedicated pass.
  };
}

function isAllowedAppNavigationUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'file:') {
      const appPageRoot = resolve(resolveRuntimePath('dist'));
      const targetPath = resolve(fileURLToPath(parsed));
      const relativePath = relative(appPageRoot, targetPath);
      return relativePath === '' || (relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath));
    }
    if (!isDev) {
      return false;
    }
    return parsed.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}

function openSafeExternalUrl(rawUrl: string): void {
  if (isSafeExternalUrl(rawUrl)) {
    void shell.openExternal(rawUrl);
  }
}

export function attachWindowNavigationGuards(targetWindow: BrowserWindow): void {
  targetWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppNavigationUrl(url)) {
      return;
    }
    event.preventDefault();
    openSafeExternalUrl(url);
  });

  targetWindow.webContents.setWindowOpenHandler(({ url }) => {
    openSafeExternalUrl(url);
    return { action: 'deny' };
  });
}
