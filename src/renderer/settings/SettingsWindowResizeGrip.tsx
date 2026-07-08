import { type PointerEvent as ReactPointerEvent } from 'react';
import type { SettingsWindowResizeEdge } from '../../shared/types';

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

    let lastX = event.screenX;
    let lastY = event.screenY;
    let queuedDeltaX = 0;
    let queuedDeltaY = 0;
    let animationFrame = 0;

    const requestResize = () => {
      animationFrame = 0;
      const deltaX = queuedDeltaX;
      const deltaY = queuedDeltaY;
      queuedDeltaX = 0;
      queuedDeltaY = 0;

      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      void window.poe2Overlay?.resizeSettingsWindow({ edge, deltaX, deltaY });
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();

      const deltaX = moveEvent.screenX - lastX;
      const deltaY = moveEvent.screenY - lastY;
      lastX = moveEvent.screenX;
      lastY = moveEvent.screenY;

      queuedDeltaX += deltaX;
      queuedDeltaY += deltaY;

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
