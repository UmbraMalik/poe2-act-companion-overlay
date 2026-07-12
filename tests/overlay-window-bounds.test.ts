import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fitBoundsToWorkArea,
  planOverlayBoundsChange,
  shouldIgnoreOverlayAutoHeight
} from '../src/main/overlay-window-bounds';
import {
  invokeIpcHandler,
  resetElectronMockState
} from './helpers/electron-mock';
import { createTestAppInstance } from './helpers/zoneTestUtils';

test('window bounds are fitted fully inside the selected display work area', () => {
  assert.deepEqual(
    fitBoundsToWorkArea(
      { x: 2400, y: 1300, width: 1000, height: 900 },
      { x: 0, y: 0, width: 2560, height: 1440 },
      { width: 720, height: 520 }
    ),
    { x: 1560, y: 540, width: 1000, height: 900 }
  );

  assert.deepEqual(
    fitBoundsToWorkArea(
      { x: -500, y: -400, width: 4000, height: 3000 },
      { x: 1920, y: 0, width: 1920, height: 1080 },
      { width: 720, height: 520 }
    ),
    { x: 1920, y: 0, width: 1920, height: 1080 }
  );
});

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

test('dragMove source keeps zero coordinates as valid movement targets', () => {
  const plan = planOverlayBoundsChange({
    source: 'dragMove',
    currentBounds: { x: 140, y: 95, width: 520, height: 410 },
    requestedBounds: { x: 0, y: 0, width: 520, height: 410 }
  });

  assert.equal(plan.applyMode, 'setPosition');
  assert.deepEqual(plan.nextBounds, { x: 0, y: 0, width: 520, height: 410 });
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

test('absolute overlay position IPC accepts zero coordinates', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.overlayWindow.setPosition(140, 95);
  app.registerIpc();

  await invokeIpcHandler('app:set-overlay-position', 0, 0);
  const after = app.overlayWindow.getBounds();

  assert.equal(after.x, 0);
  assert.equal(after.y, 0);
  assert.equal(after.width, 520);
  assert.equal(after.height, 410);
});

test('overlay mode IPC ignores unknown mode values', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  app.overlayMode = 'full';
  app.runtime.overlayMode = 'full';
  const previousConfigMode = app.config.mainOverlaySettings.overlayMode;
  app.registerIpc();

  await invokeIpcHandler('app:set-overlay-mode', 'banana');
  await invokeIpcHandler('app:update-settings', {
    mainOverlaySettings: {
      overlayMode: 'floating'
    }
  });

  assert.equal(app.overlayMode, 'full');
  assert.equal(app.runtime.overlayMode, 'full');
  assert.equal(app.config.mainOverlaySettings.overlayMode, previousConfigMode);
});

test('auto-height IPC is ignored while overlay drag is active', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.registerIpc();

  const before = app.overlayWindow.getBounds();
  await invokeIpcHandler('app:set-overlay-drag-active', true);
  const changed = await invokeIpcHandler<boolean>('app:resize-overlay-height', before.height + 180);
  const after = app.overlayWindow.getBounds();

  assert.equal(changed, false);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
});

test('manual resize IPC still changes overlay width and height', async () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.overlayWindow = new BrowserWindow({ width: 520, height: 410 });
  app.registerIpc();

  const changed = await invokeIpcHandler<boolean>('app:resize-overlay', 680, 460);
  const after = app.overlayWindow.getBounds();
  const unchanged = await invokeIpcHandler<boolean>('app:resize-overlay', after.width, after.height);

  assert.equal(changed, true);
  assert.equal(unchanged, false);
  assert.equal(after.width, 680);
  assert.equal(after.height, 460);
});

test('timer-only mode never restores stale full-height bounds', () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;

  const normalizedTimerOnly = app.normalizeOverlayBoundsForMode(
    { x: 120, y: 80, width: 520, height: 920 },
    'timer_only',
    'normal'
  );
  const defaultTimerOnly = app.getOverlayScaledDefaultBounds('timer_only', 'normal');
  const maximumTimerOnlyHeight = defaultTimerOnly.height + 120;

  assert.equal(normalizedTimerOnly.height, maximumTimerOnlyHeight);

  const normalizedFull = app.normalizeOverlayBoundsForMode(
    { x: 120, y: 80, width: 520, height: 920 },
    'full',
    'normal'
  );

  assert.equal(normalizedFull.height, 920);
});

test('companion bounds flush saves the last resize without waiting for debounce', () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  const { BrowserWindow } = require('electron') as typeof import('electron');

  app.companionWindow = new BrowserWindow({ width: 1180, height: 820 });
  app.companionWindow.setPosition(180, 120);
  app.companionBoundsTimer = setTimeout(() => undefined, 10_000);

  const changed = app.persistCompanionBoundsImmediately();

  assert.equal(changed, true);
  assert.equal(app.companionBoundsTimer, null);
  assert.deepEqual(app.config.companionBounds, { x: 180, y: 120, width: 1180, height: 820 });
  assert.equal(app.persistCompanionBoundsImmediately(), false);
});

test('companion bounds restore is clamped to the visible display', () => {
  resetElectronMockState();
  const app = createTestAppInstance() as any;
  app.config.companionBounds = { x: 2400, y: 1300, width: 1000, height: 900 };

  assert.deepEqual(app.getCompanionBounds(), { x: 1560, y: 540, width: 1000, height: 900 });
});
