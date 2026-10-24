#!/usr/bin/env node
/**
 * CSDN 博客文章迁移脚本（HTML 解析版）
 *
 * 用法：
 *   node scripts/migrate-csdn.mjs <CSDN用户ID> [--limit 5] [--force]
 *
 * 示例：
 *   node scripts/migrate-csdn.mjs 2603_96969112
 *   node scripts/migrate-csdn.mjs 2603_96969112 --limit 5 --force
 *
 * 流程：博客主页分页提取文章 ID → 抓详情页提取标题/时间/正文 → 转 Markdown 写入
 * slug 使用 CSDN 文章 ID，后续可在 /admin 后台修改
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const args = process.argv.slice(2);
const userId = args.find((a) => !a.startsWith('--'));
const limitArg = args.indexOf('--limit');
const limit = limitArg > -1 ? Number(args[limitArg + 1]) : Infinity;
const force = args.includes('--force');

if (!userId) {
  console.error('请提供 CSDN 用户 ID（博客主页 blog.csdn.net/ 后面的部分）');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src/content/blog/zh');

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

turndown.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const src = node.getAttribute('src') ?? node.getAttribute('data-src') ?? '';
    const alt = node.getAttribute('alt') ?? '';
    return src ? `\n![${alt}](${src})\n` : '';
  },
});

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: `https://blog.csdn.net/${userId}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** 从博客主页分页提取文章 ID */
async function fetchArticleIds() {
  const ids = [];
  for (let page = 1; page <= 30 && ids.length < limit; page++) {
    const url = page === 1 ? `https://blog.csdn.net/${userId}?type=blog` : `https://blog.csdn.net/${userId}?type=blog&page=${page}`;
    let html;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.error(`第 ${page} 页抓取失败: ${err.message}`);
      break;
    }
    const pageIds = [...new Set([...html.matchAll(/article\/details\/(\d+)/g)].map((m) => m[1]))];
    const fresh = pageIds.filter((id) => !ids.includes(id));
    if (fresh.length === 0) break;
    ids.push(...fresh);
    console.log(`第 ${page} 页：发现 ${fresh.length} 篇文章`);
  }
  return ids.slice(0, limit);
}

/** 抓取单篇文章，提取标题/发布时间/标签/正文 */
async function fetchArticle(articleId) {
  const html = await fetchHtml(`https://blog.csdn.net/${userId}/article/details/${articleId}`);
  const $ = cheerio.load(html);

  // 标题：优先 h1，退化到 <title> 去后缀
  let title = $('h1.title-article, h1#articleContentId').first().text().trim();
  if (!title) {
    const docTitle = $('title').text();
    title = docTitle.replace(/[-_].*$/, '').trim();
  }

  // 发布时间：页面中第一个 YYYY-MM-DD HH:mm:ss
  const timeMatch = html.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
  const pubDate = timeMatch ? timeMatch[1].slice(0, 10) : new Date().toISOString().slice(0, 10);

  // 标签
  const tags = [...new Set($('.tags-box a, .article-tag a, a.tag-link').map((_i, el) => $(el).text().trim()).get())]
    .filter(Boolean)
    .slice(0, 5);

  // 正文
  const $content = $('#content_views');
  if ($content.length === 0) throw new Error('未找到正文容器（可能被反爬拦截或需登录）');
  $content.find('.hljs-button, script, style, .hide-article-box').remove();
  const markdown = turndown.turndown($content.html() ?? '').trim();
  if (!markdown) throw new Error('正文为空');

  return { title, pubDate, tags, markdown };
}

function yamlEscape(str) {
  return String(str).replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
}

/** 用正文前两行生成摘要 */
function makeDescription(markdown) {
  const text = markdown
    .replace(/^#.*$/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
    .replace(/[`*>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 100) || '来自 CSDN 的迁移文章';
}

async function main() {
  console.log(`开始抓取 CSDN 用户 ${userId} 的文章…`);
  const ids = await fetchArticleIds();
  console.log(`\n共发现 ${ids.length} 篇文章，开始导入…\n`);

  await mkdir(outDir, { recursive: true });
  let ok = 0;
  let skipped = 0;

  for (const [i, id] of ids.entries()) {
    const file = join(outDir, `${id}.md`);
    const exists = await access(file).then(() => true, () => false);
    if (exists && !force) {
      skipped++;
      continue;
    }

    try {
      const { title, pubDate, tags, markdown } = await fetchArticle(id);
      const frontmatter = [
        '---',
        `slug: "${id}"`,
        `title: "${yamlEscape(title)}"`,
        `description: "${yamlEscape(makeDescription(markdown))}"`,
        `pubDate: ${pubDate}`,
        'lang: zh',
        'tags:',
        ...(tags.length ? tags.map((t) => `  - ${t}`) : ['  - 其他']),
        'draft: false',
        '---',
        '',
      ].join('\n');

      await writeFile(file, frontmatter + markdown + '\n', 'utf8');
      ok++;
      console.log(`[${i + 1}/${ids.length}] ✓ ${title}`);
    } catch (err) {
      console.error(`[${i + 1}/${ids.length}] ✗ ${id}: ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n完成：导入 ${ok} 篇，跳过 ${skipped} 篇（已存在，--force 可覆盖）`);
  console.log('提示：slug 为 CSDN 文章 ID，可在 /admin 后台改为更有意义的英文短名');
}

main().catch((err) => {
  console.error('迁移失败：', err);
  process.exit(1);
});
