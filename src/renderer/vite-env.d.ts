/// <reference types="vite/client" />

import type { ElectronApi } from '../shared/types';

declare global {
  interface Window {
    poe2Overlay: ElectronApi;
  }
}

export {};
