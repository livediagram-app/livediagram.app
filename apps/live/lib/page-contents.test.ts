import { describe, expect, it } from 'vitest';
import { layOutIllustratePages, type IllustratePage } from '@livediagram/document';
import { contentsRows, filterContents, pageInView } from './page-contents';
import { contentsDropUnit } from './page-contents';

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

describe('contentsDropUnit', () => {
  const plain = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

  it('moves a page before or after another, losing a step going down', () => {
    expect(contentsDropUnit(plain, 'a', { index: 2, side: 'after' })).toBe(2);
    expect(contentsDropUnit(plain, 'a', { index: 2, side: 'before' })).toBe(1);
    expect(contentsDropUnit(plain, 'd', { index: 0, side: 'before' })).toBe(0);
  });

  it('is no move where the page already is', () => {
    expect(contentsDropUnit(plain, 'b', { index: 1, side: 'after' })).toBeNull();
    expect(contentsDropUnit(plain, 'b', { index: 0, side: 'after' })).toBeNull();
    expect(contentsDropUnit(plain, 'b', { index: 2, side: 'before' })).toBeNull();
  });

  it('moves an article as one, a drop beside any of its pages beside the whole article', () => {
    const pages = [{ id: 'a' }, { id: 'x1', flow: 'f' }, { id: 'x2', flow: 'f' }, { id: 'b' }];
    // Units: a, article, b. The second article page dropped after b: the article goes last.
    expect(contentsDropUnit(pages, 'x2', { index: 3, side: 'after' })).toBe(2);
    // b dropped after the article's first page lands after the article: where it is already.
    expect(contentsDropUnit(pages, 'b', { index: 1, side: 'after' })).toBeNull();
    // a dropped beside its own article's page is a move past the article.
    expect(contentsDropUnit(pages, 'a', { index: 2, side: 'after' })).toBe(1);
    // A drop on the dragged article itself is none.
    expect(contentsDropUnit(pages, 'x1', { index: 2, side: 'after' })).toBeNull();
  });
});
