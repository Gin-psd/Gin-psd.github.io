---
slug: markdown-showcase
title: Markdown Showcase
description: "A post that exercises the blog's typography: code highlighting, tables, quotes, lists and more."
pubDate: 2026-10-22
lang: en
translationKey: markdown-showcase
tags:
  - typography
  - markdown
draft: false
---

This post exercises the Markdown elements supported by the blog — use it as a reference when writing new posts.

## Code highlighting

Inline code: `npm run dev`.

```ts
// TypeScript: type narrowing
type Result<T> = { ok: true; value: T } | { ok: false; error: Error };

function unwrap<T>(r: Result<T>): T {
  if (r.ok) {
    return r.value; // r is narrowed to { ok: true; value: T }
  }
  throw r.error;
}
```

```bash
# Shell
npm install
npm run build && npm run preview
```

## Tables

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the build output |

## Blockquote

> Simplicity is prerequisite for reliability.
>
> — Edsger W. Dijkstra

## Lists

1. First ordered item
2. Second ordered item
   - A nested unordered item
   - Another one

## Inline elements

**Bold**, *italic*, ~~strikethrough~~, and an [external link](https://astro.build).

---

If everything above renders correctly, the typography system is working as intended.
