import { getLangFromUrl, getLocalizedPath, defaultLocale, type Locale } from './config';
import { ui, type TranslationKey } from './ui';

/** 返回当前语言的翻译函数 t('nav.home') */
export function useTranslations(lang: Locale) {
  return function t(key: TranslationKey, vars?: Record<string, string | number>): string {
    let str: string = ui[lang][key] ?? ui[defaultLocale][key];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };
}

export { getLangFromUrl, getLocalizedPath, defaultLocale };
export type { Locale };
