import type { OverlayDensity, OverlayMode, OverlayScale } from './types';

interface OverlayMinimumSize {
  width: number;
  height: number;
}

type OverlaySizePresetKey = 'full' | 'compact' | 'timer_only';

const OVERLAY_MINIMUM_SIZE_PRESETS: Record<
  OverlayScale,
  Record<OverlaySizePresetKey, OverlayMinimumSize>
> = {
  70: {
    full: { width: 310, height: 300 },
    compact: { width: 290, height: 250 },
    timer_only: { width: 270, height: 196 }
  },
  80: {
    full: { width: 330, height: 330 },
    compact: { width: 310, height: 270 },
    timer_only: { width: 290, height: 204 }
  },
  90: {
    full: { width: 360, height: 370 },
    compact: { width: 330, height: 285 },
    timer_only: { width: 305, height: 212 }
  },
  100: {
    full: { width: 400, height: 420 },
    compact: { width: 350, height: 300 },
    timer_only: { width: 320, height: 218 }
  },
  110: {
    full: { width: 420, height: 460 },
    compact: { width: 370, height: 320 },
    timer_only: { width: 340, height: 226 }
  },
  120: {
    full: { width: 440, height: 500 },
    compact: { width: 390, height: 340 },
    timer_only: { width: 360, height: 234 }
  }
};

export function getOverlayMinimumSize(
  mode: OverlayMode,
  density: OverlayDensity,
  scale: OverlayScale
): OverlayMinimumSize {
  const preset = OVERLAY_MINIMUM_SIZE_PRESETS[scale];

  if (mode === 'timer_only') {
    return preset.timer_only;
  }

  return density === 'compact' ? preset.compact : preset.full;
}
