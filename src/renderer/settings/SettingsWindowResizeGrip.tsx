import { type PointerEvent as ReactPointerEvent } from 'react';
import {
  buildSettingsWindowResizeRequest,
  type SettingsWindowBounds
} from '../../shared/settings-window-resize';
import type { SettingsWindowBoundsPatch, SettingsWindowResizeEdge } from '../../shared/types';

const RESIZE_EDGES: SettingsWindowResizeEdge[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export function SettingsWindowResizeGrip() {
  const handlePointerDown = (edge: SettingsWindowResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const handleElement = event.currentTarget;
    handleElement.setPointerCapture?.(event.pointerId);

    const startPointer = { x: event.screenX, y: event.screenY };
    const startBounds: SettingsWindowBounds = {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight
    };
    let pendingRequest: SettingsWindowBoundsPatch | null = null;
    let resizeRequestInFlight = false;
    let animationFrame = 0;

    const flushResize = () => {
      animationFrame = 0;
      if (resizeRequestInFlight || !pendingRequest) {
        return;
      }

      const request = pendingRequest;
      pendingRequest = null;
      resizeRequestInFlight = true;

      const resizePromise = window.poe2Overlay?.resizeSettingsWindow(request);
      if (!resizePromise) {
        resizeRequestInFlight = false;
        return;
      }

      void resizePromise.catch(() => false).finally(() => {
        resizeRequestInFlight = false;
        if (pendingRequest) {
          flushResize();
        }
      });
    };

    const queueResize = (request: SettingsWindowBoundsPatch) => {
      pendingRequest = request;
      if (!resizeRequestInFlight && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(flushResize);
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      queueResize(buildSettingsWindowResizeRequest({
        edge,
        startBounds,
        startPointer,
        currentPointer: { x: moveEvent.screenX, y: moveEvent.screenY }
      }));
    };

    const cleanup = () => {
      if (animationFrame !== 0) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      flushResize();
      if (handleElement.hasPointerCapture?.(event.pointerId)) {
        handleElement.releasePointerCapture(event.pointerId);
      }
      document.body.classList.remove('settings-window-resizing');
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', cleanup, true);
      document.removeEventListener('pointercancel', cleanup, true);
      window.removeEventListener('blur', cleanup);
    };

    document.body.classList.add('settings-window-resizing');
    document.addEventListener('pointermove', handlePointerMove, { capture: true });
    document.addEventListener('pointerup', cleanup, { once: true, capture: true });
    document.addEventListener('pointercancel', cleanup, { once: true, capture: true });
    window.addEventListener('blur', cleanup, { once: true });
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
