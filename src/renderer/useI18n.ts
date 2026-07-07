import { useEffect, useMemo } from 'react';
import type { AppLanguage } from '../shared/types';
import { createI18n } from '../i18n/translations';
import { useAppSnapshot } from './hooks';

function readStoredLanguage(): AppLanguage {
  if (typeof window === 'undefined') {
    return 'ru';
  }

  return window.localStorage.getItem('poe2-ui-language') === 'en' ? 'en' : 'ru';
}

export function useI18n(languageOverride?: AppLanguage | null) {
  const shouldReadSnapshot = arguments.length === 0;
  const snapshot = useAppSnapshot({ enabled: shouldReadSnapshot });
  const language = languageOverride ?? snapshot?.config.appLanguage ?? readStoredLanguage();
  const i18n = useMemo(() => createI18n(language), [language]);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    window.localStorage.setItem('poe2-ui-language', i18n.language);
  }, [i18n.language]);

  return i18n;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
