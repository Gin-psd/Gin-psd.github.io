import rss from '@astrojs/rss';
import { siteConfig } from '../../i18n/config';
import { getPublishedPosts } from '../../lib/posts';

export async function GET(context: { site: URL | string }) {
  const posts = await getPublishedPosts('en');
  return rss({
    title: siteConfig.title.en,
    description: siteConfig.description.en,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/en/posts/${post.slug}/`,
      categories: post.data.tags,
    })),
    customData: '<language>en-us</language>',
  });
}
