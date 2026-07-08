import { useEffect } from 'react';

export function SettingsWindowShellEffects() {
  useEffect(() => {
    document.documentElement.classList.add('settings-window-html');
    document.body.classList.add('settings-window-body');

    return () => {
      document.documentElement.classList.remove('settings-window-html');
      document.body.classList.remove('settings-window-body');
      document.body.classList.remove('settings-window-resizing');
    };
  }, []);

  return null;
}
