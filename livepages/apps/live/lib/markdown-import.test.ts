import { describe, expect, it } from 'vitest';
import {
  ARTICLE_MARKDOWN_MAX,
  MAX_ARTICLE_BLOCK_TEXT,
  articlesOf,
  pagesOf,
} from '@livepages/document';
import { buildTabFromMarkdown, markdownImportOutcome } from './markdown-import';
import { mergeImportedTab } from './import-merge';

// docs/specs/020-import-export/markdown-import.md: a Markdown file imports as an article.

const built = (md: string) => {
  const result = buildTabFromMarkdown(md, { tabName: 'Notes' });
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('buildTabFromMarkdown', () => {
  it('makes one article page whose writing is the Markdown', () => {
    const { tab } = built('# Project\n\nWhy we are doing this.\n\n- Research\n- Build');
    const pages = pagesOf(tab);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.kind).toBe('article');
    const article = articlesOf(tab)[pages[0]!.flow!]!;
    const text = article.blocks.map((b) => ('runs' in b ? b.runs.map((r) => r.text).join('') : ''));
    expect(text).toEqual(['Project', 'Why we are doing this.', 'Research', 'Build']);
    expect(tab.elements).toEqual([]);
    expect(tab.name).toBe('Notes');
  });

  it('gives empty Markdown an article with one empty paragraph to write in', () => {
    const { tab } = built('');
    const article = Object.values(articlesOf(tab))[0]!;
    expect(article.blocks).toHaveLength(1);
    expect(article.blocks[0]!.type).toBe('paragraph');
  });

  it('writes a table as a list and says so', () => {
    const { tables } = built('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(tables).toBe(1);
    const outcome = markdownImportOutcome(tables);
    expect(outcome.status).toBe('done');
    expect(outcome.status === 'done' && outcome.failures?.[0]?.message).toContain('as lists');
    expect(markdownImportOutcome(0)).toEqual({ status: 'done' });
  });

  it('refuses a paragraph longer than a block holds, and Markdown longer than an article takes', () => {
    const long = buildTabFromMarkdown('x'.repeat(MAX_ARTICLE_BLOCK_TEXT + 1));
    expect(long.ok).toBe(false);
    const huge = buildTabFromMarkdown('a\n\n'.repeat(ARTICLE_MARKDOWN_MAX));
    expect(huge.ok).toBe(false);
  });

  it('lands on the receiving tab with its pages and article', () => {
    const { tab } = built('# Imported');
    const receiving = { id: 'r', name: 'Mine', elements: [] };
    const merged = mergeImportedTab(receiving, tab);
    expect(merged.id).toBe('r');
    expect(merged.name).toBe('Mine');
    expect(pagesOf(merged)[0]!.kind).toBe('article');
    expect(Object.keys(articlesOf(merged))).toHaveLength(1);
  });
});
