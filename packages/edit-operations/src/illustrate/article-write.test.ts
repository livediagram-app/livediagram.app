import { describe, expect, it } from 'vitest';
import type { ArticleWrite } from '@livediagram/api-schema';
import {
  articlesOf,
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  MAX_ILLUSTRATE_PAGES,
  type ArticleFlow,
  type Element,
  type IllustratePage,
  type Tab,
} from '@livediagram/document';
import { applyArticleWrite } from './article-write';

// docs/specs/024-agents/illustrate-for-agents.md "write_article".

const counter = (prefix: string) => {
  let n = 0;
  return () => `${prefix}-${++n}`;
};
const ids = () => ({ page: counter('pg'), flow: counter('art') });

const tabOf = (extra: Partial<Tab> = {}): Tab =>
  ({ id: 't', name: 'T', elements: [], opensIn: 'illustrate', ...extra }) as Tab;
const page = (id: string, extra: Partial<IllustratePage> = {}): IllustratePage => ({
  id,
  orientation: 'portrait',
  ...extra,
});
const para = (id: string, text: string, style?: 'title'): ArticleFlow['blocks'][number] => ({
  id,
  type: 'paragraph',
  ...(style ? { style } : {}),
  runs: [{ text }],
});
const withArticle = (flow: string, doc: ArticleFlow, extra: Partial<Tab> = {}): Tab =>
  tabOf({ pages: [page('a1', { kind: 'article', flow })], articles: { [flow]: doc }, ...extra });

const write = (tab: Tab, w: ArticleWrite) => {
  const out = applyArticleWrite(tab, w, ids());
  if ('refusal' in out) throw new Error(`${out.refusal.code}: ${out.refusal.message}`);
  return out;
};
const refusal = (tab: Tab, w: ArticleWrite) => {
  const out = applyArticleWrite(tab, w, ids());
  if (!('refusal' in out)) throw new Error('expected a refusal');
  return out.refusal;
};
const texts = (doc: ArticleFlow | undefined) =>
  (doc?.blocks ?? []).map((b) => ('runs' in b ? b.runs.map((r) => r.text).join('') : b.type));

describe('a new article', () => {
  it('takes the fresh tab’s empty first page, switching a diagram tab into Illustrate', () => {
    const out = write(tabOf({ opensIn: undefined }), { markdown: '---\ntitle: Brief\n---\nHello' });
    expect(out.switched).toBe(true);
    expect(out.created).toBe(true);
    expect(illustratePagesOf(out.tab)).toHaveLength(1);
    expect(illustratePagesOf(out.tab)[0]).toMatchObject({ kind: 'article', flow: 'art-1' });
    expect(texts(articlesOf(out.tab)['art-1'])).toEqual(['Brief', 'Hello']);
    expect(out.lines).toEqual([
      'Switched the tab to Illustrate.',
      'Started the article "Brief" (art-1): 2 blocks.',
      'The writing flows onto as many pages as it needs when it is laid out in the editor.',
    ]);
  });

  it('goes after the last page otherwise, on the paper asked for', () => {
    const tab = tabOf({
      pages: [page('p1', { kind: 'slide', size: 'slide', orientation: 'landscape' })],
    });
    const out = write(tab, { markdown: 'Hi', size: 'letter', orientation: 'landscape' });
    const pages = illustratePagesOf(out.tab);
    expect(pages.map((p) => p.id)).toEqual(['p1', 'pg-1']);
    expect(pages[1]).toMatchObject({ kind: 'article', size: 'letter', orientation: 'landscape' });
  });

  it('starts a second article when asked for a new one', () => {
    const tab = withArticle('f', { blocks: [para('b', 'Old', 'title')] });
    const out = write(tab, { markdown: 'Second', new: true });
    expect(Object.keys(articlesOf(out.tab)).sort()).toEqual(['art-1', 'f']);
  });

  it('refuses a size an article lacks, and past the page limit', () => {
    expect(refusal(tabOf(), { markdown: 'x', size: 'slide' }).code).toBe('size_not_offered');
    expect(refusal(tabOf(), { markdown: 'x', size: 'fit' }).code).toBe('size_not_offered');
    const full = tabOf({
      pages: Array.from({ length: MAX_ILLUSTRATE_PAGES }, (_, i) =>
        page(`p${i}`, { kind: 'infographic' }),
      ),
    });
    expect(refusal(full, { markdown: 'x' }).code).toBe('page_limit');
  });

  it('appends onto a new article without its placeholder title', () => {
    const out = write(tabOf({ pages: [page('p', { kind: 'infographic' })] }), {
      markdown: 'Only',
      mode: 'append',
    });
    expect(texts(articlesOf(out.tab)['art-1'])).toEqual(['Only']);
  });
});

describe('fresh ids', () => {
  it('mints its own page and article ids when none are given', () => {
    const out = applyArticleWrite(tabOf({ pages: [page('p', { kind: 'infographic' })] }), {
      markdown: 'x',
    });
    if ('refusal' in out) throw new Error('refused');
    expect(out.flow).toMatch(/^art-/);
    expect(illustratePagesOf(out.tab)[1]!.id).toMatch(/^page-/);
  });
});

describe('which article', () => {
  const two = tabOf({
    pages: [page('a1', { kind: 'article', flow: 'f' }), page('b1', { kind: 'article', flow: 'g' })],
    articles: {
      f: { blocks: [para('1', 'Brief', 'title')] },
      g: { blocks: [para('2', 'Notes', 'title')] },
    },
  });

  it('is the only one when not named', () => {
    const out = write(withArticle('f', { blocks: [para('1', 'Old')] }), { markdown: 'New' });
    expect(out.created).toBe(false);
    expect(texts(articlesOf(out.tab).f)).toEqual(['New']);
    expect(out.lines[0]).toBe('Wrote the article "Untitled" (f): 1 blocks.');
  });

  it('is named by flow id or title', () => {
    expect(texts(articlesOf(write(two, { markdown: 'A', article: 'g' }).tab).g)).toEqual(['A']);
    expect(texts(articlesOf(write(two, { markdown: 'B', article: '  brief ' }).tab).f)).toEqual([
      'B',
    ]);
  });

  it('refuses two unnamed, and an unknown name', () => {
    const r = refusal(two, { markdown: 'x' });
    expect(r.code).toBe('article_ambiguous');
    expect(r.message).toContain('"Brief" (f), "Notes" (g)');
    expect(refusal(two, { markdown: 'x', article: 'Plan' }).message).toContain('Articles:');
    expect(refusal(tabOf(), { markdown: 'x', article: 'Plan' }).message).toContain('has none');
  });
});

describe('the writing', () => {
  it('appends after the last block, fresh ids where they would clash', () => {
    const tab = withArticle('f', { blocks: [para('1', 'One')] });
    const out = write(tab, { markdown: 'Two\n\nThree', mode: 'append' });
    const doc = articlesOf(out.tab).f!;
    expect(texts(doc)).toEqual(['One', 'Two', 'Three']);
    expect(new Set(doc.blocks.map((b) => b.id)).size).toBe(3);
    expect(out.lines[0]).toBe('Appended to the article "Untitled" (f): 2 blocks added, 3 blocks.');
  });

  it('says a Markdown table was written as a list', () => {
    const out = write(tabOf(), { markdown: '| a | b |\n|---|---|\n| 1 | 2 |' });
    expect(out.lines).toContain(
      "Wrote Markdown tables as lists (1): an article's text holds no tables (put a table element on a page with update_document).",
    );
  });

  it('keeps one empty paragraph when replaced by nothing', () => {
    const out = write(withArticle('f', { blocks: [para('1', 'One')] }), { markdown: '' });
    expect(articlesOf(out.tab).f!.blocks).toMatchObject([{ type: 'paragraph', runs: [] }]);
  });

  it('removes the zones a replace leaves out with their elements, and keeps the rest', () => {
    const pages = [page('a1', { kind: 'article', flow: 'f' })];
    const r = layOutIllustratePages(pages)[0]!.rect;
    const zone = (id: string, y: number) => ({
      id,
      type: 'zone' as const,
      zone: 'object' as const,
      width: 200,
      height: 100,
      at: { page: 'a1', x: 100, y },
    });
    const inZone: Element = {
      id: 'img',
      type: 'shape',
      shape: 'square',
      x: r.x + 150,
      y: r.y + 120,
      width: 40,
      height: 40,
    } as Element;
    const tab = tabOf({
      pages,
      elements: [inZone],
      articles: { f: { blocks: [para('1', 'Text'), zone('z1', 100), zone('z2', 400)] } },
    });
    const out = write(tab, { markdown: 'Intro\n\n[zone z2]' });
    expect(articlesOf(out.tab).f!.blocks.map((b) => b.type)).toEqual(['paragraph', 'zone']);
    expect(out.tab.elements).toEqual([]);
    expect(out.lines[1]).toBe('Removed zones and what was in them: z1.');
    expect(refusal(tab, { markdown: '[zone z9]' }).code).toBe('zone_unknown');
  });

  it('removes margin-note markers whose text is gone', () => {
    const marker = {
      id: 'n1',
      type: 'annotation',
      articleNote: true,
      x: 0,
      y: 0,
      width: 32,
      height: 32,
    } as unknown as Element;
    const tab = withArticle(
      'f',
      { blocks: [{ id: '1', type: 'paragraph', runs: [{ text: 'noted', note: 'n1' }] }] },
      { elements: [marker] },
    );
    const out = write(tab, { markdown: 'Fresh text' });
    expect(out.tab.elements).toEqual([]);
    expect(out.lines).toContain('Removed margin notes whose text is gone (1).');
    expect(write(tab, { markdown: 'More', mode: 'append' }).tab.elements).toHaveLength(1);
  });

  it('sets the look, accent and page numbers, keeping the rest of the style', () => {
    const tab = withArticle('f', { blocks: [para('1', 'x')], style: { margins: 'wide' } });
    const out = write(tab, { markdown: 'y', look: 'report', accent: '#ff0066', pageNumbers: true });
    expect(articlesOf(out.tab).f!.style).toEqual({
      margins: 'wide',
      look: 'report',
      accent: '#ff0066',
      pageNumbers: true,
    });
  });

  it('refuses a locked article and writing past the limits', () => {
    const locked = tabOf({
      pages: [page('a1', { kind: 'article', flow: 'f', locked: true })],
      articles: { f: { blocks: [] } },
    });
    expect(refusal(locked, { markdown: 'x' }).code).toBe('page_locked');
    const many = Array.from({ length: MAX_ARTICLE_BLOCKS + 1 }, (_, i) => `P${i}`).join('\n\n');
    expect(refusal(tabOf(), { markdown: many }).code).toBe('article_too_large');
    expect(
      refusal(tabOf(), { markdown: 'x'.repeat(MAX_ARTICLE_BLOCK_TEXT + 1) }).message,
    ).toContain('split');
  });

  it('refuses a locked tab', () => {
    expect(refusal(tabOf({ locked: true }), { markdown: 'x' }).code).toBe('tab_locked');
  });
});
