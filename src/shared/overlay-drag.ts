const OVERLAY_DRAG_BLOCKING_SELECTORS = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'label',
  '[role="button"]',
  '[data-overlay-control="true"]',
  '[contenteditable="true"]',
  '.no-drag',
  '.resize-grip'
].join(',');

function hasClosest(
  target: EventTarget | null
): target is EventTarget & { closest: (selector: string) => unknown } {
  return Boolean(target && typeof (target as { closest?: unknown }).closest === 'function');
}

export function isOverlayDragBlockedTarget(target: EventTarget | null): boolean {
  if (!hasClosest(target)) {
    return true;
  }

  return Boolean(target.closest(OVERLAY_DRAG_BLOCKING_SELECTORS));
}

export function shouldStartOverlayDrag(
  target: EventTarget | null,
  {
    button = 0
  }: {
    button?: number;
  } = {}
): boolean {
  if (button !== 0) {
    return false;
  }

  return !isOverlayDragBlockedTarget(target);
}
