import type { SettingsWindowBoundsPatch, SettingsWindowResizeEdge } from './types';

export const SETTINGS_WINDOW_MINIMUM_SIZE = { width: 560, height: 420 } as const;
export const SETTINGS_WINDOW_PREFERRED_SIZE = { width: 1120, height: 900 } as const;
export const UTILITY_WINDOW_MINIMUM_SIZES = {
  settings: SETTINGS_WINDOW_MINIMUM_SIZE,
  info: { width: 680, height: 620 },
  community: { width: 680, height: 560 },
  support: { width: 680, height: 560 },
  report: { width: 720, height: 620 }
} as const;
export const SETTINGS_WINDOW_WORK_AREA_MARGIN = 24;
export const SETTINGS_WINDOW_RESIZE_SAFE_MARGIN = 8;

export interface SettingsWindowPoint {
  x: number;
  y: number;
}

export interface SettingsWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SettingsWindowSize {
  width: number;
  height: number;
}

const SETTINGS_WINDOW_RESIZE_EDGES = new Set<SettingsWindowResizeEdge>([
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'nw'
]);

function finiteRoundedNumber(value: unknown, fallback: number): number {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? Math.round(numericValue)
    : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isSettingsWindowResizeEdge(value: unknown): value is SettingsWindowResizeEdge {
  return typeof value === 'string' && SETTINGS_WINDOW_RESIZE_EDGES.has(value as SettingsWindowResizeEdge);
}

export function getSettingsWindowInitialSize(workArea: SettingsWindowSize): SettingsWindowSize {
  const availableWidth = Math.max(
    SETTINGS_WINDOW_MINIMUM_SIZE.width,
    workArea.width - SETTINGS_WINDOW_WORK_AREA_MARGIN * 2
  );
  const availableHeight = Math.max(
    SETTINGS_WINDOW_MINIMUM_SIZE.height,
    workArea.height - SETTINGS_WINDOW_WORK_AREA_MARGIN * 2
  );

  return {
    width: Math.min(SETTINGS_WINDOW_PREFERRED_SIZE.width, availableWidth),
    height: Math.min(SETTINGS_WINDOW_PREFERRED_SIZE.height, availableHeight)
  };
}

export function buildSettingsWindowResizeRequest(options: {
  edge: SettingsWindowResizeEdge;
  startBounds: SettingsWindowBounds;
  startPointer: SettingsWindowPoint;
  currentPointer: SettingsWindowPoint;
}): SettingsWindowBoundsPatch {
  const { edge, startBounds, startPointer, currentPointer } = options;
  const deltaX = currentPointer.x - startPointer.x;
  const deltaY = currentPointer.y - startPointer.y;
  let x = startBounds.x;
  let y = startBounds.y;
  let width = startBounds.width;
  let height = startBounds.height;

  if (edge.includes('e')) {
    width = startBounds.width + deltaX;
  }
  if (edge.includes('s')) {
    height = startBounds.height + deltaY;
  }
  if (edge.includes('w')) {
    x = startBounds.x + deltaX;
    width = startBounds.width - deltaX;
  }
  if (edge.includes('n')) {
    y = startBounds.y + deltaY;
    height = startBounds.height - deltaY;
  }

  return { edge, x, y, width, height };
}

export function resolveSettingsWindowResizeBounds(options: {
  currentBounds: SettingsWindowBounds;
  requestedBounds: SettingsWindowBoundsPatch | null | undefined;
  workArea: SettingsWindowBounds;
  minimumSize?: SettingsWindowSize;
  safeMargin?: number;
}): SettingsWindowBounds {
  const {
    currentBounds,
    requestedBounds,
    workArea,
    minimumSize = SETTINGS_WINDOW_MINIMUM_SIZE,
    safeMargin = SETTINGS_WINDOW_RESIZE_SAFE_MARGIN
  } = options;
  const request = requestedBounds && typeof requestedBounds === 'object'
    ? requestedBounds
    : {};
  const edge = isSettingsWindowResizeEdge(request.edge) ? request.edge : null;
  const hasAbsoluteBounds = [request.x, request.y, request.width, request.height]
    .some((value) => Number.isFinite(Number(value)));
  let requestedX = finiteRoundedNumber(request.x, currentBounds.x);
  let requestedY = finiteRoundedNumber(request.y, currentBounds.y);
  let requestedWidth = finiteRoundedNumber(request.width, currentBounds.width);
  let requestedHeight = finiteRoundedNumber(request.height, currentBounds.height);

  if (edge && !hasAbsoluteBounds) {
    const deltaX = finiteRoundedNumber(request.deltaX, 0);
    const deltaY = finiteRoundedNumber(request.deltaY, 0);
    const right = currentBounds.x + currentBounds.width;
    const bottom = currentBounds.y + currentBounds.height;

    if (edge.includes('e')) {
      requestedWidth = currentBounds.width + deltaX;
    }
    if (edge.includes('s')) {
      requestedHeight = currentBounds.height + deltaY;
    }
    if (edge.includes('w')) {
      requestedWidth = currentBounds.width - deltaX;
      requestedX = right - requestedWidth;
    }
    if (edge.includes('n')) {
      requestedHeight = currentBounds.height - deltaY;
      requestedY = bottom - requestedHeight;
    }
  }

  const maxWidth = Math.max(minimumSize.width, workArea.width - safeMargin * 2);
  const maxHeight = Math.max(minimumSize.height, workArea.height - safeMargin * 2);
  const nextWidth = clamp(requestedWidth, minimumSize.width, maxWidth);
  const nextHeight = clamp(requestedHeight, minimumSize.height, maxHeight);

  if (edge?.includes('w')) {
    const requestedRight = requestedX + requestedWidth;
    requestedX = requestedRight - nextWidth;
  }
  if (edge?.includes('n')) {
    const requestedBottom = requestedY + requestedHeight;
    requestedY = requestedBottom - nextHeight;
  }

  const minX = workArea.x + safeMargin;
  const minY = workArea.y + safeMargin;
  const maxX = Math.max(minX, workArea.x + workArea.width - nextWidth - safeMargin);
  const maxY = Math.max(minY, workArea.y + workArea.height - nextHeight - safeMargin);

  return {
    x: clamp(requestedX, minX, maxX),
    y: clamp(requestedY, minY, maxY),
    width: nextWidth,
    height: nextHeight
  };
}
