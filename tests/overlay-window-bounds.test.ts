import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planOverlayBoundsChange,
  shouldIgnoreOverlayAutoHeight
} from '../src/main/overlay-window-bounds';
import {
  invokeIpcHandler,
  resetElectronMockState
} from './helpers/electron-mock';
import { createTestAppInstance } from './helpers/zoneTestUtils';

test('dragMove source keeps width and height locked to current bounds', () => {
  const plan = planOverlayBoundsChange({
    source: 'dragMove',
    currentBounds: { x: 120, y: 80, width: 640, height: 420 },
    requestedBounds: { x: 180, y: 125, width: 999, height: 777 }
  });

  assert.equal(plan.applyMode, 'setPosition');
  assert.deepEqual(plan.nextBounds, { x: 180, y: 125, width: 640, height: 420 });
  assert.equal(plan.suspiciousSizeChange, true);
});

test('auto-height helper ignores resize requests while dragging or suspended', () => {
  assert.equal(
    shouldIgnoreOverlayAutoHeight({
      dragInProgress: true,
      suspendedUntil: 0,
      now: 10
    }),
    true
  );
  assert.equal(
    shouldIgnoreOverlayAutoHeight({
      dragInProgress: false,
      suspendedUntil: 50,
      now: 10
    }),
    true
  );
  assert.equal(
    shouldIgnoreOverlayAutoHeight({
      dragInProgress: false,
      suspendedUntil: 5,
      now: 10
    }),
    false
  );
});

test('overlay bounds IPC returns the current overlay window bounds from main process', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.overlayWindow.setPosition(140, 95);
  app.registerIpc();

  const bounds = await invokeIpcHandler('app:get-overlay-bounds');

  assert.deepEqual(bounds, { x: 140, y: 95, width: 520, height: 410 });
});

test('absolute overlay position IPC repositions the overlay without changing width or height', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.overlayWindow.setPosition(140, 95);
  app.registerIpc();

  await invokeIpcHandler('app:set-overlay-position', 188, 79);
  const after = app.overlayWindow.getBounds();

  assert.equal(after.x, 188);
  assert.equal(after.y, 79);
  assert.equal(after.width, 520);
  assert.equal(after.height, 410);
});

test('auto-height IPC is ignored while overlay drag is active', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.registerIpc();

  const before = app.overlayWindow.getBounds();
  await invokeIpcHandler('app:set-overlay-drag-active', true);
  await invokeIpcHandler('app:resize-overlay-height', before.height + 180);
  const after = app.overlayWindow.getBounds();

  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
});

test('manual resize IPC still changes overlay width and height', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.registerIpc();

  await invokeIpcHandler('app:resize-overlay', 680, 460);
  const after = app.overlayWindow.getBounds();

  assert.equal(after.width, 680);
  assert.equal(after.height, 460);
});
