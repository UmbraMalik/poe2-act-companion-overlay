import type { AppTheme } from '../shared/types';

export function getAppThemeClassName(theme: AppTheme | null | undefined): string {
  return theme === 'dark_fantasy' ? 'theme-dark-fantasy' : 'theme-classic';
}

export function getNextAppTheme(theme: AppTheme | null | undefined): AppTheme {
  return theme === 'dark_fantasy' ? 'classic' : 'dark_fantasy';
}

export function getAppThemeIcon(theme: AppTheme | null | undefined): string {
  return theme === 'dark_fantasy' ? '☀' : '☾';
}
