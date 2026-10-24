---
slug: markdown-showcase
title: Markdown 样式一览
description: 一篇用来检验博客排版效果的文章：代码高亮、表格、引用、列表等常见元素的渲染效果。
pubDate: 2026-10-22
lang: zh
translationKey: markdown-showcase
tags:
  - 排版
  - Markdown
draft: false
---

这篇文章集中展示博客支持的 Markdown 元素，写新文章时可以参考这里的排版效果。

## 代码高亮

行内代码：`npm run dev`。

```ts
// TypeScript：类型收窄示例
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

function unwrap<T>(r: Result<T>): T {
  if (r.ok) {
    return r.value; // 这里 r 被收窄为 { ok: true; value: T }
  }
  throw r.error;
}
```

```bash
# Shell
npm install
npm run build && npm run preview
```

## 表格

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run preview` | 本地预览构建产物 |

## 引用

> 简单是可靠的先决条件。
>
> —— Edsger W. Dijkstra

## 列表

1. 有序列表第一项
2. 有序列表第二项
   - 嵌套的无序列表
   - 另一项

## 其他元素

**粗体**、*斜体*、~~删除线~~，以及一个[外部链接](https://astro.build)。

---

以上元素如果渲染正常，说明博客的排版系统工作正常。
