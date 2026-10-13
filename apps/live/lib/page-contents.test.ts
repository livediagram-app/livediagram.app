import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import { contentsRows, filterContents, pageInView } from './page-contents';

// docs/specs/007-editor/illustrate-pages.md "Contents".
const pages = layOutIllustratePages([
  { id: 'a', orientation: 'portrait', kind: 'infographic', name: 'Cover' },
  { id: 'b', orientation: 'landscape', kind: 'slide', size: 'slide' },
  { id: 'c', orientation: 'portrait', kind: 'article', flow: 'f1', locked: true },
  { id: 'd', orientation: 'portrait', kind: 'logo', size: 'logo' },
] as IllustratePage[]);

describe('the Contents list', () => {
  const rows = contentsRows(pages, {
    inDeck: (id) => id === 'b',
    articles: {
      f1: {
        blocks: [{ type: 'paragraph', style: 'title', runs: [{ text: 'Field Notes' }] }],
      } as never,
    },
  });

  it('numbers each page, names it, and says what it is', () => {
    expect(rows.map((r) => [r.number, r.name, r.line])).toEqual([
      [1, 'Cover', 'Infographic · A4 Portrait'],
      [2, 'Page 2', 'Slide · In the deck'],
      [3, 'Page 3', 'Article · Field Notes'],
      [4, 'Page 4', 'Logo'],
    ]);
    expect(rows[2]!.locked).toBe(true);
    expect(rows[1]!.aspect).toBeGreaterThan(1.7);
  });

  it('finds pages by name, kind or number, every word', () => {
    expect(filterContents(rows, 'slide').map((r) => r.id)).toEqual(['b']);
    expect(filterContents(rows, '3').map((r) => r.id)).toEqual(['c']);
    expect(filterContents(rows, 'cover portrait').map((r) => r.id)).toEqual(['a']);
    expect(filterContents(rows, '  ')).toHaveLength(4);
    expect(filterContents(rows, 'nothing')).toEqual([]);
  });

  it('marks the page at the middle of the screen, else the nearest', () => {
    const b = pages[1]!.rect;
    const screen = { width: 1000, height: 800 };
    // Centre the view on page b at zoom 1: a screen point is (canvas + offset) × zoom.
    const view = {
      zoom: 1,
      offset: { x: 500 - (b.x + b.width / 2), y: 400 - (b.y + b.height / 2) },
    };
    expect(pageInView(pages, view, screen)).toBe('b');
    const far = { zoom: 1, offset: { x: 500 - 100_000, y: 0 } };
    expect(pageInView(pages, far, screen)).toBe('d');
    expect(pageInView([], view, screen)).toBeUndefined();
  });
});
