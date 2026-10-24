import rss from '@astrojs/rss';
import { siteConfig } from '../i18n/config';
import { getPublishedPosts } from '../lib/posts';

export async function GET(context: { site: URL | string }) {
  const posts = await getPublishedPosts('zh');
  return rss({
    title: siteConfig.title.zh,
    description: siteConfig.description.zh,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/posts/${post.slug}/`,
      categories: post.data.tags,
    })),
    customData: '<language>zh-cn</language>',
  });
}
