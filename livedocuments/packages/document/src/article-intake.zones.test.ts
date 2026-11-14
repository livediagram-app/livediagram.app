import { describe, expect, it } from 'vitest';
import { ARTICLE_ZONE_MIN, type ArticleFlow, type ArticleZoneBlock } from './article-flow';
import {
  looseOnArticles,
  objectsDraggedOut,
  withZoneContentsRemoved,
  withZoneLanded,
  withZoneMoved,
  withZoneReleased,
  withZoneRemoved,
  withZoneSize,
  withZoneWrap,
  withZonesFitted,
} from './article-intake';
import { newArticleNote } from './article-notes';
import { layOutPages, type Page } from './page';
import type { ArrowElement, Element } from './index';

// docs/specs/007-editor/article-pages.md "Zones" and "Into the writing", step by step: every branch of the
// zone functions that take an edit, on a two-page article and a one-page one beside it.
const pages: Page[] = [
  { id: 'd1', orientation: 'portrait', kind: 'article', flow: 'f' },
  { id: 'd2', orientation: 'portrait', kind: 'article', flow: 'f' },
  { id: 'd3', orientation: 'portrait', kind: 'article', flow: 'g' },
  { id: 'd4', orientation: 'landscape' },
];
const laid = layOutPages(pages);
const rectOf = (id: string) => laid.find((p) => p.id === id)!.rect;
const p1 = rectOf('d1');
const p2 = rectOf('d2');
const p3 = rectOf('d3');
const p4 = rectOf('d4');

const zone = (over: Partial<ArticleZoneBlock> = {}): ArticleZoneBlock => ({
  id: 'z',
  type: 'zone',
  zone: 'drawing',
  width: 300,
  height: 200,
  at: { page: 'd1', x: 100, y: 100 },
  ...over,
});
const para = { id: 'p', type: 'paragraph' as const, runs: [{ text: 'Hi' }] };
const box = (id: string, x: number, y: number, w = 50, h = 50): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: w,
  height: h,
});
const pinned = (id: string, from: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'free', x: 5000, y: 5000 },
});
const hung = (id: string, onto: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 6000, y: 6000 },
  to: { kind: 'on-arrow', arrowId: onto, t: 0.5 },
});
const free = (id: string, x: number, y: number): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x, y },
  to: { kind: 'free', x: x + 10, y },
});
const tabOf = (
  elements: Element[],
  blocks: ArticleFlow['blocks'],
  style?: ArticleFlow['style'],
) => ({
  elements,
  pages,
  articles: { f: style ? { blocks, style } : { blocks } } as Record<string, ArticleFlow>,
});
const zoneOf = (tab: { articles: Record<string, ArticleFlow> }, id = 'z') =>
  tab.articles.f!.blocks.find((b) => b.id === id) as ArticleZoneBlock;

describe('looseOnArticles', () => {
  const tab = tabOf([], [zone()]);
  const articles = { ...tab.articles, g: { blocks: [para] } };
  const els = [
    box('inside', p1.x + 200, p1.y + 150),
    box('loose1', p1.x + 600, p1.y + 600),
    box('loose2', p1.x + 620, p1.y + 620),
    box('onG', p3.x + 100, p3.y + 100),
    box('offArticle', p4.x + 100, p4.y + 100),
    box('nowhere', -9999, -9999),
    newArticleNote('note', 'comment', { x: p1.x + 700, y: p1.y + 700 }) as Element,
  ];
  it('groups what landed outside every zone by article, and leaves the rest', () => {
    const ids = [...els.map((e) => e.id), 'missing'];
    const out = looseOnArticles(els, ids, laid, articles);
    expect(Object.fromEntries(out)).toEqual({ f: ['loose1', 'loose2'], g: ['onG'] });
  });

  it('skips a page whose article is gone, and a zone with no place yet', () => {
    const noPlace = { f: { blocks: [zone({ at: undefined }), para] } };
    const out = looseOnArticles(els, ['inside'], laid, noPlace);
    expect(Object.fromEntries(out)).toEqual({ f: ['inside'] });
    expect(looseOnArticles(els, ['inside'], laid, {}).size).toBe(0);
    // A zone whose page is not laid out has no rect, so it holds nothing.
    const stray = { f: { blocks: [zone({ at: { page: 'gone', x: 0, y: 0 } })] } };
    expect(Object.fromEntries(looseOnArticles(els, ['inside'], laid, stray))).toEqual({
      f: ['inside'],
    });
  });
});

describe('withZonesFitted: every kind of block', () => {
  it('keeps writing around a zone with no place, and a zone whose page is gone', () => {
    const tab = tabOf(
      [],
      [para, zone({ at: undefined }), zone({ id: 'y', at: { page: 'no', x: 0, y: 0 } })],
    );
    expect(withZonesFitted(tab, 'f', 640)).toBe(tab);
    expect(withZonesFitted(tab, 'nope', 640)).toBe(tab);
  });

  it('drops an object zone whose object is gone', () => {
    const tab = tabOf([], [para, zone({ zone: 'object' })], { look: 'notebook' });
    const out = withZonesFitted(tab, 'f', 640);
    expect(out.articles.f!.blocks).toEqual([para]);
    expect(out.articles.f!.style).toEqual({ look: 'notebook' });
  });

  it('moves and scales an object to its zone corner, resizing the zone to it', () => {
    const obj = box('o', p1.x + 150, p1.y + 150, 300, 200);
    const tab = tabOf([obj], [zone({ zone: 'object', width: 500, height: 500 })]);
    const out = withZonesFitted(tab, 'f', 640);
    const moved = out.elements[0] as Extract<Element, { x: number }>;
    expect([moved.x, moved.y]).toEqual([p1.x + 100, p1.y + 100]);
    expect([zoneOf(out).width, zoneOf(out).height]).toEqual([300, 200]);
  });

  it('only resizes the zone when the object already sits at its corner', () => {
    const obj = box('o', p1.x + 100, p1.y + 100, 300, 200);
    const tab = tabOf([obj], [zone({ zone: 'object', width: 400, height: 200 })]);
    const out = withZonesFitted(tab, 'f', 640);
    expect(out.elements[0]).toBe(obj);
    expect(zoneOf(out).width).toBe(300);
    // Already fitted: nothing changes.
    const fitted = tabOf([obj], [zone({ zone: 'object', width: 300, height: 200 })]);
    expect(withZonesFitted(fitted, 'f', 640)).toBe(fitted);
  });

  it('moves an object that is off its corner though its zone already fits', () => {
    const obj = box('o', p1.x + 120, p1.y + 100, 300, 200);
    const tab = tabOf(
      [obj, box('other', 0, 0)],
      [zone({ zone: 'object', width: 300, height: 200 })],
    );
    const out = withZonesFitted(tab, 'f', 640);
    expect((out.elements[0] as Extract<Element, { x: number }>).x).toBe(p1.x + 100);
    expect(out.elements[1]).toBe(tab.elements[1]);
    expect(zoneOf(out)).toEqual(zoneOf(tab));
  });

  it('leaves a drawing zone with nothing in it, and one its elements already fit', () => {
    const empty = tabOf([], [zone()]);
    expect(withZonesFitted(empty, 'f', 640)).toBe(empty);
    const fits = tabOf([box('s', p1.x + 150, p1.y + 150)], [zone()]);
    expect(withZonesFitted(fits, 'f', 640)).toBe(fits);
  });

  it('grows a drawing zone across to the text width and down, never past them', () => {
    const grows = tabOf([box('s', p1.x + 250, p1.y + 250, 300, 80)], [zone()]);
    const grown = withZonesFitted(grows, 'f', 640);
    expect(zoneOf(grown).width).toBeGreaterThan(300);
    expect(zoneOf(grown).width).toBeLessThan(640);
    expect(zoneOf(grown).height).toBeGreaterThan(200);
    // An element reaching past the text width stops at it.
    const wide = tabOf([box('s', p1.x + 50, p1.y + 150, 700, 80)], [zone()]);
    expect(zoneOf(withZonesFitted(wide, 'f', 640)).width).toBe(640);
  });
});

describe('withZoneContentsRemoved', () => {
  const inZone = box('a', p1.x + 150, p1.y + 150);
  it('takes the elements of the zones that left, and every arrow tied to them', () => {
    const els = [
      inZone,
      pinned('tied', 'a'),
      hung('onTied', 'tied'),
      box('keep', p1.x + 700, p1.y + 700),
      pinned('keepArrow', 'keep'),
      free('freeArrow', 9000, 9000),
    ];
    const out = withZoneContentsRemoved(tabOf(els, [zone()]), 'f', [zone()]);
    expect(out.elements.map((e) => e.id)).toEqual(['keep', 'keepArrow', 'freeArrow']);
  });

  it('answers the same tab when a zone has no place or holds nothing', () => {
    const tab = tabOf([inZone], [zone()]);
    expect(withZoneContentsRemoved(tab, 'f', [zone({ at: undefined })])).toBe(tab);
    expect(withZoneContentsRemoved(tab, 'f', [zone({ at: { page: 'd1', x: 800, y: 900 } })])).toBe(
      tab,
    );
  });
});

describe('withZoneLanded and withZoneMoved', () => {
  const landed = (over = {}) => ({
    id: 'z',
    blocks: [para, zone({ at: undefined })],
    index: 1,
    x: 40,
    y: 60,
    ...over,
  });

  it('places the zone where it landed and grows the article to that page', () => {
    const one = { ...tabOf([], [para]), pages: pages.filter((p) => p.id !== 'd2') };
    const out = withZoneLanded(one, 'f', landed());
    const grown = layOutPages(out.tab.pages).filter((p) => p.flow === 'f');
    expect(grown).toHaveLength(2);
    expect(zoneOf(out.tab).at).toEqual({ page: grown[1]!.id, x: 40, y: 60 });
    expect(out.rect).toEqual({
      x: grown[1]!.rect.x + 40,
      y: grown[1]!.rect.y + 60,
      width: 300,
      height: 200,
    });
    // With a style, the writing keeps it.
    const styled = withZoneLanded(
      { ...one, articles: { f: { blocks: [para], style: { look: 'notebook' as const } } } },
      'f',
      landed(),
    );
    expect(styled.tab.articles.f.style).toEqual({ look: 'notebook' });
  });

  it('answers the same tab for an article that is gone, or a landing page past the limit', () => {
    const tab = tabOf([], [para]);
    expect(withZoneLanded(tab, 'nope', landed())).toEqual({ tab, rect: null });
    expect(withZoneLanded(tab, 'f', landed({ index: 99 })).rect).toBeNull();
  });

  it('answers a null rect when the landed block is not a zone', () => {
    const tab = tabOf([], [para]);
    const out = withZoneLanded(tab, 'f', landed({ blocks: [para], id: 'p' }));
    expect(out.rect).toBeNull();
  });

  it('carries the elements with the zone to where it landed', () => {
    const tab = tabOf([box('a', p1.x + 150, p1.y + 150)], [para, zone()]);
    const out = withZoneMoved(tab, 'f', 'z', landed({ index: 1, x: 100, y: 100 }));
    const moved = out.elements[0] as Extract<Element, { x: number }>;
    expect([moved.x, moved.y]).toEqual([p2.x + 150, p2.y + 150]);
  });

  it('only lands the zone when it had no place, and leaves a gone article alone', () => {
    const tab = tabOf([], [para, zone({ at: undefined })]);
    expect(zoneOf(withZoneMoved(tab, 'f', 'z', landed())).at).toBeDefined();
    expect(withZoneMoved(tab, 'nope', 'z', landed())).toBe(tab);
  });
});

describe('withZoneWrap', () => {
  const content = box('a', p1.x + 150, p1.y + 150, 100, 100);
  const wide = zone({ width: 600, height: 300 });

  it('answers the same tab for a missing zone or article, or a wrap and place already so', () => {
    const tab = tabOf([], [wide]);
    expect(withZoneWrap(tab, 'f', 'nope', { wrap: 'left' }, 640)).toBe(tab);
    expect(withZoneWrap(tab, 'x', 'z', { wrap: 'left' }, 640)).toBe(tab);
    expect(withZoneWrap(tab, 'f', 'z', {}, 640)).toBe(tab);
    expect(withZoneWrap(tab, 'f', 'z', { wrap: 'inline', align: 'center' }, 640)).toBe(tab);
  });

  it('scales a zone wrapped to the side to two thirds of the text, its elements with it', () => {
    const tab = tabOf([content], [para, wide], { look: 'notebook' });
    const out = withZoneWrap(tab, 'f', 'z', { wrap: 'left' }, 600);
    expect(zoneOf(out).wrap).toBe('left');
    expect(zoneOf(out).width).toBe(400);
    expect(zoneOf(out).height).toBe(200);
    expect((out.elements[0] as Extract<Element, { width: number }>).width).toBeLessThan(100);
    expect(out.articles.f!.style).toEqual({ look: 'notebook' });
  });

  it('keeps the size of a zone that fits, and sets an align apart from centre', () => {
    const tab = tabOf([content], [zone()]);
    const out = withZoneWrap(tab, 'f', 'z', { align: 'right' }, 640);
    expect(zoneOf(out).align).toBe('right');
    expect(zoneOf(out).width).toBe(300);
    expect(out.elements).toBe(tab.elements);
    const back = withZoneWrap(out, 'f', 'z', { align: 'center' }, 640);
    expect(zoneOf(back).align).toBeUndefined();
    expect(zoneOf(back).wrap).toBeUndefined();
  });

  it('scales a zone with no place without touching elements', () => {
    const tab = tabOf([content], [{ ...wide, at: undefined }]);
    const out = withZoneWrap(tab, 'f', 'z', { wrap: 'right' }, 600);
    expect(zoneOf(out).width).toBe(400);
    expect(out.elements).toBe(tab.elements);
  });

  it('widens an inline zone back out to the text width', () => {
    const side = tabOf([], [zone({ wrap: 'left', width: 200, height: 100 })]);
    const out = withZoneWrap(side, 'f', 'z', { wrap: 'inline' }, 640);
    expect(zoneOf(out).wrap).toBeUndefined();
    expect(zoneOf(out).width).toBe(200);
  });
});

describe('withZoneRemoved and withZoneReleased', () => {
  const tab = tabOf([box('a', p1.x + 150, p1.y + 150)], [para, zone()], { look: 'notebook' });
  const plain = tabOf([box('a', p1.x + 150, p1.y + 150)], [para, zone()]);

  it('takes a zone out with its elements', () => {
    const out = withZoneRemoved(tab, 'f', 'z');
    expect(out.elements).toEqual([]);
    expect(out.articles.f).toEqual({ blocks: [para], style: { look: 'notebook' } });
    expect(withZoneRemoved(plain, 'f', 'z').articles.f).toEqual({ blocks: [para] });
    expect(withZoneRemoved(tab, 'f', 'nope')).toBe(tab);
    expect(withZoneRemoved(tab, 'x', 'z')).toBe(tab);
  });

  it('lets a zone go, its elements staying put', () => {
    const out = withZoneReleased(tab, 'f', 'z');
    expect(out.elements).toBe(tab.elements);
    expect(out.articles.f).toEqual({ blocks: [para], style: { look: 'notebook' } });
    expect(withZoneReleased(plain, 'f', 'z').articles.f).toEqual({ blocks: [para] });
    expect(withZoneReleased(tab, 'f', 'nope')).toBe(tab);
    expect(withZoneReleased(tab, 'x', 'z')).toBe(tab);
    // A paragraph with the same id is not a zone.
    expect(withZoneReleased(tab, 'f', 'p')).toBe(tab);
  });
});

describe('withZoneSize: the sides it may take', () => {
  const content = box('a', p1.x + 250, p1.y + 250, 100, 100);

  it('answers the same tab for a missing zone, or a size the zone already has', () => {
    const tab = tabOf([], [zone()]);
    expect(withZoneSize(tab, 'f', 'nope', { width: 100 }, 640)).toBe(tab);
    expect(withZoneSize(tab, 'x', 'z', { width: 100 }, 640)).toBe(tab);
    expect(withZoneSize(tab, 'f', 'z', {}, 640)).toBe(tab);
    expect(withZoneSize(tab, 'f', 'z', { width: 300, height: 200 }, 640)).toBe(tab);
  });

  it('holds a zone to the least its elements need, and to the text width', () => {
    const tab = tabOf([content], [para, zone()], { look: 'notebook' });
    const small = withZoneSize(tab, 'f', 'z', { width: 10, height: 10 }, 640);
    expect(zoneOf(small).width).toBeGreaterThan(ARTICLE_ZONE_MIN);
    expect(zoneOf(small).height).toBeGreaterThan(ARTICLE_ZONE_MIN);
    expect(small.articles.f!.style).toEqual({ look: 'notebook' });
    expect(zoneOf(withZoneSize(tab, 'f', 'z', { width: 5000 }, 640)).width).toBe(640);
  });

  it('holds a wrapped zone to two thirds of the text, and a zone with no place to its minimum', () => {
    const wrapped = tabOf([], [zone({ wrap: 'left' })]);
    expect(zoneOf(withZoneSize(wrapped, 'f', 'z', { width: 5000 }, 600)).width).toBe(400);
    const lost = tabOf([], [zone({ at: undefined })]);
    expect(zoneOf(withZoneSize(lost, 'f', 'z', { width: 1, height: 1 }, 640)).width).toBe(
      ARTICLE_ZONE_MIN,
    );
  });
});

describe('objectsDraggedOut', () => {
  const obj = (x: number, y: number) => box('o', x, y, 100, 100);
  const object = zone({ zone: 'object', width: 100, height: 100 });
  const before = tabOf([obj(p1.x + 100, p1.y + 100)], [para, object]);

  it('finds an object dropped on its own article elsewhere, off its zone', () => {
    const now = tabOf([obj(p2.x + 300, p2.y + 300)], [para, object]);
    const out = objectsDraggedOut(before, now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ flow: 'f', zoneId: 'z', elementId: 'o' });
  });

  it('leaves an object still in its zone, dropped off every page, or gone', () => {
    const still = tabOf([obj(p1.x + 105, p1.y + 105)], [para, object]);
    expect(objectsDraggedOut(before, still)).toEqual([]);
    expect(objectsDraggedOut(before, tabOf([obj(-9999, -9999)], [para, object]))).toEqual([]);
    expect(objectsDraggedOut(before, tabOf([], [para, object]))).toEqual([]);
  });

  it('skips drawing zones, a zone that left the writing, and a zone with no place', () => {
    const away = tabOf([obj(p2.x + 300, p2.y + 300)], [para, object]);
    const drawing = tabOf([obj(p1.x + 100, p1.y + 100)], [para, zone({ width: 100, height: 100 })]);
    expect(objectsDraggedOut(drawing, away)).toEqual([]);
    expect(objectsDraggedOut(before, tabOf(away.elements, [para]))).toEqual([]);
    expect(objectsDraggedOut(before, { ...away, articles: {} })).toEqual([]);
    const lost = tabOf(before.elements, [para, { ...object, at: undefined }]);
    expect(objectsDraggedOut(lost, away)).toEqual([]);
    // A zone with no boxed object inside it.
    const noObj = tabOf([], [para, object]);
    expect(objectsDraggedOut(noObj, away)).toEqual([]);
  });
});
