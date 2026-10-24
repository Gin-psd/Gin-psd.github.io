export const locales = ['zh', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh';

/** 站点基础信息，按语言分别维护 */
export const siteConfig = {
  // TODO: 替换为你的名字 / 站点标题
  title: {
    zh: '我的博客',
    en: 'My Blog',
  },
  description: {
    zh: '记录技术、思考与创作',
    en: 'Notes on technology, thinking and making',
  },
  author: {
    zh: '博主',
    en: 'Author',
  },
} as const;

/** URL 路径中排除的语言前缀片段 */
const localePattern = new RegExp(`^/(${locales.join('|')})(?=/|$)`);

/** 从 URL 解析当前语言，无前缀视为默认语言（中文） */
export function getLangFromUrl(url: URL): Locale {
  const [, maybeLang] = url.pathname.split('/');
  return locales.includes(maybeLang as Locale) ? (maybeLang as Locale) : defaultLocale;
}

/** 去掉语言前缀的核心路径，如 /en/posts/a/ -> /posts/a/ */
export function getCorePath(pathname: string): string {
  return pathname.replace(localePattern, '') || '/';
}

/** 为目标语言生成本地化路径，如 ('/posts', 'en') -> '/en/posts' */
export function getLocalizedPath(path: string, lang: Locale): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return lang === defaultLocale ? normalized : `/${lang}${normalized}`;
}

/** 获取另一语言，用于语言切换 */
export function getOtherLocale(lang: Locale): Locale {
  return lang === 'zh' ? 'en' : 'zh';
}
