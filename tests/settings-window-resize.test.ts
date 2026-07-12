import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSettingsWindowResizeRequest,
  getSettingsWindowInitialSize,
  resolveSettingsWindowResizeBounds,
  SETTINGS_WINDOW_MINIMUM_SIZE
} from '../src/shared/settings-window-resize';
import {
  invokeIpcHandler,
  resetElectronMockState
} from './helpers/electron-mock';
import { createTestAppInstance } from './helpers/zoneTestUtils';

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

test('settings resize request is based on the full drag distance in both directions', () => {
  const startBounds = { x: 100, y: 80, width: 880, height: 720 };
  const startPointer = { x: 975, y: 795 };

  assert.deepEqual(
    buildSettingsWindowResizeRequest({
      edge: 'se',
      startBounds,
      startPointer,
      currentPointer: { x: 1095, y: 875 }
    }),
    { edge: 'se', x: 100, y: 80, width: 1000, height: 800 }
  );

  assert.deepEqual(
    buildSettingsWindowResizeRequest({
      edge: 'se',
      startBounds,
      startPointer,
      currentPointer: { x: 795, y: 655 }
    }),
    { edge: 'se', x: 100, y: 80, width: 700, height: 580 }
  );
});

test('settings window can shrink to its real minimum and keeps the opposite edge stable', () => {
  const currentBounds = { x: 300, y: 200, width: 880, height: 720 };

  assert.deepEqual(
    resolveSettingsWindowResizeBounds({
      currentBounds,
      requestedBounds: {
        edge: 'nw',
        x: 760,
        y: 600,
        width: 420,
        height: 320
      },
      workArea
    }),
    {
      x: 620,
      y: 500,
      width: SETTINGS_WINDOW_MINIMUM_SIZE.width,
      height: SETTINGS_WINDOW_MINIMUM_SIZE.height
    }
  );
});

test('settings initial size stays compact on smaller work areas', () => {
  assert.deepEqual(
    getSettingsWindowInitialSize({ width: 800, height: 600 }),
    { width: 752, height: 552 }
  );
});

test('settings resize IPC accepts an absolute shrink request', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.settingsWindow = new BrowserWindow({
    width: 880,
    height: 720,
    minWidth: SETTINGS_WINDOW_MINIMUM_SIZE.width,
    minHeight: SETTINGS_WINDOW_MINIMUM_SIZE.height
  });
  app.settingsWindow.setPosition(100, 80);
  app.registerIpc();

  const changed = await invokeIpcHandler<boolean>('app:resize-settings-window', {
    edge: 'se',
    x: 100,
    y: 80,
    width: 700,
    height: 560
  });

  assert.equal(changed, true);
  assert.deepEqual(app.settingsWindow.getBounds(), {
    x: 100,
    y: 80,
    width: 700,
    height: 560
  });
});
