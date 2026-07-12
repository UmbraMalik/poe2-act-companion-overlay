import type { OverlayBounds } from '../shared/types';

export type OverlayBoundsChangeSource =
  | 'dragMove'
  | 'manualResize'
  | 'autoHeight'
  | 'modeSwitch'
  | 'restoreBounds'
  | 'unknown';

export type OverlayBoundsApplyMode = 'none' | 'setPosition' | 'setBounds';

export interface WindowWorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function fitBoundsToWorkArea(
  bounds: OverlayBounds,
  workArea: WindowWorkArea,
  minimumSize: { width: number; height: number }
): OverlayBounds {
  const availableWidth = Math.max(1, Math.round(workArea.width));
  const availableHeight = Math.max(1, Math.round(workArea.height));
  const minimumWidth = Math.min(Math.max(1, Math.round(minimumSize.width)), availableWidth);
  const minimumHeight = Math.min(Math.max(1, Math.round(minimumSize.height)), availableHeight);
  const width = Math.min(availableWidth, Math.max(minimumWidth, Math.round(bounds.width)));
  const height = Math.min(availableHeight, Math.max(minimumHeight, Math.round(bounds.height)));
  const minimumX = Math.round(workArea.x);
  const minimumY = Math.round(workArea.y);
  const maximumX = minimumX + availableWidth - width;
  const maximumY = minimumY + availableHeight - height;

  return {
    x: Math.min(maximumX, Math.max(minimumX, Math.round(bounds.x))),
    y: Math.min(maximumY, Math.max(minimumY, Math.round(bounds.y))),
    width,
    height
  };
}

const SIZE_CHANGE_ALLOWED_SOURCES = new Set<OverlayBoundsChangeSource>([
  'manualResize',
  'autoHeight',
  'modeSwitch',
  'restoreBounds'
]);

function roundBounds(
  bounds: OverlayBounds,
  fallback: OverlayBounds
): OverlayBounds {
  const roundFinite = (value: unknown, fallbackValue: number): number => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.round(numberValue) : fallbackValue;
  };

  return {
    x: roundFinite(bounds.x, fallback.x),
    y: roundFinite(bounds.y, fallback.y),
    width: roundFinite(bounds.width, fallback.width),
    height: roundFinite(bounds.height, fallback.height)
  };
}

export function areOverlayBoundsEqual(
  left: OverlayBounds,
  right: OverlayBounds
): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function areOverlayBoundsSizeEqual(
  left: OverlayBounds,
  right: OverlayBounds
): boolean {
  return left.width === right.width && left.height === right.height;
}

export function canSourceChangeOverlaySize(
  source: OverlayBoundsChangeSource
): boolean {
  return SIZE_CHANGE_ALLOWED_SOURCES.has(source);
}

export interface OverlayBoundsChangePlan {
  source: OverlayBoundsChangeSource;
  currentBounds: OverlayBounds;
  requestedBounds: OverlayBounds;
  nextBounds: OverlayBounds;
  applyMode: OverlayBoundsApplyMode;
  changed: boolean;
  suspiciousSizeChange: boolean;
}

export function planOverlayBoundsChange(input: {
  source: OverlayBoundsChangeSource;
  currentBounds: OverlayBounds;
  requestedBounds: OverlayBounds;
}): OverlayBoundsChangePlan {
  const currentBounds = roundBounds(input.currentBounds, input.currentBounds);
  const requestedBounds = roundBounds(input.requestedBounds, currentBounds);

  if (input.source === 'dragMove') {
    const nextBounds = {
      x: requestedBounds.x,
      y: requestedBounds.y,
      width: currentBounds.width,
      height: currentBounds.height
    };

    return {
      source: input.source,
      currentBounds,
      requestedBounds,
      nextBounds,
      applyMode:
        nextBounds.x === currentBounds.x && nextBounds.y === currentBounds.y
          ? 'none'
          : 'setPosition',
      changed: !areOverlayBoundsEqual(currentBounds, nextBounds),
      suspiciousSizeChange:
        requestedBounds.width !== currentBounds.width ||
        requestedBounds.height !== currentBounds.height
    };
  }

  const nextBounds = requestedBounds;
  const sizeChanged = !areOverlayBoundsSizeEqual(currentBounds, nextBounds);

  return {
    source: input.source,
    currentBounds,
    requestedBounds,
    nextBounds,
    applyMode: areOverlayBoundsEqual(currentBounds, nextBounds) ? 'none' : 'setBounds',
    changed: !areOverlayBoundsEqual(currentBounds, nextBounds),
    suspiciousSizeChange: sizeChanged && !canSourceChangeOverlaySize(input.source)
  };
}

export function shouldIgnoreOverlayAutoHeight(input: {
  dragInProgress: boolean;
  suspendedUntil: number;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  return input.dragInProgress || now < input.suspendedUntil;
}
