import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  // 扫描 src/content/blog 下全部 Markdown，按 zh/ en/ 子目录组织
  // id 用文件路径保证唯一（zh/hello-world 与 en/hello-world 是不同 entry）
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/blog',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    /** URL slug，中英版本各自唯一，如 hello-world */
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    /** 文章语言：zh / en，与目录无关，显式声明 */
    lang: z.enum(['zh', 'en']),
    /** 中英互译文章填写相同的 key，用于语言切换时跳转对应版本 */
    translationKey: z.string().optional(),
    /** 封面图，位于 public/ 下，如 /images/cover.png */
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
