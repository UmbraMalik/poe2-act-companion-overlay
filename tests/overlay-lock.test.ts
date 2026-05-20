import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOverlayLockButtonIcon,
  getOverlayLockButtonLabel,
  getResizeGripClassName,
  stopOverlayControlPropagation,
  toggleOverlayMovementLock
} from '../src/renderer/overlay-lock';

test('overlay lock button is icon-only and reflects the current movement flag', () => {
  assert.equal(getOverlayLockButtonIcon(false), '🔓');
  assert.equal(getOverlayLockButtonIcon(true), '🔒');
  assert.equal(getOverlayLockButtonLabel(false, 'ru'), 'Закрепить');
  assert.equal(getOverlayLockButtonLabel(true, 'ru'), 'Открепить');
});

test('overlay lock handler only prevents propagation and updates overlayMovementLocked', async () => {
  const calls: string[] = [];
  const event = {
    preventDefault: () => {
      calls.push('preventDefault');
    },
    stopPropagation: () => {
      calls.push('stopPropagation');
    }
  };
  const api = {
    updateSettings: async (patch: unknown) => {
      calls.push(`updateSettings:${JSON.stringify(patch)}`);
      return {} as never;
    },
    resizeOverlay: () => {
      calls.push('resizeOverlay');
      return Promise.resolve({} as never);
    }
  };

  await toggleOverlayMovementLock(event, api as never, false);

  assert.deepEqual(calls, [
    'preventDefault',
    'stopPropagation',
    'updateSettings:{"overlayMovementLocked":true}'
  ]);
});

test('overlay unlock handler only prevents propagation and updates overlayMovementLocked back to false', async () => {
  const calls: string[] = [];
  const event = {
    preventDefault: () => {
      calls.push('preventDefault');
    },
    stopPropagation: () => {
      calls.push('stopPropagation');
    }
  };
  const api = {
    updateSettings: async (patch: unknown) => {
      calls.push(`updateSettings:${JSON.stringify(patch)}`);
      return {} as never;
    }
  };

  await toggleOverlayMovementLock(event, api as never, true);

  assert.deepEqual(calls, [
    'preventDefault',
    'stopPropagation',
    'updateSettings:{"overlayMovementLocked":false}'
  ]);
});

test('locked resize grip stays in the DOM class list and only gains a disabled modifier', () => {
  assert.equal(getResizeGripClassName(false), 'resize-grip no-drag');
  assert.equal(getResizeGripClassName(true), 'resize-grip no-drag is-disabled');
});

test('overlay control pointer protection prevents default browser handling and stops propagation', () => {
  const calls: string[] = [];

  stopOverlayControlPropagation({
    preventDefault: () => {
      calls.push('preventDefault');
    },
    stopPropagation: () => {
      calls.push('stopPropagation');
    }
  });

  assert.deepEqual(calls, ['preventDefault', 'stopPropagation']);
});
