import { app } from 'electron';

export const DIRECT_COMPOSITION_COMPAT_ENABLED = process.platform === 'win32';

export function configureElectronStartup(): void {
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling');

  if (DIRECT_COMPOSITION_COMPAT_ENABLED) {
    // Compatibility mode for smoother inactive always-on-top overlay rendering over games on Windows.
    app.commandLine.appendSwitch('disable-direct-composition');
    app.commandLine.appendSwitch('disable-direct-composition-video-overlays');
  }

  if (process.platform === 'linux') {
    const requestedOzonePlatform = String(process.env.POE2_OVERLAY_OZONE_PLATFORM ?? '').trim().toLowerCase();
    // Transparent Electron overlays are still compositor-sensitive on Linux.
    // Wayland sessions are forced through XWayland by default because the overlay relies on alpha.
    // Advanced users can opt back into native Wayland with POE2_OVERLAY_OZONE_PLATFORM=wayland.
    if (requestedOzonePlatform === 'x11' || requestedOzonePlatform === 'wayland') {
      app.commandLine.appendSwitch('ozone-platform', requestedOzonePlatform);
    } else if (process.env.WAYLAND_DISPLAY) {
      app.commandLine.appendSwitch('ozone-platform', 'x11');
    }
    app.commandLine.appendSwitch('enable-transparent-visuals');
  }

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.umbramalik.poe2-act-companion-overlay');
  }
}
