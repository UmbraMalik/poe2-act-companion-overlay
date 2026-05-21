import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOverlayDragBlockedTarget,
  shouldStartOverlayDrag
} from '../src/shared/overlay-drag';

function makeTarget(blocked = false) {
  return {
    closest: (_selector: string) => (blocked ? { nodeName: 'BUTTON' } : null)
  } as EventTarget & { closest: (selector: string) => unknown };
}

test('overlay drag starts only from free left-click targets', () => {
  assert.equal(shouldStartOverlayDrag(makeTarget(false), { button: 0 }), true);
  assert.equal(shouldStartOverlayDrag(makeTarget(false), { button: 1 }), false);
});

test('overlay drag is blocked for buttons, links, inputs and resize handles', () => {
  assert.equal(isOverlayDragBlockedTarget(makeTarget(true)), true);
  assert.equal(shouldStartOverlayDrag(makeTarget(true), { button: 0 }), false);
});

test('overlay drag safely refuses unknown targets without closest()', () => {
  assert.equal(isOverlayDragBlockedTarget(null), true);
  assert.equal(isOverlayDragBlockedTarget({} as EventTarget), true);
  assert.equal(shouldStartOverlayDrag({} as EventTarget, { button: 0 }), false);
});
