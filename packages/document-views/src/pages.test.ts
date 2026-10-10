import { describe, expect, it } from 'vitest';
import type { PagesView } from '@livediagram/api-schema';
import { layOutIllustratePages, type IllustratePage, type Tab } from '@livediagram/document';
import { shapeAt } from './__fixtures__/build';
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

describe('the pages view', () => {
  it('lists each page with its rectangle and the refs on it, then each article as Markdown', () => {
    const out = pagesOf(illustrateTab());
    const lines = out.text.split('\n');
    expect(lines[0]).toBe(
      'tab tab-deck "Deck" · 1 element: 1 box · illustrate 4 pages: 1 slide, 1 logo, 2 article (view pages) · rev 7',
    );
    expect(lines[1]).toBe(
      `page 1 "Cover" page-cover · slide Slide (16:9) · at ${cover.x},${cover.y} 1920x1080 · 1 element: aaaa1111`,
    );
    expect(lines[2]).toMatch(/^page 2 page-logo · logo 1024 x 1024 · at .* · locked · empty$/);
    expect(lines[3]).toMatch(/^page 3 page-art1 · article A4 · at .* · article art-1 · empty$/);
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
