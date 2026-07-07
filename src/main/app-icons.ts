import { nativeImage, type NativeImage } from 'electron';
import { resolveRuntimePath } from './services/runtime-paths';

function createTrayIcon(): NativeImage {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <rect width="32" height="32" rx="8" fill="#11161e"/>
      <path d="M9 8h14v3H12v4h9v3h-9v6H9z" fill="#ffd27a"/>
      <circle cx="23" cy="23" r="3" fill="#ff6c6c"/>
    </svg>
  `;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

export function createAppIcon(): NativeImage {
  const iconPath = process.platform === 'win32'
    ? resolveRuntimePath('assets', 'app-icon.ico')
    : resolveRuntimePath('assets', 'app-icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? createTrayIcon() : icon;
}
