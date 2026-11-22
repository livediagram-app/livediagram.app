// Small pieces of writing for the tests: blocks as an article stores them.
import type { ArticleBlock, ArticleFlow, ArticleRun } from '@liveknowledge/document';

let next = 0;
const id = () => `b${++next}`;

type Style = 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'quote';

export const para = (text: string, style?: Style): ArticleBlock => ({
  id: id(),
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: text ? [{ text }] : [],
});

export const runsPara = (runs: ArticleRun[]): ArticleBlock => ({
  id: id(),
  type: 'paragraph',
  runs,
});

export const runsBullet = (runs: ArticleRun[]): ArticleBlock => ({
  id: id(),
  type: 'list',
  list: 'bullet',
  runs,
});

export const bullet = (text: string): ArticleBlock => runsBullet([{ text }]);

export const code = (text: string): ArticleBlock => ({ id: id(), type: 'code', text });

export const table = (rows: ArticleRun[][][]): ArticleBlock => ({
  id: id(),
  type: 'table',
  cols: rows[0]!.map((_cell, at) => ({ id: `c${at}`, w: 1 })),
  rows: rows.map((cells, at) => ({ id: `r${at}`, cells })),
});

export const divider = (): ArticleBlock => ({ id: id(), type: 'divider' });

export const flowOf = (...blocks: ArticleBlock[]): ArticleFlow => ({ blocks });
