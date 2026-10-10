import { describe, expect, it } from 'vitest';
import type { PagesView } from '@livediagram/api-schema';
import {
  layOutIllustratePages,
  type Element,
  type IllustratePage,
  type Tab,
} from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
import { itemLines } from './pages';
import { renderView } from './render-view';

// docs/specs/024-agents/illustrate-for-agents.md "Reading: the pages view".

const pages: IllustratePage[] = [
  { id: 'page-cover', orientation: 'landscape', size: 'slide', kind: 'slide', name: 'Cover' },
  { id: 'page-logo', orientation: 'portrait', size: 'logo', kind: 'logo', locked: true },
  { id: 'page-art1', orientation: 'portrait', kind: 'article', flow: 'art-1' },
  { id: 'page-art2', orientation: 'portrait', kind: 'article', flow: 'art-1' },
];
const cover = layOutIllustratePages(pages)[0]!.rect;

const illustrateTab = (): Tab =>
  ({
    id: 'tab-deck',
    name: 'Deck',
    opensIn: 'illustrate',
    pages,
    elements: [shapeAt('square', 'aaaa1111', cover.x + 100, cover.y + 100)],
    articles: {
      'art-1': {
        blocks: [
          { id: 'b1', type: 'paragraph', style: 'title', runs: [{ text: 'Brief' }] },
          { id: 'b2', type: 'paragraph', style: 'h1', runs: [{ text: 'Goals' }] },
          { id: 'b3', type: 'list', list: 'bullet', runs: [{ text: 'Ship it' }] },
        ],
        style: { look: 'report' },
      },
    },
  }) as unknown as Tab;

const pagesOf = (tab: Tab, budget?: number) => {
  const out = renderView({ view: 'pages', ...(budget ? { budget } : {}) }, tab, { rev: 7 });
  if (!out.ok) throw new Error('refused');
  return out;
};

describe('the items of an element’s lists', () => {
  it('prints each list of words and numbers under its element, cut when long', () => {
    const el = {
      id: 'p1',
      type: 'shape',
      shape: 'process',
      processSteps: [{ label: 'Plan', note: '' }, { label: 'Build' }, 3, null],
      stats: [{ value: '99.9%', caption: 'uptime' }],
      empty: [],
      blanks: [{ x: true }],
      long: Array.from({ length: 80 }, (_, i) => `item ${i}`),
    } as unknown as Element;
    const lines = itemLines(el);
    expect(lines[0]).toBe('    processSteps: Plan | Build | 3');
    expect(lines[1]).toBe('    stats: 99.9% / uptime');
    expect(lines[2]!.endsWith('…')).toBe(true);
    expect(lines).toHaveLength(3);
  });
});

describe('the pages view', () => {
  it('lists each page with its rectangle and the refs on it, then each article as Markdown', () => {
    const out = pagesOf(illustrateTab());
    const lines = out.text.split('\n');
    expect(lines[0]).toBe(
      'tab tab-deck "Deck" · 1 element: 1 box · illustrate 4 pages: 1 slide, 1 logo, 2 article (view pages) · rev 7',
    );
    expect(lines[1]).toBe(
      `page 1 "Cover" page-cover · slide Slide (16:9) · at ${cover.x},${cover.y} 1920x1080 · 1 element`,
    );
    expect(lines[2]).toBe('  square aaaa1111');
    expect(lines[1]).toBe(
      `page 1 "Cover" page-cover · slide Slide (16:9) · at ${cover.x},${cover.y} 1920x1080 · 1 element`,
    );
    expect(lines[3]).toMatch(/^page 2 page-logo · logo 1024 x 1024 · at .* · locked · empty$/);
    expect(lines[4]).toMatch(
      /^page 3 page-art1 · article A4 · at .* · article art-1 · its writing below$/,
    );
    expect(out.text).toContain(
      "Rectangles and elements' x, y are canvas coordinates (the layout view prints positions from the content's corner).",
    );
    expect(out.text).toContain(
      'article art-1 "Brief" · pages 3-4 · 3 blocks · 4 words · look report',
    );
    expect(out.text).toContain('  ---\n  title: Brief\n  ---\n  \n  # Goals\n  \n  - Ship it');
    expect(out.text).toMatch(/layouts slide: slide-title, /);
    expect(out.text).toMatch(/layouts logo: /);
    const json = out.json as PagesView;
    expect(json.illustrate).toBe(true);
    expect(json.pages[0]).toMatchObject({ place: 1, kind: 'slide', refs: ['aaaa1111'] });
    expect(json.articles[0]!.markdown.startsWith('---\ntitle: Brief')).toBe(true);
    expect(json.layouts.map((l) => l.kind)).toEqual(['slide', 'logo']);
  });

  it('names a landscape page, its paint, its elements; a one-page article; no layouts for articles alone', () => {
    const page: IllustratePage = {
      id: 'page-wide',
      orientation: 'landscape',
      background: { fill: { kind: 'solid', color: '#0f172a' } },
    };
    const r = layOutIllustratePages([page])[0]!.rect;
    const tab = {
      id: 'tab-wide',
      name: 'Wide',
      opensIn: 'illustrate',
      pages: [page],
      elements: [
        shapeAt('square', 'cccc3333', r.x + 50, r.y + 50),
        {
          ...shapeAt('square', 'dddd4444', r.x + 300, r.y + 50),
          processSteps: [{ label: 'Plan' }],
        },
      ],
    } as unknown as Tab;
    const lines = pagesOf(tab).text.split('\n');
    expect(lines[1]).toMatch(
      /^page 1 page-wide · infographic A4 · at .* · background #0f172a · 2 elements$/,
    );
    expect(lines).toContain('    processSteps: Plan');
    const articleOnly = {
      id: 'tab-art',
      name: 'Notes',
      opensIn: 'illustrate',
      pages: [{ id: 'a', orientation: 'portrait', kind: 'article', flow: 'f' }],
      articles: { f: { blocks: [{ id: 'b', type: 'paragraph', runs: [{ text: 'Hi' }] }] } },
      elements: [],
    } as unknown as Tab;
    const out = pagesOf(articleOnly);
    expect(out.text).toContain('article f "Untitled" · page 1 · 1 blocks · 1 words\n  Hi');
    expect(out.text).not.toContain('layouts ');
  });

  it('keeps to a budget, saying what it left out', () => {
    const out = pagesOf(illustrateTab(), 60);
    expect(out.text).toMatch(/hidden/);
    expect((out.json as PagesView).elision).not.toBeNull();
  });

  it('says how to switch a tab in another mode, by door', () => {
    const tab = { id: 'tab-x', name: 'X', elements: [] } as unknown as Tab;
    const cli = renderView({ view: 'pages' }, tab);
    const mcp = renderView({ view: 'pages', door: 'mcp' }, tab);
    if (!cli.ok || !mcp.ok) throw new Error('refused');
    expect(cli.text).toContain('page set adds pages');
    expect(mcp.text).toContain('change_pages adds pages');
    expect(cli.json).toMatchObject({ illustrate: false, pages: [], articles: [] });
  });
});
