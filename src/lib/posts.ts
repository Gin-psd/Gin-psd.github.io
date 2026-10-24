import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/config';

/** 获取某语言下全部已发布文章，按发布日期倒序 */
export async function getPublishedPosts(lang: Locale): Promise<CollectionEntry<'blog'>[]> {
  const posts = await getCollection('blog', ({ data }) => data.lang === lang && !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 统计标签出现次数，按热度排序 */
export function getTagCounts(posts: CollectionEntry<'blog'>[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** 根据 translationKey 查找另一语言的同篇译文 */
export async function findTranslation(
  translationKey: string | undefined,
  targetLang: Locale
): Promise<CollectionEntry<'blog'> | undefined> {
  if (!translationKey) return undefined;
  const matches = await getCollection('blog', ({ data }) => data.lang === targetLang && !data.draft);
  return matches.find((post) => post.data.translationKey === translationKey);
}
