import Module from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

let installed = false;
const moduleWithLoad = Module as unknown as {
  _load: (request: string, parent: NodeModule | null, isMain: boolean) => unknown;
};
const originalLoad = moduleWithLoad._load;

export let mockUserDataPath = join(process.cwd(), '.tmp-tests', 'mock-user-data');
mkdirSync(mockUserDataPath, { recursive: true });

const noop = () => {};
const ipcHandlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>();

class MockBrowserWindow {
  static getFocusedWindow(): MockBrowserWindow | null {
    return null;
  }

  webContents = {
    send: noop,
    isDestroyed: () => false,
    on: noop,
    once: noop,
    setWindowOpenHandler: noop
  };

  private destroyed = false;
  private visible = false;
  private bounds = { x: 0, y: 0, width: 500, height: 500 };

  constructor(options?: { width?: number; height?: number }) {
    this.bounds.width = options?.width ?? this.bounds.width;
    this.bounds.height = options?.height ?? this.bounds.height;
  }

  on(): void {}
  once(): void {}
  show(): void {
    this.visible = true;
  }
  hide(): void {
    this.visible = false;
  }
  focus(): void {}
  destroy(): void {
    this.destroyed = true;
  }
  isDestroyed(): boolean {
    return this.destroyed;
  }
  isVisible(): boolean {
    return this.visible;
  }
  setAlwaysOnTop(): void {}
  setMenuBarVisibility(): void {}
  removeMenu(): void {}
  setOpacity(): void {}
  setMinimumSize(): void {}
  setFocusable(): void {}
  setVisibleOnAllWorkspaces(): void {}
  showInactive(): void {
    this.visible = true;
  }
  setPosition(x: number, y: number): void {
    this.bounds = {
      ...this.bounds,
      x,
      y
    };
  }
  setBounds(bounds: typeof this.bounds): void {
    this.bounds = { ...bounds };
  }
  getBounds(): typeof this.bounds {
    return { ...this.bounds };
  }
  loadURL(): Promise<void> {
    return Promise.resolve();
  }
  loadFile(): Promise<void> {
    return Promise.resolve();
  }
}

const mockElectron = {
  app: {
    isPackaged: false,
    commandLine: {
      appendSwitch: noop
    },
    getAppPath: () => process.cwd(),
    getPath: (_name: string) => mockUserDataPath,
    getVersion: () => '0.2.3-test',
    setAppUserModelId: noop,
    requestSingleInstanceLock: () => true,
    quit: noop,
    whenReady: () => ({
      then: () => undefined
    }),
    on: noop
  },
  BrowserWindow: MockBrowserWindow,
  Menu: {
    buildFromTemplate: () => ({})
  },
  Tray: class {
    setToolTip(): void {}
    setContextMenu(): void {}
    on(): void {}
    destroy(): void {}
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] as string[] }),
    showMessageBox: async () => ({ response: 0 })
  },
  shell: {
    openExternal: async () => undefined
  },
  nativeImage: {
    createFromDataURL: () => ({
      isEmpty: () => false
    }),
    createFromPath: () => ({
      isEmpty: () => false
    })
  },
  globalShortcut: {
    register: () => true,
    unregister: noop,
    unregisterAll: noop,
    isRegistered: () => false
  },
  screen: {
    getPrimaryDisplay: () => ({
      workArea: { x: 0, y: 0, width: 2560, height: 1440 }
    }),
    getAllDisplays: () => [{
      workArea: { x: 0, y: 0, width: 2560, height: 1440 }
    }],
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 2560, height: 1440 }
    })
  },
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }
  }
};

const mockAutoUpdater = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  allowPrerelease: false,
  allowDowngrade: false,
  setFeedURL: noop,
  on: noop,
  checkForUpdates: async () => undefined,
  downloadUpdate: async () => undefined,
  quitAndInstall: noop
};

export function installElectronMock(): void {
  if (installed) {
    return;
  }

  installed = true;
  moduleWithLoad._load = function patchedLoad(
    request: string,
    parent: NodeModule | null,
    isMain: boolean
  ): unknown {
    if (request === 'electron') {
      return mockElectron;
    }

    if (request === 'electron-updater') {
      return {
        autoUpdater: mockAutoUpdater
      };
    }

    return originalLoad.apply(this, [request, parent, isMain]);
  };
}

export function createMockUserDataPath(prefix = 'mock-user-data'): string {
  mockUserDataPath = join(
    process.cwd(),
    '.tmp-tests',
    `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(mockUserDataPath, { recursive: true });
  return mockUserDataPath;
}

export function resetElectronMockState(): void {
  ipcHandlers.clear();
}

export async function invokeIpcHandler<T = unknown>(
  channel: string,
  ...args: unknown[]
): Promise<T> {
  const handler = ipcHandlers.get(channel);
  if (!handler) {
    throw new Error(`Missing IPC handler for ${channel}`);
  }
  return await handler({}, ...args) as T;
}
