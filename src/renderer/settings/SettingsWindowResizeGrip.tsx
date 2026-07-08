import { type PointerEvent as ReactPointerEvent } from 'react';
import type { SettingsWindowBoundsPatch } from '../../shared/types';

const MIN_SETTINGS_WINDOW_WIDTH = 720;
const MIN_SETTINGS_WINDOW_HEIGHT = 600;
const SETTINGS_WINDOW_SAFE_MARGIN = 8;

type ResizeEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const RESIZE_EDGES: ResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

function getResizeLimits() {
  return {
    maxWidth: Math.max(MIN_SETTINGS_WINDOW_WIDTH, Math.round(window.screen.availWidth - SETTINGS_WINDOW_SAFE_MARGIN * 2)),
    maxHeight: Math.max(MIN_SETTINGS_WINDOW_HEIGHT, Math.round(window.screen.availHeight - SETTINGS_WINDOW_SAFE_MARGIN * 2))
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildNextBounds(
  edge: ResizeEdge,
  currentBounds: Required<SettingsWindowBoundsPatch>,
  deltaX: number,
  deltaY: number,
  limits: ReturnType<typeof getResizeLimits>
) {
  let nextX = currentBounds.x;
  let nextY = currentBounds.y;
  let nextWidth = currentBounds.width;
  let nextHeight = currentBounds.height;

  if (edge.includes('e')) {
    nextWidth = clamp(currentBounds.width + deltaX, MIN_SETTINGS_WINDOW_WIDTH, limits.maxWidth);
  }

  if (edge.includes('s')) {
    nextHeight = clamp(currentBounds.height + deltaY, MIN_SETTINGS_WINDOW_HEIGHT, limits.maxHeight);
  }

  if (edge.includes('w')) {
    const right = currentBounds.x + currentBounds.width;
    nextWidth = clamp(currentBounds.width - deltaX, MIN_SETTINGS_WINDOW_WIDTH, limits.maxWidth);
    nextX = right - nextWidth;
  }

  if (edge.includes('n')) {
    const bottom = currentBounds.y + currentBounds.height;
    nextHeight = clamp(currentBounds.height - deltaY, MIN_SETTINGS_WINDOW_HEIGHT, limits.maxHeight);
    nextY = bottom - nextHeight;
  }

  return {
    x: Math.round(nextX),
    y: Math.round(nextY),
    width: Math.round(nextWidth),
    height: Math.round(nextHeight)
  };
}

export function SettingsWindowResizeGrip() {
  const handlePointerDown = (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const handleElement = event.currentTarget;
    handleElement.setPointerCapture?.(event.pointerId);

    const limits = getResizeLimits();
    let lastX = event.screenX;
    let lastY = event.screenY;
    let nextBounds = {
      x: Math.round(window.screenX),
      y: Math.round(window.screenY),
      width: clamp(Math.round(window.innerWidth), MIN_SETTINGS_WINDOW_WIDTH, limits.maxWidth),
      height: clamp(Math.round(window.innerHeight), MIN_SETTINGS_WINDOW_HEIGHT, limits.maxHeight)
    };
    let animationFrame = 0;

    const requestResize = () => {
      animationFrame = 0;
      void window.poe2Overlay?.resizeSettingsWindow(nextBounds);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.screenX - lastX;
      const deltaY = moveEvent.screenY - lastY;
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;
      nextBounds = buildNextBounds(edge, nextBounds, deltaX, deltaY, limits);
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(requestResize);
      }
    };

    const cleanup = () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        requestResize();
      }
      if (handleElement.hasPointerCapture?.(event.pointerId)) {
        handleElement.releasePointerCapture(event.pointerId);
      }
      document.body.classList.remove('settings-window-resizing');
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', cleanup);
      document.removeEventListener('pointercancel', cleanup);
    };

    document.body.classList.add('settings-window-resizing');
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', cleanup, { once: true });
    document.addEventListener('pointercancel', cleanup, { once: true });
  };

  return (
    <div className="settings-window-resize-handles" aria-hidden="true">
      {RESIZE_EDGES.map((edge) => (
        <div
          className={`settings-window-resize-handle settings-window-resize-handle--${edge}`}
          key={edge}
          onPointerDown={handlePointerDown(edge)}
        />
      ))}
    </div>
  );
}
