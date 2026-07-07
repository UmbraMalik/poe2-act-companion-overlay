import type { AppTheme } from '../shared/types';

export function getAppThemeClassName(theme: AppTheme | null | undefined): string {
  return theme === 'dark_fantasy' ? 'theme-dark-fantasy' : 'theme-classic';
}
